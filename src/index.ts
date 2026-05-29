// @krdn/tickerlens — main entry
//
// Public surface:
// - `composeTickerAnalysis` — the one-shot function consumers call.
// - `defaultModuleConfig` — helper that maps the 16 module names to one provider/model.
// - `MODULE_NAMES` — the 16 module-name keys, for consumers wiring per-module configs.
// - `AIProvider` — re-exported from @krdn/llm-gateway so consumers get valid provider values.
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

export { defaultModuleConfig, MODULE_NAMES } from "./compose/defaultModuleConfig.js";
export type { DefaultModuleConfigInput } from "./compose/defaultModuleConfig.js";

export type { AIProvider } from "@krdn/llm-gateway";
