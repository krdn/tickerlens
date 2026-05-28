// Compose-layer integration test — exercises the fan-out, depth routing,
// and partial-failure behavior without hitting any real LLM.
//
// Strategy: pass a Mock DataSourceAdapter (in-memory fixture) and a Mock
// ModelConfigAdapter from @krdn/llm-gateway whose runModule is monkey-patched
// via vi.mock to return canned responses.

import { describe, expect, it, vi } from "vitest";
import type { ModelConfigAdapter } from "@krdn/llm-gateway/adapters";
import type {
  DailyBar,
  DataSourceAdapter,
  RawTickerData,
} from "../data/adapter.js";
import type { Persona } from "../types.js";

// Stub the runner module before importing composeTickerAnalysis so the
// composeTickerAnalysis import binds to our mocked version.
vi.mock("@krdn/llm-gateway/runner", () => ({
  runModule: vi.fn(async (module: { name: string }) => {
    if (module.name.endsWith(".long") || module.name.endsWith(".mid") || module.name.endsWith(".short")) {
      return {
        module: module.name,
        status: "completed" as const,
        result: makeMockResult(module.name),
      };
    }
    if (module.name.endsWith(".lite")) {
      return {
        module: module.name,
        status: "completed" as const,
        result: {
          long: makeMockResult(`${module.name}/long`),
          mid: makeMockResult(`${module.name}/mid`),
          short: makeMockResult(`${module.name}/short`),
        },
      };
    }
    return {
      module: module.name,
      status: "failed" as const,
      errorMessage: "unmocked module",
    };
  }),
}));

const { composeTickerAnalysis } = await import("./tickerAnalysis.js");

function makeMockResult(label: string) {
  return {
    signal: "buy" as const,
    confidence: 70,
    thesis: `Mock thesis for ${label}. The fundamentals support a long-horizon bull case based on durable margins, secular tailwinds, and disciplined capital allocation.`,
    evidence: [{ label: "fixture", value: label }],
    risks: ["mock risk one", "mock risk two"],
    catalysts: ["mock catalyst"],
  };
}

const stubBar = (close: number, i: number): DailyBar => ({
  date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
  open: close - 0.5,
  high: close + 1,
  low: close - 1,
  close,
  volume: 1_000_000,
});

const mockRaw = (withOptions = true): RawTickerData => ({
  quote: {
    ticker: "FAKE",
    last: 100,
    previousClose: 98,
    range52wLow: 80,
    range52wHigh: 120,
    volume: 5_000_000,
    asOf: "2026-01-15T16:00:00Z",
  },
  fundamentals: {
    marketCap: 50_000_000_000,
    pe: 20,
    peg: 1.5,
    pb: 4,
    ev: 52_000_000_000,
    revenue: 10_000_000_000,
    revenueGrowthYoY: 0.1,
    eps: 5,
    epsGrowthYoY: 0.15,
    grossMargin: 0.4,
    operatingMargin: 0.2,
    netMargin: 0.15,
    totalDebt: 5_000_000_000,
    debtToEquity: 0.5,
    freeCashFlow: 2_000_000_000,
    dividendYield: 0.01,
  },
  bars: Array.from({ length: 220 }, (_, i) => stubBar(100 + Math.sin(i / 5) * 3, i)),
  recommendations: {
    rating: "buy",
    analystCount: 20,
    targetMean: 110,
    targetHigh: 130,
    targetLow: 95,
  },
  news: [],
  ...(withOptions
    ? {
        options: {
          expiries: ["2026-02-20"],
          nearestExpiry: "2026-02-20",
          contracts: [
            {
              strike: 100,
              type: "call" as const,
              expiry: "2026-02-20",
              bid: 2,
              ask: 2.1,
              lastPrice: 2.05,
              volume: 1000,
              openInterest: 5000,
              iv: 0.25,
            },
          ],
        },
      }
    : {}),
});

const mockAdapter = (raw: RawTickerData): DataSourceAdapter => ({
  name: "mock",
  fetch: async () => raw,
});

const stubConfigAdapter: ModelConfigAdapter = {
  resolve: async () => ({
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKey: "sk-mock",
  }),
};

describe("composeTickerAnalysis", () => {
  it("returns 12 completed slots in full mode with options data present", async () => {
    const result = await composeTickerAnalysis("FAKE", {
      configAdapter: stubConfigAdapter,
      dataAdapter: mockAdapter(mockRaw(true)),
      depth: "full",
    });
    expect(result.meta.depth).toBe("full");
    expect(result.meta.completed).toBe(12);
    expect(result.meta.failed).toBe(0);

    const personas: Persona[] = ["value", "growth", "quant", "options"];
    for (const p of personas) {
      const slots = result.perspectives[p];
      expect(slots.long.ok).toBe(true);
      expect(slots.mid.ok).toBe(true);
      expect(slots.short.ok).toBe(true);
    }
  });

  it("skips the options persona (3 slots) when options chain is absent", async () => {
    const result = await composeTickerAnalysis("FAKE", {
      configAdapter: stubConfigAdapter,
      dataAdapter: mockAdapter(mockRaw(false)),
      depth: "full",
    });
    expect(result.meta.completed).toBe(9);
    expect(result.meta.failed).toBe(3);
    for (const tf of ["long", "mid", "short"] as const) {
      const slot = result.perspectives.options[tf];
      expect(slot.ok).toBe(false);
      if (!slot.ok) {
        expect(slot.error.code).toBe("ANALYSIS_SKIPPED");
      }
    }
  });

  it("runs 4 modules in lite mode, exploding each into 3 timeframe slots", async () => {
    const result = await composeTickerAnalysis("FAKE", {
      configAdapter: stubConfigAdapter,
      dataAdapter: mockAdapter(mockRaw(true)),
      depth: "lite",
    });
    expect(result.meta.depth).toBe("lite");
    // 4 personas × 3 timeframes = 12 completed
    expect(result.meta.completed).toBe(12);
    expect(result.meta.failed).toBe(0);
  });

  it("surfaces snapshot warnings on the result", async () => {
    const raw = mockRaw(false);
    raw.bars = raw.bars.slice(0, 30); // forces MA50/200/MACD unavailable
    const result = await composeTickerAnalysis("FAKE", {
      configAdapter: stubConfigAdapter,
      dataAdapter: mockAdapter(raw),
      depth: "lite",
    });
    expect(result.snapshot.warnings.length).toBeGreaterThan(0);
  });
});
