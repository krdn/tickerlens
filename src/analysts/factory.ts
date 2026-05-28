// Module factory — builds an `AnalysisModule<TickerSnapshot, TResult>` from
// persona + timeframe + schema. Every concrete module in src/analysts/ is
// produced by this factory; keeping the boilerplate here makes it impossible
// for the 16 modules to drift in how they assemble prompts.

import type { AnalysisModule } from "@krdn/llm-gateway";
import type { z } from "zod";
import type { TickerSnapshot } from "../types.js";
import { buildUserPrompt } from "../prompts/builders.js";
import { personaSystemPrompt, type PersonaName } from "../prompts/personas.js";
import type { TimeframeName } from "../prompts/timeframes.js";

export interface ModuleFactoryInput<TResult> {
  /** Module identifier — used by ModelConfigAdapter to resolve provider/model. */
  name: string;
  /** Human-readable label for logs. */
  displayName: string;
  persona: PersonaName;
  timeframe: TimeframeName;
  schema: z.ZodType<TResult, z.ZodTypeDef, unknown>;
}

/**
 * Create an AnalysisModule whose name maps to the consumer's ModelConfigAdapter
 * entry (provider/model/apiKey). Provider/model fields here are placeholders;
 * runModule resolves the real config via the adapter.
 */
export function createAnalystModule<TResult>(
  input: ModuleFactoryInput<TResult>,
): AnalysisModule<TickerSnapshot, TResult> {
  return {
    name: input.name,
    displayName: input.displayName,
    provider: "anthropic", // overridden by ModelConfigAdapter at runtime
    model: "claude-sonnet-4-6", // overridden by ModelConfigAdapter at runtime
    schema: input.schema,
    buildPrompt(snapshot: TickerSnapshot): string {
      return buildUserPrompt({
        snapshot,
        persona: input.persona,
        timeframe: input.timeframe,
      });
    },
    buildSystemPrompt(): string {
      return personaSystemPrompt(input.persona);
    },
  };
}
