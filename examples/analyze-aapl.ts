// examples/analyze-aapl.ts
//
// End-to-end smoke test that hits real Yahoo Finance and a real LLM.
//
// Provider auto-detection order: ANTHROPIC_API_KEY → OPENAI_API_KEY →
// GEMINI/GOOGLE_GENERATIVE_AI_API_KEY → DEEPSEEK → XAI → OPENROUTER.
// First match wins. Override with TICKERLENS_PROVIDER=openai (etc.) and
// TICKERLENS_MODEL=... if needed.
//
// Run with:
//   pnpm tsx examples/analyze-aapl.ts AAPL lite
//
// By default uses depth='lite' to keep the demo cheap (4 LLM calls).

import {
  composeTickerAnalysis,
  defaultModuleConfig,
} from "@krdn/tickerlens";
import type {
  DataSourceAdapter,
  RawTickerData,
} from "@krdn/tickerlens/data";
import { createInMemoryModelConfig } from "@krdn/llm-gateway/adapters";
import type { AIProvider } from "@krdn/llm-gateway";

interface ProviderChoice {
  provider: AIProvider;
  defaultModel: string;
}

function pickProvider(): ProviderChoice {
  const override = process.env.TICKERLENS_PROVIDER as AIProvider | undefined;
  const overrideModel = process.env.TICKERLENS_MODEL;
  const choices: Array<{
    env: string | undefined;
    provider: AIProvider;
    defaultModel: string;
  }> = [
    { env: process.env.ANTHROPIC_API_KEY, provider: "anthropic", defaultModel: "claude-sonnet-4-6" },
    { env: process.env.OPENAI_API_KEY, provider: "openai", defaultModel: "gpt-4.1-mini" },
    {
      env: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
      provider: "gemini",
      defaultModel: "gemini-2.5-flash",
    },
    { env: process.env.DEEPSEEK_API_KEY, provider: "deepseek", defaultModel: "deepseek-chat" },
    { env: process.env.XAI_API_KEY, provider: "xai", defaultModel: "grok-3-mini" },
    {
      env: process.env.OPENROUTER_API_KEY,
      provider: "openrouter",
      defaultModel: "openai/gpt-4.1-mini",
    },
  ];

  if (override) {
    const match = choices.find((c) => c.provider === override);
    if (!match) throw new Error(`Unknown TICKERLENS_PROVIDER: ${override}`);
    return {
      provider: match.provider,
      defaultModel: overrideModel ?? match.defaultModel,
    };
  }

  for (const c of choices) {
    if (c.env) {
      return { provider: c.provider, defaultModel: overrideModel ?? c.defaultModel };
    }
  }
  throw new Error(
    "No LLM API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, XAI_API_KEY, or OPENROUTER_API_KEY.",
  );
}

function buildMockAdapter(ticker: string): DataSourceAdapter {
  // AAPL-shaped synthetic snapshot — sufficient signal for prompt/Zod/persona
  // differentiation verification without hitting yfinance.
  const bars = Array.from({ length: 220 }, (_, i) => {
    const close = 175 + Math.sin(i / 5) * 8 + i * 0.1;
    return {
      date: new Date(2026, 0, i + 1).toISOString().slice(0, 10),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 55_000_000,
    };
  });

  const raw: RawTickerData = {
    quote: {
      ticker,
      last: 197.5,
      previousClose: 195.2,
      range52wLow: 164.1,
      range52wHigh: 220.8,
      volume: 58_400_000,
      avgVolume30d: 52_300_000,
      asOf: new Date().toISOString(),
    },
    fundamentals: {
      marketCap: 3_010_000_000_000,
      pe: 31.4,
      peg: 2.3,
      pb: 51.2,
      ev: 3_080_000_000_000,
      revenue: 391_000_000_000,
      revenueGrowthYoY: 0.022,
      eps: 6.28,
      epsGrowthYoY: 0.071,
      grossMargin: 0.461,
      operatingMargin: 0.315,
      netMargin: 0.263,
      totalDebt: 106_700_000_000,
      debtToEquity: 1.51,
      freeCashFlow: 99_500_000_000,
      dividendYield: 0.0047,
    },
    bars,
    options: {
      expiries: ["2026-02-20", "2026-03-20", "2026-06-19"],
      nearestExpiry: "2026-02-20",
      contracts: [
        { strike: 195, type: "call", expiry: "2026-02-20", bid: 4.2, ask: 4.4, lastPrice: 4.3, volume: 4200, openInterest: 18_500, iv: 0.24 },
        { strike: 200, type: "call", expiry: "2026-02-20", bid: 2.1, ask: 2.3, lastPrice: 2.2, volume: 6800, openInterest: 24_000, iv: 0.23 },
        { strike: 205, type: "call", expiry: "2026-02-20", bid: 0.9, ask: 1.05, lastPrice: 0.98, volume: 5200, openInterest: 15_300, iv: 0.225 },
        { strike: 195, type: "put", expiry: "2026-02-20", bid: 1.8, ask: 1.95, lastPrice: 1.88, volume: 5500, openInterest: 21_000, iv: 0.235 },
        { strike: 190, type: "put", expiry: "2026-02-20", bid: 0.8, ask: 0.95, lastPrice: 0.88, volume: 6100, openInterest: 26_400, iv: 0.245 },
      ],
      historicalIv: Array.from({ length: 60 }, (_, i) => 0.18 + Math.sin(i / 8) * 0.06 + i * 0.0008),
    },
    recommendations: {
      rating: "buy",
      analystCount: 40,
      targetMean: 215,
      targetHigh: 270,
      targetLow: 170,
    },
    news: [
      { title: "Apple unveils next-gen on-device AI features", source: "Reuters", publishedAt: "2026-05-28T10:00:00Z", url: "https://example.com/news/1" },
      { title: "Services revenue hits new record in latest quarter", source: "Bloomberg", publishedAt: "2026-05-27T14:30:00Z", url: "https://example.com/news/2" },
      { title: "Supply chain analysts flag iPhone unit risk", source: "WSJ", publishedAt: "2026-05-26T08:15:00Z", url: "https://example.com/news/3" },
    ],
  };

  return { name: "mock", fetch: async () => raw };
}

const ticker = process.argv[2] ?? "AAPL";
const depth = process.argv[3] === "full" ? "full" : "lite";
const useMock = process.env.TICKERLENS_MOCK_DATA === "1";
const { provider, defaultModel } = pickProvider();

const configAdapter = createInMemoryModelConfig({
  modules: defaultModuleConfig({ provider, model: defaultModel }),
  // apiKey is auto-resolved from env by llm-gateway's createInMemoryModelConfig.
});

// eslint-disable-next-line no-console
console.error(
  `Analyzing ${ticker} (depth=${depth}, provider=${provider}, model=${defaultModel}, data=${useMock ? "mock" : "yahoo"})...`,
);

const result = await composeTickerAnalysis(ticker, {
  configAdapter,
  depth,
  ...(useMock ? { dataAdapter: buildMockAdapter(ticker) } : {}),
});

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      ticker: result.ticker,
      asOf: result.asOf,
      snapshot: result.snapshot,
      perspectives: result.perspectives,
      meta: result.meta,
    },
    null,
    2,
  ),
);
