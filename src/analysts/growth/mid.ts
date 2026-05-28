import { createAnalystModule } from "../factory.js";
import { growthMidSchema, type GrowthMidResult } from "../../schemas/growth.js";

export const growthMid = createAnalystModule<GrowthMidResult>({
  name: "tickerlens.growth.mid",
  displayName: "Growth · Mid-term",
  persona: "growth",
  timeframe: "mid",
  schema: growthMidSchema,
});
