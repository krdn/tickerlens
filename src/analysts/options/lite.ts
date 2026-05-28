import { createAnalystModule } from "../factory.js";
import { optionsLiteSchema, type OptionsLiteResult } from "../../schemas/options.js";

export const optionsLite = createAnalystModule<OptionsLiteResult>({
  name: "tickerlens.options.lite",
  displayName: "Options · All horizons",
  persona: "options",
  timeframe: "lite",
  schema: optionsLiteSchema,
});
