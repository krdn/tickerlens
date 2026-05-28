# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install           # Install dependencies
pnpm test              # Run all tests (vitest)
pnpm test -- src/data/snapshot.test.ts   # Run a single test file
pnpm typecheck         # tsc --noEmit
pnpm build             # tsup → dist/ (ESM only, multi-subpath)
pnpm lint              # eslint src
```

## What This Is

`@krdn/tickerlens` — a TypeScript library that analyzes a single US stock ticker through four expert personas (Value, Growth, Quant/Momentum, Options/Risk) across three timeframes (Long, Mid, Short). It normalizes raw market data (price, fundamentals, options chain, recommendations, news), computes technical indicators, and runs 12 LLM analysis modules in parallel via `@krdn/llm-gateway`, returning Zod-validated structured results.

Domain vocabulary is in `CONTEXT.md`.

## Architecture

Three layers, each depending only on the one below it (saju pattern).

### 1. Data Core (`src/data/`)

`DataSourceAdapter` is the swap-in interface for raw market data. The default `createYahooAdapter()` uses `yahoo-finance2`. `normalizeSnapshot(raw)` turns provider-specific responses into a `TickerSnapshot`. `indicators.ts` computes RSI14, MACD(12,26,9), MA50/200, and IV percentile from historical bars and option chains.

### 2. Compose (`src/compose/`)

`composeTickerAnalysis(ticker, options)` is the main entry point:

```
resolveContext → fan-out (4 personas × 3 timeframes) → safeFrame → AnalysisResult
```

- `safeFrame()` wraps each analyst call so one persona failure does not break the whole response (saju pattern).
- `Result<T,E>` envelope per persona/timeframe slot.
- `depth: 'full' | 'lite'` routes between 12-module fan-out and 4-module per-persona consolidation.

### 3. Analysts (`src/analysts/`, `src/schemas/`, `src/prompts/`)

Each persona has three timeframe modules: `value/{long,mid,short}.ts`, `growth/{long,mid,short}.ts`, `quant/{long,mid,short}.ts`, `options/{long,mid,short}.ts`. Each module implements `AnalysisModule<TickerSnapshot, PerspectiveResult>` from `@krdn/llm-gateway` — it owns `schema`, `buildPrompt`, `buildSystemPrompt`. Personas share `prompts/personas.ts` (system prompt voice) and `prompts/timeframes.ts` (per-timeframe emphasis).

## Key Design Decisions

- **DataSourceAdapter injection.** The library never imports `yahoo-finance2` at the top level — only via the adapter. Tests use `MockDataSourceAdapter`. Consumers can swap to Polygon, Alpha Vantage, or proprietary feeds.
- **Result<T,E> for compose errors.** `{ ok: true, value: T } | { ok: false, error: TickerlensError }`. Individual persona failures are caught by `safeFrame()` — one persona failing doesn't break the others.
- **LLM gateway delegation.** Token retry, rate-limit backoff, JSON repair, Zod parsing — all delegated to `@krdn/llm-gateway`. tickerlens does not re-implement any of this.
- **Async throughout.** Unlike saju (which is sync because lunar libraries are sync), data fetches and LLM calls are inherently async.
- **Options analyst short-circuits without options data.** If `snapshot.options` is undefined (e.g., ETF without options or ticker that yfinance lacks), the options persona returns `Result.ok:false` with `skipped: true` rather than calling the LLM.

## Test Patterns

- Tests are co-located: `foo.ts` ↔ `foo.test.ts` in the same directory.
- Integration tests in `tests/canonical.test.ts` with fixtures.
- Snapshot fixture: `tests/fixtures/aapl-2026-01-15.json` — captured yahoo response + normalized TickerSnapshot.
- Mocking pattern: `vi.mock` + `MockDataSourceAdapter` + Mock LLM (zod responses canned).
- Live yfinance tests under `tests/integration/yfinance.live.test.ts` — only run when `VITEST_LIVE=1`.
