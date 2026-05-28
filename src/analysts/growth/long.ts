import { createAnalystModule } from "../factory.js";
import { growthLongSchema, type GrowthLongResult } from "../../schemas/growth.js";

export const growthLong = createAnalystModule<GrowthLongResult>({
  name: "tickerlens.growth.long",
  displayName: "Growth · Long-term",
  persona: "growth",
  timeframe: "long",
  schema: growthLongSchema,
});
