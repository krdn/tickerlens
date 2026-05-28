// defaultModuleConfig — convenience helper that maps all 16 module names
// (12 full + 4 lite) to a single provider/model. Consumers can edit individual
// entries before passing the result to createInMemoryModelConfig().

import type { AIProvider } from "@krdn/llm-gateway";

export interface DefaultModuleConfigInput {
  provider: AIProvider;
  model: string;
}

const MODULE_NAMES = [
  "tickerlens.value.long",
  "tickerlens.value.mid",
  "tickerlens.value.short",
  "tickerlens.value.lite",
  "tickerlens.growth.long",
  "tickerlens.growth.mid",
  "tickerlens.growth.short",
  "tickerlens.growth.lite",
  "tickerlens.quant.long",
  "tickerlens.quant.mid",
  "tickerlens.quant.short",
  "tickerlens.quant.lite",
  "tickerlens.options.long",
  "tickerlens.options.mid",
  "tickerlens.options.short",
  "tickerlens.options.lite",
] as const;

export function defaultModuleConfig(
  input: DefaultModuleConfigInput,
): Record<string, { provider: AIProvider; model: string }> {
  const config: Record<string, { provider: AIProvider; model: string }> = {};
  for (const name of MODULE_NAMES) {
    config[name] = { provider: input.provider, model: input.model };
  }
  return config;
}

export { MODULE_NAMES };
