import { createAnalystModule } from "../factory.js";
import { optionsShortSchema, type OptionsShortResult } from "../../schemas/options.js";

export const optionsShort = createAnalystModule<OptionsShortResult>({
  name: "tickerlens.options.short",
  displayName: "Options · Short-term",
  persona: "options",
  timeframe: "short",
  schema: optionsShortSchema,
});
