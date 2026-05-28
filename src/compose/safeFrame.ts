// safeFrame — wrap a single analyst call so a single failure does not break
// the whole AnalysisResult. Lifted from @krdn/saju's compose/lifetime.ts.
//
// Returns Result<T, TickerlensError>: ok-value on success, ok:false envelope
// with the cause attached on throw.

import type { Result, TickerlensError } from "../types.js";

export async function safeFrame<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<Result<T, TickerlensError>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error: TickerlensError = {
      code: "ANALYSIS_FAILED",
      message: `${label}: ${message}`,
      cause: err,
    };
    return { ok: false, error };
  }
}

/** Convenience constructor for skipped-on-purpose Results. */
export function skipped<T>(label: string, reason: string): Result<T, TickerlensError> {
  return {
    ok: false,
    error: {
      code: "ANALYSIS_SKIPPED",
      message: `${label}: ${reason}`,
    },
  };
}
