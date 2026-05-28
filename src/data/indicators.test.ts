import { describe, expect, it } from "vitest";
import {
  computeIvRank,
  computeMacd,
  computeMovingAverage,
  computeRsi14,
} from "./indicators.js";
import type { DailyBar } from "./adapter.js";

const bar = (close: number, date = "2026-01-01"): DailyBar => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1_000_000,
});

const trendBars = (start: number, step: number, n: number): DailyBar[] =>
  Array.from({ length: n }, (_, i) => bar(start + step * i));

describe("computeRsi14", () => {
  it("returns null when fewer than 15 bars", () => {
    expect(computeRsi14(trendBars(100, 1, 14))).toBeNull();
  });

  it("returns 100 for a pure uptrend (no losses)", () => {
    expect(computeRsi14(trendBars(100, 1, 20))).toBe(100);
  });

  it("falls below 50 on a fresh downtrend", () => {
    const downBars = trendBars(200, -1, 20);
    const value = computeRsi14(downBars);
    expect(value).not.toBeNull();
    expect(value!).toBeLessThan(50);
  });
});

describe("computeMacd", () => {
  it("returns null when fewer than slow+signal bars", () => {
    expect(computeMacd(trendBars(100, 1, 30))).toBeNull();
  });

  it("returns finite line/signal/hist on sufficient bars", () => {
    const result = computeMacd(trendBars(100, 1, 60));
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.line)).toBe(true);
    expect(Number.isFinite(result!.signal)).toBe(true);
    expect(Number.isFinite(result!.hist)).toBe(true);
  });

  it("line > 0 on a steady uptrend (fast EMA leads slow EMA)", () => {
    const result = computeMacd(trendBars(100, 1, 60));
    expect(result).not.toBeNull();
    expect(result!.line).toBeGreaterThan(0);
  });

  it("line < 0 on a steady downtrend (fast EMA trails slow EMA)", () => {
    const result = computeMacd(trendBars(300, -1, 60));
    expect(result).not.toBeNull();
    expect(result!.line).toBeLessThan(0);
  });

  it("crosses sign when trend reverses", () => {
    // 30 bars up at +1, then 30 bars sharp down at -3
    const up = trendBars(100, 1, 30);
    const down = Array.from({ length: 30 }, (_, i) =>
      bar(130 - i * 3, `2026-02-${String((i % 28) + 1).padStart(2, "0")}`),
    );
    const result = computeMacd([...up, ...down]);
    expect(result).not.toBeNull();
    // After a sharp reversal, line should be negative.
    expect(result!.line).toBeLessThan(0);
  });
});

describe("computeMovingAverage", () => {
  it("returns null when fewer bars than period", () => {
    expect(computeMovingAverage(trendBars(100, 1, 5), 50)).toBeNull();
  });

  it("matches arithmetic mean of last N closes", () => {
    const bars = trendBars(100, 1, 60);
    // last 50 closes: 110, 111, ..., 159 → mean = 134.5
    expect(computeMovingAverage(bars, 50)).toBeCloseTo(134.5, 5);
  });
});

describe("computeIvRank", () => {
  it("returns undefined for missing or short history", () => {
    expect(computeIvRank(0.3, undefined)).toBeUndefined();
    expect(computeIvRank(0.3, [0.2, 0.3, 0.4])).toBeUndefined();
  });

  it("places current IV at correct percentile", () => {
    const history = Array.from({ length: 50 }, (_, i) => 0.1 + i * 0.01);
    // history: 0.10..0.59. current = 0.35 → (0.35-0.10)/(0.59-0.10) ≈ 51.02
    expect(computeIvRank(0.35, history)).toBeCloseTo(51.02, 1);
  });

  it("returns 50 when history is flat", () => {
    const flat = Array.from({ length: 30 }, () => 0.25);
    expect(computeIvRank(0.25, flat)).toBe(50);
  });
});
