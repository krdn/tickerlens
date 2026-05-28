import { createAnalystModule } from "../factory.js";
import { quantLiteSchema, type QuantLiteResult } from "../../schemas/quant.js";

export const quantLite = createAnalystModule<QuantLiteResult>({
  name: "tickerlens.quant.lite",
  displayName: "Quant · All horizons",
  persona: "quant",
  timeframe: "lite",
  schema: quantLiteSchema,
});
