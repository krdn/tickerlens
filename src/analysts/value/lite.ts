import { createAnalystModule } from "../factory.js";
import { valueLiteSchema, type ValueLiteResult } from "../../schemas/value.js";

export const valueLite = createAnalystModule<ValueLiteResult>({
  name: "tickerlens.value.lite",
  displayName: "Value · All horizons",
  persona: "value",
  timeframe: "lite",
  schema: valueLiteSchema,
});
