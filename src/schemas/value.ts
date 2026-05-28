// Zod schemas for the Value analyst (Buffett/Graham voice).
//
// OpenAI strict structured-output rejects schemas where any property is
// optional. So instead of `.partial()` / `.optional()`, we mark unknowable
// fields nullable. The LLM returns `null` when it can't infer (e.g., no FCF
// available), which matches the persona prompt's "never invent data" rule.

import { z } from "zod";
import { basePerspectiveSchema } from "./common.js";

const valueFieldsStrict = z.object({
  fairValueLow: z.number(),
  fairValueHigh: z.number(),
  marginOfSafetyPct: z.number(),
});

const valueFieldsLoose = z.object({
  fairValueLow: z.number().nullable(),
  fairValueHigh: z.number().nullable(),
  marginOfSafetyPct: z.number().nullable(),
});

export const valueLongSchema = basePerspectiveSchema.extend({
  valueFields: valueFieldsStrict,
});

export const valueMidSchema = basePerspectiveSchema.extend({
  valueFields: valueFieldsLoose,
});

export const valueShortSchema = basePerspectiveSchema.extend({
  valueFields: valueFieldsLoose,
});

export const valueLiteSchema = z.object({
  long: valueLongSchema,
  mid: valueMidSchema,
  short: valueShortSchema,
});

export type ValueLongResult = z.infer<typeof valueLongSchema>;
export type ValueMidResult = z.infer<typeof valueMidSchema>;
export type ValueShortResult = z.infer<typeof valueShortSchema>;
export type ValueLiteResult = z.infer<typeof valueLiteSchema>;
