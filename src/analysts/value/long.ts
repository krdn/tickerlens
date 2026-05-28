import { createAnalystModule } from "../factory.js";
import { valueLongSchema, type ValueLongResult } from "../../schemas/value.js";

export const valueLong = createAnalystModule<ValueLongResult>({
  name: "tickerlens.value.long",
  displayName: "Value · Long-term",
  persona: "value",
  timeframe: "long",
  schema: valueLongSchema,
});
