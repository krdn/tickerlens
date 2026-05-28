import { createAnalystModule } from "../factory.js";
import { optionsLongSchema, type OptionsLongResult } from "../../schemas/options.js";

export const optionsLong = createAnalystModule<OptionsLongResult>({
  name: "tickerlens.options.long",
  displayName: "Options · Long-term",
  persona: "options",
  timeframe: "long",
  schema: optionsLongSchema,
});
