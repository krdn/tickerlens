// composeTickerAnalysis — the single public entry point.
//
// Pipeline:
//   1. resolveContext(ticker, adapter) → TickerSnapshot
//   2. fan-out across persona × timeframe:
//        - depth='full'  → 12 modules, each wrapped in safeFrame
//        - depth='lite'  → 4 modules (one per persona, all timeframes)
//   3. assemble AnalysisResult with completion metadata
//
// The actual AnalysisModule implementations live under src/analysts/ and the
// gateway calls go through @krdn/llm-gateway/runner. This file owns scheduling
// and result assembly only.

import { runModule } from "@krdn/llm-gateway/runner";
import type {
  AnalysisModule,
  AnalysisModuleResult,
} from "@krdn/llm-gateway";
import type { ModelConfigAdapter } from "@krdn/llm-gateway/adapters";

import { createYahooAdapter } from "../data/yahoo.js";
import type { DataSourceAdapter } from "../data/adapter.js";
import type {
  AnalysisResult,
  Persona,
  PersonaSlots,
  PerspectiveResult,
  PerspectiveSlot,
  Result,
  TickerlensError,
  Timeframe,
} from "../types.js";

import { valueLong } from "../analysts/value/long.js";
import { valueMid } from "../analysts/value/mid.js";
import { valueShort } from "../analysts/value/short.js";
import { valueLite } from "../analysts/value/lite.js";
import { growthLong } from "../analysts/growth/long.js";
import { growthMid } from "../analysts/growth/mid.js";
import { growthShort } from "../analysts/growth/short.js";
import { growthLite } from "../analysts/growth/lite.js";
import { quantLong } from "../analysts/quant/long.js";
import { quantMid } from "../analysts/quant/mid.js";
import { quantShort } from "../analysts/quant/short.js";
import { quantLite } from "../analysts/quant/lite.js";
import { optionsLong } from "../analysts/options/long.js";
import { optionsMid } from "../analysts/options/mid.js";
import { optionsShort } from "../analysts/options/short.js";
import { optionsLite } from "../analysts/options/lite.js";

import { resolveContext } from "./resolveContext.js";
import { safeFrame, skipped } from "./safeFrame.js";

export type ComposeDepth = "full" | "lite";

export interface ComposeTickerAnalysisOptions {
  /** ModelConfigAdapter from @krdn/llm-gateway/adapters — resolves provider/model/apiKey. */
  configAdapter: ModelConfigAdapter;
  /** Data source. Defaults to a Yahoo Finance adapter. */
  dataAdapter?: DataSourceAdapter;
  /** 'full' = 12 LLM calls (default), 'lite' = 4 calls (one per persona). */
  depth?: ComposeDepth;
}

type AnyModule = AnalysisModule<unknown, PerspectiveResult>;

export async function composeTickerAnalysis(
  ticker: string,
  options: ComposeTickerAnalysisOptions,
): Promise<AnalysisResult> {
  const depth = options.depth ?? "full";
  const dataAdapter = options.dataAdapter ?? createYahooAdapter();
  const startedAt = Date.now();

  const { snapshot } = await resolveContext(ticker, dataAdapter);

  const perspectives =
    depth === "full"
      ? await runFullFanOut(snapshot, options.configAdapter)
      : await runLiteFanOut(snapshot, options.configAdapter);

  const { completed, failed } = tally(perspectives);

  return {
    ticker: snapshot.ticker,
    asOf: snapshot.asOf,
    snapshot,
    perspectives,
    meta: {
      completed,
      failed,
      durationMs: Date.now() - startedAt,
      depth,
    },
  };
}

// ─── Full fan-out (12 modules) ────────────────────────────────────────────

async function runFullFanOut(
  snapshot: AnalysisResult["snapshot"],
  configAdapter: ModelConfigAdapter,
): Promise<AnalysisResult["perspectives"]> {
  const grid: Record<Persona, Record<Timeframe, AnyModule>> = {
    value: { long: valueLong, mid: valueMid, short: valueShort },
    growth: { long: growthLong, mid: growthMid, short: growthShort },
    quant: { long: quantLong, mid: quantMid, short: quantShort },
    options: { long: optionsLong, mid: optionsMid, short: optionsShort },
  };

  const personas: Persona[] = ["value", "growth", "quant", "options"];
  const timeframes: Timeframe[] = ["long", "mid", "short"];

  const tasks: Array<{
    persona: Persona;
    timeframe: Timeframe;
    promise: Promise<PerspectiveSlot>;
  }> = [];

  for (const p of personas) {
    for (const tf of timeframes) {
      const module = grid[p][tf];
      if (p === "options" && !snapshot.options) {
        tasks.push({
          persona: p,
          timeframe: tf,
          promise: Promise.resolve(
            skipped<PerspectiveResult>(
              `${p}/${tf}`,
              "options chain unavailable",
            ),
          ),
        });
        continue;
      }
      tasks.push({
        persona: p,
        timeframe: tf,
        promise: runOne(module, snapshot, configAdapter, `${p}/${tf}`),
      });
    }
  }

  const results = await Promise.all(tasks.map((t) => t.promise));

  const personaToSlots = new Map<Persona, Partial<PersonaSlots>>();
  for (let i = 0; i < tasks.length; i++) {
    const { persona, timeframe } = tasks[i]!;
    const slot = results[i]!;
    const acc = personaToSlots.get(persona) ?? {};
    acc[timeframe] = slot;
    personaToSlots.set(persona, acc);
  }

  return {
    value: ensureSlots(personaToSlots.get("value")),
    growth: ensureSlots(personaToSlots.get("growth")),
    quant: ensureSlots(personaToSlots.get("quant")),
    options: ensureSlots(personaToSlots.get("options")),
  };
}

// ─── Lite fan-out (4 modules, each covers all 3 timeframes) ───────────────

async function runLiteFanOut(
  snapshot: AnalysisResult["snapshot"],
  configAdapter: ModelConfigAdapter,
): Promise<AnalysisResult["perspectives"]> {
  const personas: Array<{
    name: Persona;
    module: AnalysisModule<unknown, LitePersonaResult>;
  }> = [
    { name: "value", module: valueLite },
    { name: "growth", module: growthLite },
    { name: "quant", module: quantLite },
    { name: "options", module: optionsLite },
  ];

  const tasks = personas.map(async ({ name, module }) => {
    if (name === "options" && !snapshot.options) {
      return {
        name,
        slots: makeAllSkipped(name, "options chain unavailable"),
      };
    }
    const result = await runLiteOne(module, snapshot, configAdapter, `${name}/lite`);
    if (!result.ok) {
      return { name, slots: makeAllFailed(result.error) };
    }
    return { name, slots: explodeLite(result.value) };
  });

  const settled = await Promise.all(tasks);
  const byPersona = new Map(settled.map((s) => [s.name, s.slots]));

  return {
    value: byPersona.get("value")!,
    growth: byPersona.get("growth")!,
    quant: byPersona.get("quant")!,
    options: byPersona.get("options")!,
  };
}

interface LitePersonaResult {
  long: PerspectiveResult;
  mid: PerspectiveResult;
  short: PerspectiveResult;
}

function explodeLite(lite: LitePersonaResult): PersonaSlots {
  return {
    long: { ok: true, value: lite.long },
    mid: { ok: true, value: lite.mid },
    short: { ok: true, value: lite.short },
  };
}

function makeAllSkipped(label: string, reason: string): PersonaSlots {
  return {
    long: skipped<PerspectiveResult>(`${label}/long`, reason),
    mid: skipped<PerspectiveResult>(`${label}/mid`, reason),
    short: skipped<PerspectiveResult>(`${label}/short`, reason),
  };
}

function makeAllFailed(error: TickerlensError): PersonaSlots {
  return {
    long: { ok: false, error },
    mid: { ok: false, error },
    short: { ok: false, error },
  };
}

// ─── Shared runner / glue ─────────────────────────────────────────────────

async function runOne(
  module: AnyModule,
  snapshot: AnalysisResult["snapshot"],
  configAdapter: ModelConfigAdapter,
  label: string,
): Promise<PerspectiveSlot> {
  return safeFrame(label, async () => {
    const result = await runModule(module, snapshot, {
      configAdapter,
      extractMeta: (input) => ({
        jobId: 0,
        itemCount: 1,
        ticker: (input as { ticker?: string }).ticker ?? "",
      }),
    });
    return unwrap<PerspectiveResult>(result, label);
  });
}

async function runLiteOne(
  module: AnalysisModule<unknown, LitePersonaResult>,
  snapshot: AnalysisResult["snapshot"],
  configAdapter: ModelConfigAdapter,
  label: string,
): Promise<Result<LitePersonaResult, TickerlensError>> {
  return safeFrame(label, async () => {
    const result = await runModule(module, snapshot, {
      configAdapter,
      extractMeta: (input) => ({
        jobId: 0,
        itemCount: 1,
        ticker: (input as { ticker?: string }).ticker ?? "",
      }),
    });
    return unwrap<LitePersonaResult>(result, label);
  });
}

function unwrap<T>(result: AnalysisModuleResult<T>, label: string): T {
  if (result.status === "completed" && result.result !== undefined) {
    return result.result;
  }
  const detail = result.errorMessage ?? `unknown ${result.status}`;
  throw new Error(`${label}: ${detail}`);
}

function ensureSlots(partial: Partial<PersonaSlots> | undefined): PersonaSlots {
  return {
    long:
      partial?.long ??
      ({ ok: false, error: failed("missing long slot") } as PerspectiveSlot),
    mid:
      partial?.mid ??
      ({ ok: false, error: failed("missing mid slot") } as PerspectiveSlot),
    short:
      partial?.short ??
      ({ ok: false, error: failed("missing short slot") } as PerspectiveSlot),
  };
}

function failed(message: string): TickerlensError {
  return { code: "UNKNOWN", message };
}

function tally(perspectives: AnalysisResult["perspectives"]) {
  let completed = 0;
  let failed = 0;
  for (const personaName of Object.keys(perspectives) as Persona[]) {
    const slots = perspectives[personaName];
    for (const tf of ["long", "mid", "short"] as const) {
      const slot = slots[tf];
      if (slot.ok) completed += 1;
      else failed += 1;
    }
  }
  return { completed, failed };
}
