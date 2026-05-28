import { createAnalystModule } from "../factory.js";
import { optionsMidSchema, type OptionsMidResult } from "../../schemas/options.js";

export const optionsMid = createAnalystModule<OptionsMidResult>({
  name: "tickerlens.options.mid",
  displayName: "Options · Mid-term",
  persona: "options",
  timeframe: "mid",
  schema: optionsMidSchema,
});
