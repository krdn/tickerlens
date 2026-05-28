// Zod schemas for the Growth analyst (Lynch/Wood voice).
// See value.ts for why nullable is preferred over partial.

import { z } from "zod";
import { basePerspectiveSchema } from "./common.js";

const growthFieldsStrict = z.object({
  expectedRevenueCagrPct: z.number(),
  expectedEpsCagrPct: z.number(),
  pegFair: z.number(),
});

const growthFieldsLoose = z.object({
  expectedRevenueCagrPct: z.number().nullable(),
  expectedEpsCagrPct: z.number().nullable(),
  pegFair: z.number().nullable(),
});

export const growthLongSchema = basePerspectiveSchema.extend({
  growthFields: growthFieldsStrict,
});

export const growthMidSchema = basePerspectiveSchema.extend({
  growthFields: growthFieldsLoose,
});

export const growthShortSchema = basePerspectiveSchema.extend({
  growthFields: growthFieldsLoose,
});

export const growthLiteSchema = z.object({
  long: growthLongSchema,
  mid: growthMidSchema,
  short: growthShortSchema,
});

export type GrowthLongResult = z.infer<typeof growthLongSchema>;
export type GrowthMidResult = z.infer<typeof growthMidSchema>;
export type GrowthShortResult = z.infer<typeof growthShortSchema>;
export type GrowthLiteResult = z.infer<typeof growthLiteSchema>;
