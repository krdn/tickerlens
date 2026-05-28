import { describe, expect, it } from "vitest";
import { normalizeSnapshot } from "./snapshot.js";
import type { DailyBar, RawTickerData } from "./adapter.js";

const baseBars = (n: number, start = 150): DailyBar[] =>
  Array.from({ length: n }, (_, i) => {
    const close = start + Math.sin(i / 5) * 5 + i * 0.1;
    return {
      date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 50_000_000,
    };
  });

const baseRaw = (overrides: Partial<RawTickerData> = {}): RawTickerData => ({
  quote: {
    ticker: "AAPL",
    last: 175,
    previousClose: 170,
    range52wLow: 140,
    range52wHigh: 200,
    volume: 60_000_000,
    avgVolume30d: 55_000_000,
    asOf: "2026-01-15T16:00:00Z",
  },
  fundamentals: {
    marketCap: 2_800_000_000_000,
    pe: 28,
    peg: 2.1,
    pb: 45,
    ev: 2_850_000_000_000,
    revenue: 380_000_000_000,
    revenueGrowthYoY: 0.04,
    eps: 6.25,
    epsGrowthYoY: 0.08,
    grossMargin: 0.45,
    operatingMargin: 0.3,
    netMargin: 0.25,
    totalDebt: 100_000_000_000,
    debtToEquity: 1.7,
    freeCashFlow: 95_000_000_000,
    dividendYield: 0.0055,
  },
  bars: baseBars(220),
  recommendations: {
    rating: "buy",
    analystCount: 42,
    targetMean: 185,
    targetHigh: 220,
    targetLow: 160,
  },
  news: [
    {
      title: "Apple announces new product line",
      source: "Bloomberg",
      publishedAt: "2026-01-14T12:00:00Z",
      url: "https://example.com/news/1",
    },
  ],
  ...overrides,
});

describe("normalizeSnapshot", () => {
  it("computes change and changePct from last and previousClose", () => {
    const snap = normalizeSnapshot(baseRaw());
    expect(snap.price.last).toBe(175);
    expect(snap.price.change).toBe(5);
    expect(snap.price.changePct).toBeCloseTo(2.94, 2);
  });

  it("flattens fundamentals into nested margins/debt structure", () => {
    const snap = normalizeSnapshot(baseRaw());
    expect(snap.fundamentals.margins.gross).toBe(0.45);
    expect(snap.fundamentals.debt.toEquity).toBe(1.7);
  });

  it("computes RSI/MACD/MA when bars are sufficient", () => {
    const snap = normalizeSnapshot(baseRaw());
    expect(snap.indicators.rsi14).not.toBeNull();
    expect(snap.indicators.macd).not.toBeNull();
    expect(snap.indicators.ma.ma50).not.toBeNull();
    expect(snap.indicators.ma.ma200).not.toBeNull();
  });

  it("emits warnings for missing fundamentals and absent indicators", () => {
    const raw = baseRaw({
      bars: baseBars(40),
      fundamentals: {
        ...baseRaw().fundamentals,
        pe: null,
        peg: null,
        freeCashFlow: null,
      },
      news: [],
    });
    const snap = normalizeSnapshot(raw);
    expect(snap.warnings).toEqual(
      expect.arrayContaining([
        "PE unavailable",
        "PEG unavailable",
        "FCF unavailable",
        "no recent news",
        expect.stringContaining("MA200 unavailable"),
      ]),
    );
  });

  it("omits options field and warns when chain is absent", () => {
    const snap = normalizeSnapshot(baseRaw());
    expect(snap.options).toBeUndefined();
    expect(snap.warnings).toContain("options chain unavailable");
  });

  it("normalizes options chain and computes put/call ratio", () => {
    const snap = normalizeSnapshot(
      baseRaw({
        options: {
          expiries: ["2026-02-20", "2026-03-20"],
          nearestExpiry: "2026-02-20",
          contracts: [
            {
              strike: 175,
              type: "call",
              expiry: "2026-02-20",
              bid: 3.0,
              ask: 3.1,
              lastPrice: 3.05,
              volume: 5000,
              openInterest: 10000,
              iv: 0.28,
            },
            {
              strike: 175,
              type: "put",
              expiry: "2026-02-20",
              bid: 2.9,
              ask: 3.0,
              lastPrice: 2.95,
              volume: 7000,
              openInterest: 8000,
              iv: 0.3,
            },
          ],
        },
      }),
    );
    expect(snap.options).toBeDefined();
    expect(snap.options!.nearestExpiry.putCallRatio).toBeCloseTo(7000 / 5000);
    expect(snap.options!.nearestExpiry.iv).toBe(0.28);
    expect(snap.options!.nearestExpiry.topStrikes).toHaveLength(2);
  });
});
