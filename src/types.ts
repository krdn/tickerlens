// @krdn/tickerlens — public types
//
// Three layers (data, compose, analysts) all consume the same canonical types
// declared here. Layer-specific local types live next to their modules.

export type Result<T, E = TickerlensError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface TickerlensError {
  code:
    | "DATA_FETCH_FAILED"
    | "ANALYSIS_FAILED"
    | "ANALYSIS_SKIPPED"
    | "INVALID_RESPONSE"
    | "UNKNOWN";
  message: string;
  cause?: unknown;
}

// ─── Layer 1: TickerSnapshot ────────────────────────────────────────────────

export interface PriceSnapshot {
  last: number;
  change: number;
  changePct: number;
  range52w: [number, number];
  volume: number;
  avgVolume30d?: number;
}

export interface FundamentalsSnapshot {
  marketCap: number;
  pe: number | null;
  peg: number | null;
  pb: number | null;
  ev: number | null;
  revenue: number;
  revenueGrowthYoY: number | null;
  eps: number | null;
  epsGrowthYoY: number | null;
  margins: {
    gross: number | null;
    operating: number | null;
    net: number | null;
  };
  debt: {
    total: number;
    toEquity: number | null;
  };
  freeCashFlow: number | null;
  dividendYield: number | null;
}

export interface IndicatorsSnapshot {
  rsi14: number | null;
  macd: { line: number; signal: number; hist: number } | null;
  ma: { ma50: number | null; ma200: number | null };
  ivRank?: number;
}

export interface OptionStrike {
  strike: number;
  type: "call" | "put";
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  iv: number;
}

export interface OptionsSnapshot {
  expiries: string[]; // ISO dates of available expirations
  nearestExpiry: {
    expiry: string;
    iv: number; // ATM IV
    putCallRatio: number;
    topStrikes: OptionStrike[];
  };
}

export interface RecommendationsSnapshot {
  rating: "buy" | "hold" | "sell" | "underperform" | "outperform";
  analystCount: number;
  targetMean: number;
  targetHigh: number;
  targetLow: number;
}

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string; // ISO
  url: string;
  summary?: string;
}

export interface TickerSnapshot {
  ticker: string;
  asOf: string; // ISO timestamp the snapshot was assembled
  price: PriceSnapshot;
  fundamentals: FundamentalsSnapshot;
  indicators: IndicatorsSnapshot;
  options?: OptionsSnapshot;
  recommendations: RecommendationsSnapshot;
  news: NewsItem[];
  warnings: string[]; // missing fields, stale data, etc.
}

// ─── Layer 3: Persona analysis result ───────────────────────────────────────

export type Signal =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell";

export interface Evidence {
  label: string;
  value: string;
}

export interface PerspectiveResult {
  signal: Signal;
  confidence: number; // 0–100
  thesis: string;
  evidence: Evidence[];
  risks: string[];
  catalysts: string[];

  // Persona-specific extension fields. Each is optional at the persona level
  // (only the relevant persona populates one), and every sub-field is nullable
  // so OpenAI strict structured-output accepts the schema. When the LLM has
  // no concrete value (no FCF, no chain), it returns null instead of fabricating.
  valueFields?: {
    fairValueLow: number | null;
    fairValueHigh: number | null;
    marginOfSafetyPct: number | null;
  };
  growthFields?: {
    expectedRevenueCagrPct: number | null;
    expectedEpsCagrPct: number | null;
    pegFair: number | null;
  };
  quantFields?: {
    trend: "up" | "down" | "sideways" | null;
    momentumScore: number | null;
    overbought: boolean | null;
    oversold: boolean | null;
  };
  optionsFields?: {
    ivRegime: "high" | "neutral" | "low" | null;
    suggestedStructure: string | null;
    breakEvens: number[] | null;
  };
}

// ─── Layer 2: Composed result ──────────────────────────────────────────────

export type Persona = "value" | "growth" | "quant" | "options";
export type Timeframe = "long" | "mid" | "short";

export type PerspectiveSlot = Result<PerspectiveResult>;

export interface PersonaSlots {
  long: PerspectiveSlot;
  mid: PerspectiveSlot;
  short: PerspectiveSlot;
}

export interface AnalysisResult {
  ticker: string;
  asOf: string;
  snapshot: TickerSnapshot;
  perspectives: {
    value: PersonaSlots;
    growth: PersonaSlots;
    quant: PersonaSlots;
    options: PersonaSlots;
  };
  meta: {
    completed: number;
    failed: number;
    durationMs: number;
    depth: "full" | "lite";
    totalCostUsd?: number;
  };
}
