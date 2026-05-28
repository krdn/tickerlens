// User prompt builder — assembles the snapshot, persona-relevant slice,
// timeframe emphasis, and schema reminder into a single user message.
//
// Each AnalysisModule's buildPrompt() calls this. Keeping the assembly here
// avoids the 12 modules drifting in how they describe the same snapshot.

import type { TickerSnapshot } from "../types.js";
import type { PersonaName } from "./personas.js";
import type { TimeframeName } from "./timeframes.js";
import { timeframeBrief } from "./timeframes.js";

export interface BuildUserPromptInput {
  snapshot: TickerSnapshot;
  persona: PersonaName;
  timeframe: TimeframeName;
}

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const { snapshot, persona, timeframe } = input;
  const slice = personaSlice(snapshot, persona);
  const brief = timeframeBrief(timeframe);

  return [
    `Ticker: ${snapshot.ticker}`,
    `As of: ${snapshot.asOf}`,
    "",
    brief,
    "",
    "Snapshot data (only quote values you can see below):",
    "```json",
    JSON.stringify(slice, null, 2),
    "```",
    "",
    snapshot.warnings.length > 0
      ? `Known data gaps: ${snapshot.warnings.join("; ")}`
      : "No known data gaps.",
    "",
    `Now produce the JSON object that matches the response schema for a ${persona} analyst at the ${timeframe} timeframe.`,
  ].join("\n");
}

/**
 * Strip the snapshot to fields each persona actually uses. Saves tokens and
 * focuses the model on the right signal.
 */
function personaSlice(snapshot: TickerSnapshot, persona: PersonaName) {
  const base = {
    ticker: snapshot.ticker,
    asOf: snapshot.asOf,
    price: snapshot.price,
  };

  switch (persona) {
    case "value":
      return {
        ...base,
        fundamentals: snapshot.fundamentals,
        recommendations: snapshot.recommendations,
        news: snapshot.news.slice(0, 4),
      };
    case "growth":
      return {
        ...base,
        fundamentals: snapshot.fundamentals,
        recommendations: snapshot.recommendations,
        news: snapshot.news.slice(0, 6),
      };
    case "quant":
      return {
        ...base,
        indicators: snapshot.indicators,
      };
    case "options":
      return {
        ...base,
        indicators: { ivRank: snapshot.indicators.ivRank },
        options: snapshot.options,
      };
  }
}
