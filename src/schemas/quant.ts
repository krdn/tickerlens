// Zod schemas for the Quant/Momentum analyst (technical trader voice).
// See value.ts for why nullable is preferred over partial.

import { z } from "zod";
import { basePerspectiveSchema } from "./common.js";

const trendEnum = z.enum(["up", "down", "sideways"]);

const quantFieldsStrict = z.object({
  trend: trendEnum,
  momentumScore: z.number().min(-100).max(100),
  overbought: z.boolean(),
  oversold: z.boolean(),
});

const quantFieldsLoose = z.object({
  trend: trendEnum.nullable(),
  momentumScore: z.number().min(-100).max(100).nullable(),
  overbought: z.boolean().nullable(),
  oversold: z.boolean().nullable(),
});

export const quantLongSchema = basePerspectiveSchema.extend({
  quantFields: quantFieldsLoose,
});

export const quantMidSchema = basePerspectiveSchema.extend({
  quantFields: quantFieldsStrict,
});

export const quantShortSchema = basePerspectiveSchema.extend({
  quantFields: quantFieldsStrict,
});

export const quantLiteSchema = z.object({
  long: quantLongSchema,
  mid: quantMidSchema,
  short: quantShortSchema,
});

export type QuantLongResult = z.infer<typeof quantLongSchema>;
export type QuantMidResult = z.infer<typeof quantMidSchema>;
export type QuantShortResult = z.infer<typeof quantShortSchema>;
export type QuantLiteResult = z.infer<typeof quantLiteSchema>;
