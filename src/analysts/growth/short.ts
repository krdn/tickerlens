import { createAnalystModule } from "../factory.js";
import { growthShortSchema, type GrowthShortResult } from "../../schemas/growth.js";

export const growthShort = createAnalystModule<GrowthShortResult>({
  name: "tickerlens.growth.short",
  displayName: "Growth · Short-term",
  persona: "growth",
  timeframe: "short",
  schema: growthShortSchema,
});
