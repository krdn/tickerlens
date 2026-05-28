// @krdn/tickerlens/data — public surface for data layer
//
// Consumers who only need raw normalized snapshots (no LLM analysis) import
// from here. Also re-exported when consumers want to inject a custom adapter.

export type { DataSourceAdapter, RawTickerData } from "./adapter.js";
export { createYahooAdapter } from "./yahoo.js";
export { normalizeSnapshot } from "./snapshot.js";
export {
  computeRsi14,
  computeMacd,
  computeMovingAverage,
  computeIvRank,
} from "./indicators.js";
