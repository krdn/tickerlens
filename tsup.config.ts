import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "data/index": "src/data/index.ts",
    "analysts/index": "src/analysts/index.ts",
    "schemas/index": "src/schemas/index.ts",
    "prompts/index": "src/prompts/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "node20",
  outDir: "dist",
  external: ["yahoo-finance2", "zod", "@krdn/llm-gateway"],
});
