import { createAnalystModule } from "../factory.js";
import { quantShortSchema, type QuantShortResult } from "../../schemas/quant.js";

export const quantShort = createAnalystModule<QuantShortResult>({
  name: "tickerlens.quant.short",
  displayName: "Quant · Short-term",
  persona: "quant",
  timeframe: "short",
  schema: quantShortSchema,
});
