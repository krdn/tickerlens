// DataSourceAdapter — provider-agnostic interface for raw ticker data.
//
// The default implementation in `yahoo.ts` wraps `yahoo-finance2`. Consumers
// can implement this interface against Polygon, Alpha Vantage, IEX, or any
// proprietary feed without touching the rest of the library.

import type { NewsItem } from "../types.js";

/** Daily OHLCV bar — the smallest unit indicators consume. */
export interface DailyBar {
  date: string; // ISO date "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Single option contract row from a provider chain. */
export interface RawOptionContract {
  strike: number;
  type: "call" | "put";
  expiry: string; // ISO date
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  iv: number; // 0–1
}

/** Snapshot of analyst consensus ratings + price targets. */
export interface RawRecommendations {
  rating: "buy" | "hold" | "sell" | "underperform" | "outperform";
  analystCount: number;
  targetMean: number;
  targetHigh: number;
  targetLow: number;
}

/** Fundamental snapshot pulled from the provider quote summary. */
export interface RawFundamentals {
  marketCap: number;
  pe: number | null;
  peg: number | null;
  pb: number | null;
  ev: number | null;
  revenue: number;
  revenueGrowthYoY: number | null;
  eps: number | null;
  epsGrowthYoY: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  totalDebt: number;
  debtToEquity: number | null;
  freeCashFlow: number | null;
  dividendYield: number | null;
}

/** Quote snapshot — last price, change, volume, 52-week range. */
export interface RawQuote {
  ticker: string;
  last: number;
  previousClose: number;
  range52wLow: number;
  range52wHigh: number;
  volume: number;
  avgVolume30d?: number;
  asOf: string; // ISO timestamp
}

/** Everything a single ticker fetch returns. */
export interface RawTickerData {
  quote: RawQuote;
  fundamentals: RawFundamentals;
  bars: DailyBar[]; // trailing ~260 daily bars (≥ 200 for MA200)
  options?: {
    expiries: string[];
    nearestExpiry: string;
    contracts: RawOptionContract[];
    historicalIv?: number[]; // trailing IV history for ivRank
  };
  recommendations: RawRecommendations;
  news: NewsItem[];
}

/**
 * Provider-agnostic ticker data adapter.
 *
 * Implementations should never throw for missing optional data (options chain,
 * news, ivRank). Throw only for hard failures (ticker not found, network error).
 */
export interface DataSourceAdapter {
  /** Provider identifier used in warnings/logs (e.g., "yahoo", "polygon"). */
  readonly name: string;
  /** Fetch everything we know how to ask for. */
  fetch(ticker: string): Promise<RawTickerData>;
}
