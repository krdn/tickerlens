# Changelog

All notable changes to `@krdn/tickerlens`.

## 0.1.0 — 2026-05-28

Initial release. Pre-1.0 — public API may still shift.

### Added

- `composeTickerAnalysis(ticker, { configAdapter, depth })` — main entry point.
- `DataSourceAdapter` interface + `createYahooAdapter()` default implementation.
- Snapshot normalization (`TickerSnapshot`) covering price, fundamentals, indicators (RSI14, MACD, MA50/200, IV rank), options chain (nearest expiry + top strikes + put/call ratio), analyst recommendations, and news.
- Four expert personas (Value, Growth, Quant, Options) × three timeframes (Long, Mid, Short) = 12 `AnalysisModule` definitions, plus 4 lite-mode consolidated modules.
- Multi-subpath exports: `@krdn/tickerlens/{data,analysts,schemas,prompts}`.
- `safeFrame` partial-failure pattern lifted from `@krdn/saju`.
- `depth: 'full' | 'lite'` switch — 12 vs 4 LLM calls per ticker.
- Auto-skip behavior for the options persona when the chain is unavailable.
- `defaultModuleConfig` helper for one-line ModelConfigAdapter setup.
- vitest tests for indicators, snapshot normalization, and compose fan-out.
- Example: `examples/analyze-aapl.ts`.
