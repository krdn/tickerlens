// @krdn/tickerlens/schemas — Zod schemas for analyst responses
//
// One file per persona. `common.ts` exposes shared building blocks
// (signal enum, evidence, base perspective schema).

export {
  signalSchema,
  evidenceSchema,
  basePerspectiveSchema,
} from "./common.js";

export {
  valueLongSchema,
  valueMidSchema,
  valueShortSchema,
  valueLiteSchema,
} from "./value.js";
export type {
  ValueLongResult,
  ValueMidResult,
  ValueShortResult,
  ValueLiteResult,
} from "./value.js";

export {
  growthLongSchema,
  growthMidSchema,
  growthShortSchema,
  growthLiteSchema,
} from "./growth.js";
export type {
  GrowthLongResult,
  GrowthMidResult,
  GrowthShortResult,
  GrowthLiteResult,
} from "./growth.js";

export {
  quantLongSchema,
  quantMidSchema,
  quantShortSchema,
  quantLiteSchema,
} from "./quant.js";
export type {
  QuantLongResult,
  QuantMidResult,
  QuantShortResult,
  QuantLiteResult,
} from "./quant.js";

export {
  optionsLongSchema,
  optionsMidSchema,
  optionsShortSchema,
  optionsLiteSchema,
} from "./options.js";
export type {
  OptionsLongResult,
  OptionsMidResult,
  OptionsShortResult,
  OptionsLiteResult,
} from "./options.js";
