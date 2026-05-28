import { createAnalystModule } from "../factory.js";
import { quantLongSchema, type QuantLongResult } from "../../schemas/quant.js";

export const quantLong = createAnalystModule<QuantLongResult>({
  name: "tickerlens.quant.long",
  displayName: "Quant · Long-term",
  persona: "quant",
  timeframe: "long",
  schema: quantLongSchema,
});
