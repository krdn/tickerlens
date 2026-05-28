import { createAnalystModule } from "../factory.js";
import { valueShortSchema, type ValueShortResult } from "../../schemas/value.js";

export const valueShort = createAnalystModule<ValueShortResult>({
  name: "tickerlens.value.short",
  displayName: "Value · Short-term",
  persona: "value",
  timeframe: "short",
  schema: valueShortSchema,
});
