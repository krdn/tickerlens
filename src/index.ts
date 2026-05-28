// @krdn/tickerlens — main entry
//
// Public surface:
// - `composeTickerAnalysis` — the one-shot function consumers call.
// - `defaultModuleConfig` — helper that maps the 12 module names to one provider/model.
// - All public types (`TickerSnapshot`, `AnalysisResult`, `PerspectiveResult`, …).
//
// Sub-path exports under `/data`, `/analysts`, `/schemas`, `/prompts` carry the
// concrete implementations so consumers tree-shake what they don't use.

export type * from "./types.js";

export { composeTickerAnalysis } from "./compose/tickerAnalysis.js";
export type {
  ComposeTickerAnalysisOptions,
  ComposeDepth,
} from "./compose/tickerAnalysis.js";

export { defaultModuleConfig } from "./compose/defaultModuleConfig.js";
export type { DefaultModuleConfigInput } from "./compose/defaultModuleConfig.js";
