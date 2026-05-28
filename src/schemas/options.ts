// Zod schemas for the Options/Risk analyst (volatility desk voice).
// See value.ts for why nullable is preferred over partial.

import { z } from "zod";
import { basePerspectiveSchema } from "./common.js";

const ivRegimeEnum = z.enum(["high", "neutral", "low"]);

const optionsFieldsStrict = z.object({
  ivRegime: ivRegimeEnum,
  suggestedStructure: z.string().min(10).max(220),
  breakEvens: z.array(z.number()).max(4).nullable(),
});

const optionsFieldsLoose = z.object({
  ivRegime: ivRegimeEnum.nullable(),
  suggestedStructure: z.string().nullable(),
  breakEvens: z.array(z.number()).max(4).nullable(),
});

export const optionsLongSchema = basePerspectiveSchema.extend({
  optionsFields: optionsFieldsLoose,
});

export const optionsMidSchema = basePerspectiveSchema.extend({
  optionsFields: optionsFieldsStrict,
});

export const optionsShortSchema = basePerspectiveSchema.extend({
  optionsFields: optionsFieldsStrict,
});

export const optionsLiteSchema = z.object({
  long: optionsLongSchema,
  mid: optionsMidSchema,
  short: optionsShortSchema,
});

export type OptionsLongResult = z.infer<typeof optionsLongSchema>;
export type OptionsMidResult = z.infer<typeof optionsMidSchema>;
export type OptionsShortResult = z.infer<typeof optionsShortSchema>;
export type OptionsLiteResult = z.infer<typeof optionsLiteSchema>;
