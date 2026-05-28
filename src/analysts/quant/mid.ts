import { createAnalystModule } from "../factory.js";
import { quantMidSchema, type QuantMidResult } from "../../schemas/quant.js";

export const quantMid = createAnalystModule<QuantMidResult>({
  name: "tickerlens.quant.mid",
  displayName: "Quant · Mid-term",
  persona: "quant",
  timeframe: "mid",
  schema: quantMidSchema,
});
