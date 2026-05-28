// Technical indicators — pure functions over daily-bar arrays.
//
// All functions are total: they never throw. When there aren't enough bars to
// produce the requested indicator, they return `null` and the snapshot layer
// surfaces that as a warning rather than failing the whole fetch.

import type { DailyBar } from "./adapter.js";

const closes = (bars: DailyBar[]): number[] => bars.map((b) => b.close);

/**
 * Relative Strength Index — Wilder's smoothing method, 14-period default.
 * Returns null if fewer than `period + 1` bars supplied.
 */
export function computeRsi14(bars: DailyBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const prices = closes(bars);

  let avgGain = 0;
  let avgLoss = 0;

  // Seed average over the first `period` changes.
  for (let i = 1; i <= period; i++) {
    const change = prices[i]! - prices[i - 1]!;
    if (change >= 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder smoothing for the rest.
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i]! - prices[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Exponential moving average over `prices`, returning the EMA series aligned
 * to `prices` (the first `period - 1` entries are seed-SMA based).
 */
function ema(prices: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += prices[j]!;
      prev = sum / period;
      out.push(prev);
      continue;
    }
    const value = prices[i]! * k + prev * (1 - k);
    out.push(value);
    prev = value;
  }
  return out;
}

export interface MacdResult {
  line: number;
  signal: number;
  hist: number;
}

/**
 * MACD(fast, slow, signal) — defaults (12, 26, 9). Returns the most recent
 * line/signal/hist triple. Null if insufficient bars (< slow + signal).
 */
export function computeMacd(
  bars: DailyBar[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdResult | null {
  if (bars.length < slow + signalPeriod) return null;
  const prices = closes(bars);
  const fastEma = ema(prices, fast);
  const slowEma = ema(prices, slow);
  const macdLine = fastEma.map((f, i) => f - slowEma[i]!);

  // Drop NaN prefix before computing signal EMA.
  const validStart = slow - 1;
  const macdValid = macdLine.slice(validStart);
  const signalSeries = ema(macdValid, signalPeriod);

  const line = macdLine[macdLine.length - 1]!;
  const signal = signalSeries[signalSeries.length - 1]!;
  return { line, signal, hist: line - signal };
}

/**
 * Simple moving average of the last `period` closes. Null if fewer bars.
 */
export function computeMovingAverage(
  bars: DailyBar[],
  period: number,
): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  let sum = 0;
  for (const b of slice) sum += b.close;
  return sum / period;
}

/**
 * IV Rank — where current IV sits within its trailing history, 0–100.
 * Returns undefined if history is missing or too short (< 20 entries).
 */
export function computeIvRank(
  currentIv: number,
  history: number[] | undefined,
): number | undefined {
  if (!history || history.length < 20) return undefined;
  const min = Math.min(...history);
  const max = Math.max(...history);
  if (max === min) return 50;
  return ((currentIv - min) / (max - min)) * 100;
}
