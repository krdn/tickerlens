// resolveContext — single place where raw data is fetched and normalized.
//
// Mirrors saju's compose/resolveChartContext.ts pattern: a thin async entry
// that all higher-level compose functions can rely on for snapshot input.

import type { DataSourceAdapter } from "../data/adapter.js";
import { normalizeSnapshot } from "../data/snapshot.js";
import type { TickerSnapshot, TickerlensError } from "../types.js";

export interface ResolveContextResult {
  snapshot: TickerSnapshot;
}

export class DataFetchError extends Error implements TickerlensError {
  readonly code = "DATA_FETCH_FAILED" as const;
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DataFetchError";
  }
}

export async function resolveContext(
  ticker: string,
  adapter: DataSourceAdapter,
): Promise<ResolveContextResult> {
  let raw;
  try {
    raw = await adapter.fetch(ticker);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new DataFetchError(
      `[${adapter.name}] failed to fetch ${ticker}: ${detail}`,
      err,
    );
  }
  const snapshot = normalizeSnapshot(raw);
  return { snapshot };
}
