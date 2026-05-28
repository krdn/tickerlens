// Shared Zod schema building blocks for analyst responses.
//
// Each persona's schema extends `basePerspectiveSchema` with persona-specific
// fields (fair value, momentum score, IV regime, ...). Keeping common shape
// here keeps the runner's downstream handling uniform.

import { z } from "zod";

export const signalSchema = z.enum([
  "strong_buy",
  "buy",
  "hold",
  "sell",
  "strong_sell",
]);

export const evidenceSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(200),
});

export const basePerspectiveSchema = z.object({
  signal: signalSchema,
  confidence: z.number().int().min(0).max(100),
  thesis: z.string().min(40).max(800),
  evidence: z.array(evidenceSchema).min(1).max(8),
  risks: z.array(z.string().min(5).max(160)).min(1).max(6),
  catalysts: z.array(z.string().min(5).max(160)).min(0).max(6),
});
