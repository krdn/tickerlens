// Snapshot normalization — turns provider-specific `RawTickerData` into the
// canonical `TickerSnapshot` consumed by all 12 analyst modules.
//
// This layer is responsible for:
// 1. Computing derived fields (price change, technical indicators, IV rank).
// 2. Picking the most-traded option strikes near the money.
// 3. Surfacing missing fields as `warnings` rather than throwing.

import type {
  IndicatorsSnapshot,
  OptionsSnapshot,
  OptionStrike,
  TickerSnapshot,
} from "../types.js";
import type { RawOptionContract, RawTickerData } from "./adapter.js";
import {
  computeIvRank,
  computeMacd,
  computeMovingAverage,
  computeRsi14,
} from "./indicators.js";

/** How many top strikes (by open interest) we keep per side near ATM. */
const TOP_STRIKE_COUNT = 5;

export function normalizeSnapshot(raw: RawTickerData): TickerSnapshot {
  const warnings: string[] = [];

  // ─── Price ──────────────────────────────────────────────────────────────
  const { quote } = raw;
  const change = quote.last - quote.previousClose;
  const changePct =
    quote.previousClose === 0 ? 0 : (change / quote.previousClose) * 100;

  // ─── Indicators ─────────────────────────────────────────────────────────
  const indicators = computeIndicators(raw, warnings);

  // ─── Options ────────────────────────────────────────────────────────────
  const options = raw.options
    ? normalizeOptions(raw.options, quote.last)
    : undefined;
  if (!options) warnings.push("options chain unavailable");

  // ─── Fundamentals & dataset completeness warnings ───────────────────────
  const { fundamentals } = raw;
  if (fundamentals.pe === null) warnings.push("PE unavailable");
  if (fundamentals.peg === null) warnings.push("PEG unavailable");
  if (fundamentals.freeCashFlow === null) warnings.push("FCF unavailable");
  if (raw.news.length === 0) warnings.push("no recent news");

  return {
    ticker: quote.ticker,
    asOf: quote.asOf,
    price: {
      last: quote.last,
      change,
      changePct,
      range52w: [quote.range52wLow, quote.range52wHigh],
      volume: quote.volume,
      avgVolume30d: quote.avgVolume30d,
    },
    fundamentals: {
      marketCap: fundamentals.marketCap,
      pe: fundamentals.pe,
      peg: fundamentals.peg,
      pb: fundamentals.pb,
      ev: fundamentals.ev,
      revenue: fundamentals.revenue,
      revenueGrowthYoY: fundamentals.revenueGrowthYoY,
      eps: fundamentals.eps,
      epsGrowthYoY: fundamentals.epsGrowthYoY,
      margins: {
        gross: fundamentals.grossMargin,
        operating: fundamentals.operatingMargin,
        net: fundamentals.netMargin,
      },
      debt: {
        total: fundamentals.totalDebt,
        toEquity: fundamentals.debtToEquity,
      },
      freeCashFlow: fundamentals.freeCashFlow,
      dividendYield: fundamentals.dividendYield,
    },
    indicators,
    options,
    recommendations: raw.recommendations,
    news: raw.news,
    warnings,
  };
}

function computeIndicators(
  raw: RawTickerData,
  warnings: string[],
): IndicatorsSnapshot {
  const rsi14 = computeRsi14(raw.bars);
  const macd = computeMacd(raw.bars);
  const ma50 = computeMovingAverage(raw.bars, 50);
  const ma200 = computeMovingAverage(raw.bars, 200);

  if (rsi14 === null) warnings.push("RSI14 unavailable: need 15+ daily bars");
  if (macd === null) warnings.push("MACD unavailable: need 35+ daily bars");
  if (ma50 === null) warnings.push("MA50 unavailable: need 50+ daily bars");
  if (ma200 === null) warnings.push("MA200 unavailable: need 200+ daily bars");

  let ivRank: number | undefined;
  if (raw.options) {
    const atmIv = computeAtmIv(raw.options.contracts, raw.quote.last);
    if (atmIv !== null) {
      ivRank = computeIvRank(atmIv, raw.options.historicalIv);
    }
  }

  return { rsi14, macd, ma: { ma50, ma200 }, ivRank };
}

function normalizeOptions(
  options: NonNullable<RawTickerData["options"]>,
  spot: number,
): OptionsSnapshot | undefined {
  const nearest = options.contracts.filter(
    (c) => c.expiry === options.nearestExpiry,
  );
  if (nearest.length === 0) return undefined;

  const atmIv = computeAtmIv(nearest, spot) ?? 0;
  const putCallRatio = computePutCallRatio(nearest);
  const topStrikes = pickTopStrikes(nearest);

  return {
    expiries: options.expiries,
    nearestExpiry: {
      expiry: options.nearestExpiry,
      iv: atmIv,
      putCallRatio,
      topStrikes,
    },
  };
}

function computeAtmIv(
  contracts: RawOptionContract[],
  spot: number,
): number | null {
  if (contracts.length === 0) return null;
  // Pick the call closest to ATM as a proxy.
  const calls = contracts.filter((c) => c.type === "call");
  if (calls.length === 0) return null;
  let closest = calls[0]!;
  let bestDist = Math.abs(closest.strike - spot);
  for (const c of calls) {
    const dist = Math.abs(c.strike - spot);
    if (dist < bestDist) {
      bestDist = dist;
      closest = c;
    }
  }
  return closest.iv;
}

function computePutCallRatio(contracts: RawOptionContract[]): number {
  let putVol = 0;
  let callVol = 0;
  for (const c of contracts) {
    if (c.type === "put") putVol += c.volume;
    else callVol += c.volume;
  }
  if (callVol === 0) return putVol === 0 ? 1 : Infinity;
  return putVol / callVol;
}

function pickTopStrikes(contracts: RawOptionContract[]): OptionStrike[] {
  // Keep the top-N by open interest per side.
  const sorted = [...contracts].sort(
    (a, b) => b.openInterest - a.openInterest,
  );
  const calls = sorted.filter((c) => c.type === "call").slice(0, TOP_STRIKE_COUNT);
  const puts = sorted.filter((c) => c.type === "put").slice(0, TOP_STRIKE_COUNT);
  return [...calls, ...puts].map((c) => ({
    strike: c.strike,
    type: c.type,
    bid: c.bid,
    ask: c.ask,
    volume: c.volume,
    openInterest: c.openInterest,
    iv: c.iv,
  }));
}
