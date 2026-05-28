# CONTEXT.md — Domain Vocabulary

## Personas (analyst voices)

| Persona | Voice | Primary data |
|---|---|---|
| **value** | Buffett / Graham — intrinsic value, margin of safety, durable competitive moats, owner earnings | fundamentals, free cash flow, P/E, P/B, debt, margins |
| **growth** | Lynch / Wood — secular growth, TAM, PEG, reinvestment runway, disruption | revenue growth YoY, EPS growth, PEG, sector tailwinds |
| **quant** | Technical / momentum trader — trend, mean-reversion, breakouts, regime | RSI, MACD, MA50/200 crosses, volume, 52w range |
| **options** | Volatility / hedging desk — IV rank, skew, term structure, put/call ratio | options chain, IV, put/call ratio, suggested structures |

## Timeframes

| Timeframe | Horizon | Emphasis |
|---|---|---|
| **long** | 1+ year | Fundamentals, moat, secular thesis, capital allocation |
| **mid** | 1-6 months | Recent earnings, analyst revisions, catalysts, sector rotation |
| **short** | days to weeks | Technicals, IV regime, near-term catalysts (earnings, FOMC, ex-div) |

## Core financial terms

- **PE (P/E ratio)** — Price / trailing 12-month EPS. Higher = more expensive per dollar of earnings.
- **PEG** — P/E divided by EPS growth rate. < 1 traditionally signals undervalued growth.
- **PB (P/B ratio)** — Price / book value per share. Sub-1 often signals deep value (or distress).
- **EV** — Enterprise Value = market cap + debt − cash. The "takeover price."
- **Free Cash Flow (FCF)** — Operating cash flow minus capex. The cash an owner could extract.
- **Margins** — gross / operating / net = profitability at three layers of the income statement.

## Technical indicators

- **RSI14** — Relative Strength Index over 14 periods. > 70 overbought, < 30 oversold.
- **MACD(12,26,9)** — Moving Average Convergence Divergence. Line crossing above signal = bullish.
- **MA50 / MA200** — Simple moving averages. Price above both = uptrend. MA50 crossing above MA200 = "golden cross."
- **52w range** — high and low over trailing 52 weeks. Position within range signals momentum.

## Options terms

- **IV (Implied Volatility)** — Market-implied expected volatility from option premiums.
- **IV Rank / IV Percentile** — Current IV vs trailing year. High IV rank = expensive options (sell premium); low = cheap (buy premium).
- **Put/Call Ratio** — Volume of puts / volume of calls. > 1 = bearish sentiment / hedging.
- **Top strikes** — Highest open-interest strikes near the money. Implied support/resistance.
- **Suggested structure** — e.g., "sell 30-delta put", "buy ATM straddle", "collar at +5%/−5%".

## Output vocabulary

- **signal** ∈ {`strong_buy`, `buy`, `hold`, `sell`, `strong_sell`} — directional verdict.
- **confidence** ∈ [0, 100] — how sure the persona is, given available evidence.
- **thesis** — 2-4 sentence core argument from the persona's perspective.
- **evidence** — `{ label, value }[]` — concrete data points backing the thesis.
- **risks** — what would invalidate the thesis.
- **catalysts** — upcoming events that could move the thesis up or down.

## depth modes

- **full** (default, 12 calls) — each (persona × timeframe) cell gets its own LLM call with focused prompt and tighter Zod schema.
- **lite** (4 calls) — each persona gets one call that covers all three timeframes in a single response. ~3× cheaper, slightly more variance.
