// Yahoo Finance adapter — default DataSourceAdapter implementation.
//
// Wraps `yahoo-finance2` v3 and maps its responses into the provider-agnostic
// `RawTickerData` shape. All field absences are surfaced as null (never throw)
// so the downstream snapshot layer can decide whether to warn or skip.
//
// v3 default export is the `YahooFinance` class (v2 was a singleton instance).
// We instantiate once inside createYahooAdapter() — not at module top-level —
// so the cookie/crumb fetch cost is paid per-adapter, not on import.

import YahooFinance from "yahoo-finance2";
import type {
  DailyBar,
  DataSourceAdapter,
  RawFundamentals,
  RawOptionContract,
  RawQuote,
  RawRecommendations,
  RawTickerData,
} from "./adapter.js";
import type { NewsItem } from "../types.js";

export interface YahooAdapterOptions {
  /** How many trailing days of bars to request (default 365). */
  historyDays?: number;
  /** Max news headlines to keep (default 8). */
  newsLimit?: number;
  /** Whether to fetch the options chain (default true). */
  fetchOptions?: boolean;
}

export function createYahooAdapter(
  options: YahooAdapterOptions = {},
): DataSourceAdapter {
  const historyDays = options.historyDays ?? 365;
  const newsLimit = options.newsLimit ?? 8;
  const fetchOptions = options.fetchOptions ?? true;

  // v3: suppressNotices moves from a method to a constructor option. Instantiate
  // here (not at module top-level) so cookie/crumb setup is lazy per-adapter.
  const yahooFinance = new YahooFinance({
    suppressNotices: ["yahooSurvey", "ripHistorical"],
  });

  return {
    name: "yahoo",
    async fetch(ticker: string): Promise<RawTickerData> {
      const upper = ticker.toUpperCase();
      const [quote, summary, bars, chain, recs, search] = await Promise.all([
        yahooFinance.quote(upper),
        yahooFinance.quoteSummary(upper, {
          modules: [
            "summaryDetail",
            "defaultKeyStatistics",
            "financialData",
            "incomeStatementHistory",
            "balanceSheetHistory",
            "cashflowStatementHistory",
          ],
        }),
        yahooFinance.historical(upper, {
          period1: daysAgo(historyDays),
          period2: new Date(),
          interval: "1d",
        }),
        fetchOptions
          ? safeOptions(yahooFinance, upper)
          : Promise.resolve(undefined),
        safeRecommendations(yahooFinance, upper),
        yahooFinance.search(upper, {
          newsCount: newsLimit,
          quotesCount: 0,
          enableFuzzyQuery: false,
        }),
      ]);

      return {
        quote: mapQuote(upper, quote),
        fundamentals: mapFundamentals(summary),
        bars: mapBars(bars),
        options: chain,
        recommendations: recs,
        news: mapNews(search),
      };
    },
  };
}

// ─── Mappers ───────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "raw" in v) {
    const raw = (v as { raw: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

function numOr(v: unknown, fallback: number): number {
  return num(v) ?? fallback;
}

function mapQuote(ticker: string, q: any): RawQuote {
  return {
    ticker,
    last: numOr(q?.regularMarketPrice, 0),
    previousClose: numOr(q?.regularMarketPreviousClose, 0),
    range52wLow: numOr(q?.fiftyTwoWeekLow, 0),
    range52wHigh: numOr(q?.fiftyTwoWeekHigh, 0),
    volume: numOr(q?.regularMarketVolume, 0),
    avgVolume30d: num(q?.averageDailyVolume3Month) ?? undefined,
    asOf: new Date().toISOString(),
  };
}

function mapFundamentals(summary: any): RawFundamentals {
  const sd = summary?.summaryDetail ?? {};
  const ks = summary?.defaultKeyStatistics ?? {};
  const fd = summary?.financialData ?? {};
  const cf = summary?.cashflowStatementHistory?.cashflowStatements?.[0] ?? {};

  const operatingCashflow = num(fd?.operatingCashflow);
  const capex = num(cf?.capitalExpenditures);
  const freeCashFlow =
    operatingCashflow !== null && capex !== null
      ? operatingCashflow + capex // capex is negative in Yahoo
      : num(fd?.freeCashflow);

  return {
    marketCap: numOr(sd?.marketCap, 0),
    pe: num(sd?.trailingPE),
    peg: num(ks?.pegRatio),
    pb: num(ks?.priceToBook),
    ev: num(ks?.enterpriseValue),
    revenue: numOr(fd?.totalRevenue, 0),
    revenueGrowthYoY: num(fd?.revenueGrowth),
    eps: num(ks?.trailingEps),
    epsGrowthYoY: num(fd?.earningsGrowth),
    grossMargin: num(fd?.grossMargins),
    operatingMargin: num(fd?.operatingMargins),
    netMargin: num(fd?.profitMargins),
    totalDebt: numOr(fd?.totalDebt, 0),
    debtToEquity: num(fd?.debtToEquity),
    freeCashFlow,
    dividendYield: num(sd?.dividendYield),
  };
}

function mapBars(history: any[]): DailyBar[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((b) => b && typeof b.close === "number")
    .map((b) => ({
      date:
        b.date instanceof Date
          ? b.date.toISOString().slice(0, 10)
          : String(b.date).slice(0, 10),
      open: numOr(b.open, b.close),
      high: numOr(b.high, b.close),
      low: numOr(b.low, b.close),
      close: numOr(b.close, 0),
      volume: numOr(b.volume, 0),
    }));
}

async function safeOptions(
  yahooFinance: InstanceType<typeof YahooFinance>,
  ticker: string,
): Promise<RawTickerData["options"] | undefined> {
  try {
    const chain = await yahooFinance.options(ticker, {});
    if (!chain || !chain.options || chain.options.length === 0) return undefined;

    const expiries: string[] = Array.isArray(chain.expirationDates)
      ? chain.expirationDates.map((d: Date | string) =>
          d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
        )
      : [];

    const first = chain.options[0]!;
    const expiry =
      first.expirationDate instanceof Date
        ? first.expirationDate.toISOString().slice(0, 10)
        : String(first.expirationDate).slice(0, 10);

    const contracts: RawOptionContract[] = [
      ...mapContracts(first.calls ?? [], "call", expiry),
      ...mapContracts(first.puts ?? [], "put", expiry),
    ];

    return {
      expiries: expiries.length > 0 ? expiries : [expiry],
      nearestExpiry: expiry,
      contracts,
    };
  } catch {
    return undefined;
  }
}

function mapContracts(
  rows: any[],
  type: "call" | "put",
  expiry: string,
): RawOptionContract[] {
  return rows
    .filter((r) => typeof r.strike === "number")
    .map((r) => ({
      strike: numOr(r.strike, 0),
      type,
      expiry,
      bid: numOr(r.bid, 0),
      ask: numOr(r.ask, 0),
      lastPrice: numOr(r.lastPrice, 0),
      volume: numOr(r.volume, 0),
      openInterest: numOr(r.openInterest, 0),
      iv: numOr(r.impliedVolatility, 0),
    }));
}

async function safeRecommendations(
  yahooFinance: InstanceType<typeof YahooFinance>,
  ticker: string,
): Promise<RawRecommendations> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ["financialData", "recommendationTrend"],
    });
    const fd = (summary?.financialData ?? {}) as Record<string, unknown>;
    const rating = mapRating(fd.recommendationKey);
    return {
      rating,
      analystCount: numOr(fd.numberOfAnalystOpinions, 0),
      targetMean: numOr(fd.targetMeanPrice, 0),
      targetHigh: numOr(fd.targetHighPrice, 0),
      targetLow: numOr(fd.targetLowPrice, 0),
    };
  } catch {
    return {
      rating: "hold",
      analystCount: 0,
      targetMean: 0,
      targetHigh: 0,
      targetLow: 0,
    };
  }
}

function mapRating(key: unknown): RawRecommendations["rating"] {
  const k = typeof key === "string" ? key.toLowerCase() : "";
  if (k.includes("strong_buy") || k.includes("buy")) return "buy";
  if (k.includes("sell")) return "sell";
  if (k === "underperform") return "underperform";
  if (k === "outperform") return "outperform";
  return "hold";
}

function mapNews(search: any): NewsItem[] {
  const rows: any[] = Array.isArray(search?.news) ? search.news : [];
  return rows
    .filter((n) => n && typeof n.title === "string")
    .map((n) => ({
      title: String(n.title),
      source: String(n.publisher ?? "Yahoo"),
      publishedAt: toIso(n.providerPublishTime),
      url: String(n.link ?? ""),
      summary:
        typeof n.summary === "string" && n.summary.length > 0
          ? n.summary
          : undefined,
    }));
}

function toIso(epoch: unknown): string {
  if (typeof epoch === "number") {
    // Yahoo gives seconds since epoch
    return new Date(epoch * 1000).toISOString();
  }
  if (epoch instanceof Date) return epoch.toISOString();
  return new Date().toISOString();
}
