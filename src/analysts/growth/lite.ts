import { createAnalystModule } from "../factory.js";
import { growthLiteSchema, type GrowthLiteResult } from "../../schemas/growth.js";

export const growthLite = createAnalystModule<GrowthLiteResult>({
  name: "tickerlens.growth.lite",
  displayName: "Growth · All horizons",
  persona: "growth",
  timeframe: "lite",
  schema: growthLiteSchema,
});
