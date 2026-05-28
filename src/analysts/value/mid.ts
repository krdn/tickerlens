import { createAnalystModule } from "../factory.js";
import { valueMidSchema, type ValueMidResult } from "../../schemas/value.js";

export const valueMid = createAnalystModule<ValueMidResult>({
  name: "tickerlens.value.mid",
  displayName: "Value · Mid-term",
  persona: "value",
  timeframe: "mid",
  schema: valueMidSchema,
});
