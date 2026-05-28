// @krdn/tickerlens/analysts — 12 AnalysisModule definitions + 4 lite modules
//
// Each module implements `AnalysisModule<TickerSnapshot, PerspectiveResult>`
// from @krdn/llm-gateway. Consumers can import individual modules for ad-hoc
// runs, or use `composeTickerAnalysis` from the root entry to fan-out all 12.

export { valueLong } from "./value/long.js";
export { valueMid } from "./value/mid.js";
export { valueShort } from "./value/short.js";
export { valueLite } from "./value/lite.js";

export { growthLong } from "./growth/long.js";
export { growthMid } from "./growth/mid.js";
export { growthShort } from "./growth/short.js";
export { growthLite } from "./growth/lite.js";

export { quantLong } from "./quant/long.js";
export { quantMid } from "./quant/mid.js";
export { quantShort } from "./quant/short.js";
export { quantLite } from "./quant/lite.js";

export { optionsLong } from "./options/long.js";
export { optionsMid } from "./options/mid.js";
export { optionsShort } from "./options/short.js";
export { optionsLite } from "./options/lite.js";
