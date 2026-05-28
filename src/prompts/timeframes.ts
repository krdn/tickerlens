// Per-timeframe emphasis briefs — appended to the user prompt to focus the
// LLM on the right horizon-specific signals.

export type TimeframeName = "long" | "mid" | "short" | "lite";

const LONG = `Horizon: 1 year or longer. Emphasize fundamentals, moat durability,
secular thesis, capital allocation, and through-cycle margins. Discount
short-term price noise. Risks should be structural (competition, regulation,
disruption) rather than transient.`;

const MID = `Horizon: 1 to 6 months. Emphasize the most recent earnings, analyst
revisions, sector rotation, near-term catalysts (product launches, regulatory
decisions, FOMC), and any change in the consensus narrative. Both fundamental
and technical signals matter.`;

const SHORT = `Horizon: days to a few weeks. Emphasize technicals (RSI, MACD,
MA crosses, range position), IV regime, volume, and very near-term catalysts
(earnings calendar, ex-div, FOMC, geopolitical events). De-emphasize anything
that wouldn't move price inside the window.`;

const LITE = `Cover all three horizons (long: 1y+, mid: 1-6mo, short: days-weeks)
in a single response under the schema's long/mid/short keys. Each horizon
follows the emphasis rules described in their dedicated briefs.`;

const TABLE: Record<TimeframeName, string> = {
  long: LONG,
  mid: MID,
  short: SHORT,
  lite: LITE,
};

export function timeframeBrief(timeframe: TimeframeName): string {
  return TABLE[timeframe];
}
