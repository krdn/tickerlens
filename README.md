# @krdn/tickerlens

Multi-perspective US stock ticker analysis library. Hand it a ticker, get back a normalized data snapshot plus four expert analyses (Value, Growth, Quant, Options) across three timeframes (Long, Mid, Short).

Built on `@krdn/llm-gateway` for provider-agnostic LLM calls with Zod-validated structured output, and `yahoo-finance2` for free market data. Persona/timeframe pattern lifted from `@krdn/saju`.

## Install

```bash
pnpm add @krdn/tickerlens @krdn/llm-gateway
```

## Quick start

```typescript
import { composeTickerAnalysis, defaultModuleConfig } from '@krdn/tickerlens';
import { createInMemoryModelConfig } from '@krdn/llm-gateway/adapters';

const configAdapter = createInMemoryModelConfig({
  modules: defaultModuleConfig({
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  }),
  providerDefaults: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
});

const result = await composeTickerAnalysis('AAPL', {
  configAdapter,
  depth: 'full', // 'lite' for ~3× cheaper analysis
});

result.snapshot;                       // normalized TickerSnapshot
result.perspectives.value.long;        // Result<PerspectiveResult>
result.perspectives.options.short;
result.meta;                            // { completed, failed, durationMs, depth }
```

## What you get back

`AnalysisResult` is a single object with three sections:

| Field | Description |
|---|---|
| `snapshot` | Normalized `TickerSnapshot` — price, fundamentals, technical indicators, options chain, recommendations, news, and `warnings` for missing fields. |
| `perspectives.<persona>.<timeframe>` | `Result<PerspectiveResult>` — analyst verdict (`signal`, `confidence`, `thesis`, `evidence`, `risks`, `catalysts`) plus persona-specific fields. Failures are isolated per slot (saju `safeFrame` pattern). |
| `meta` | `{ completed, failed, durationMs, depth, totalCostUsd? }` |

## The four personas

| Persona | Voice | Focus |
|---|---|---|
| **value** | Buffett / Graham | Intrinsic value, margin of safety, durable moats, owner earnings |
| **growth** | Lynch / Wood | Secular growth, TAM, PEG, reinvestment runway, disruption |
| **quant** | Technical trader | Trend regimes, RSI/MACD/MA crosses, breakouts, mean reversion |
| **options** | Volatility desk | IV regime, put/call ratio, skew, suggested option structures |

## The three timeframes

- **long** (1+ year) — fundamentals and secular thesis dominate.
- **mid** (1-6 months) — recent earnings, analyst revisions, catalysts.
- **short** (days-weeks) — technicals, IV regime, near-term catalysts.

## depth modes

| Mode | LLM calls | When to use |
|---|---|---|
| `full` (default) | 12 — each (persona × timeframe) cell gets its own focused call | Production analysis, "best possible answer" |
| `lite` | 4 — each persona covers all three timeframes in one response | Cheap demos, batch screens, cost-sensitive flows |

## Custom data adapter

Don't want yfinance? Implement `DataSourceAdapter`:

```typescript
import type { DataSourceAdapter, RawTickerData } from '@krdn/tickerlens/data';

const polygonAdapter: DataSourceAdapter = {
  name: 'polygon',
  async fetch(ticker: string): Promise<RawTickerData> {
    // ...
  },
};

const result = await composeTickerAnalysis('AAPL', {
  configAdapter,
  dataAdapter: polygonAdapter,
});
```

## Subpath exports

```
@krdn/tickerlens             # composeTickerAnalysis + types + defaults
@krdn/tickerlens/data        # DataSourceAdapter + YahooAdapter + indicators
@krdn/tickerlens/analysts    # 12 + 4 AnalysisModule definitions
@krdn/tickerlens/schemas     # Zod schemas (extendable)
@krdn/tickerlens/prompts     # System prompts + user prompt builders
```

## Disclaimer

This library produces algorithmic analyses for research and educational use. Nothing it emits is investment advice. Always do your own due diligence and consider regulatory restrictions in your jurisdiction.

## License

MIT
