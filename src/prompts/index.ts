// @krdn/tickerlens/prompts — system prompts + user prompt builders
//
// Consumers who want to issue their own LLM calls (bypassing
// `composeTickerAnalysis`) can import the prompt builders here.

export { personaSystemPrompt } from "./personas.js";
export type { PersonaName } from "./personas.js";
export { timeframeBrief } from "./timeframes.js";
export type { TimeframeName } from "./timeframes.js";
export { buildUserPrompt } from "./builders.js";
