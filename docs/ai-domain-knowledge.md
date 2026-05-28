# AI 도메인 지식

이 라이브러리의 도메인 안에서 AI(LLM, 그리고 향후 코드를 작성·확장할 다른 AI 에이전트)가 추론할 때 필요한 어휘·개념·해석 규칙을 모은 레퍼런스입니다. README는 사람이 quick start를 위해 읽고, `CONTEXT.md`는 모듈 prompt 작성용 짧은 어휘집입니다. 이 문서는 그 사이의 깊이 — **"왜 이 모델이 이렇게 설계되었나"** 와 **"AI가 이 라이브러리 안에서 발화·결정할 때 따라야 하는 규칙"** 을 다룹니다.

## 1. 도메인 모델

### 1.1 페르소나 = 분석 관점, 아바타 아님

라이브러리에는 4개 페르소나(`value`, `growth`, `quant`, `options`)가 있습니다. AI는 페르소나를 **캐릭터 연기**가 아니라 **분석 프레임의 이름**으로 다뤄야 합니다. 같은 데이터를 다른 가중치·다른 어휘로 보는 4개 관점입니다.

| 페르소나 | 본질 | 무엇을 보는가 | 무엇을 무시하는가 |
|---|---|---|---|
| value | 내재가치 기반 — Buffett/Graham 학파 | P/E, P/B, FCF, 부채, 마진, ROIC, owner earnings | 단기 가격 변동, RSI, IV |
| growth | 성장 옵셔널리티 기반 — Lynch/Wood 학파 | 매출/EPS CAGR, TAM, 재투자 효율, PEG, 디스럽션 | 현재 PE의 절대 수준 (성장 정당화 가능) |
| quant | 가격 행동 기반 — 기술적 매매 학파 | RSI, MACD, MA 교차, 거래량, 52주 범위 | 펀더멘털·뉴스 의미론 |
| options | 변동성·헤지 기반 — 옵션 데스크 학파 | IV regime, P/C ratio, top OI, skew, suggested structure | long-term 펀더멘털 (의미 없는 horizon) |

**중요 규칙**:
- 4 페르소나는 의도적으로 **상충하는 결론을 만들 수 있게** 설계되었습니다. 같은 종목에서 value=`hold`, growth=`buy`가 나오는 것은 버그가 아니라 **설계 의도**입니다. 소비자는 이 불일치 자체를 신호로 읽어야 합니다.
- 페르소나는 prompts/personas.ts의 시스템 프롬프트로 정의됩니다. AI가 새 페르소나를 추가할 때는 **다른 페르소나와 명확히 다른 데이터 가중치·다른 어휘**가 있어야 합니다. 단순히 "조금 더 보수적인 value 페르소나"는 추가하지 마세요 — 의미 없는 차원 확장입니다.

### 1.2 시간축 = 데이터 출처의 우선순위 결정 장치

3개 시간축(`long`, `mid`, `short`)은 호라이즌 길이 라벨에 그치지 않습니다. 시간축은 **같은 페르소나가 어떤 데이터를 우선 인용할지** 정합니다.

| 시간축 | 호라이즌 | 데이터 우선순위 |
|---|---|---|
| long | 1년 이상 | 펀더멘털, moat 지속성, 자본 배분, through-cycle 마진 |
| mid | 1~6개월 | 최근 실적, 애널리스트 수정치, sector rotation, 이벤트 (FOMC, ER) |
| short | 며칠~몇 주 | 기술적 지표, IV regime, 거래량, 단기 카탈리스트 (earnings/ex-div) |

**관측된 작동 증거** (`v0.1.0` xAI Grok-3-mini 검증):
- options.long → "durable moat, services TAM, AI/health innovation" (펀더멘털 어휘)
- options.short → "IV rank 69, P/C ratio 0.72, 195-200 strike open interest" (옵션·기술 어휘)
- **같은 페르소나, 같은 데이터 스냅샷이지만 시간축 brief가 바뀌면서 LLM이 인용하는 데이터 출처가 정확히 바뀝니다.** 이게 saju의 "4학파 × 4시간축" fan-out 패턴이 주식 도메인에서도 작동한다는 증거입니다.

AI가 prompt를 수정·확장할 때 이 데이터 우선순위 분리를 깨면 안 됩니다.

### 1.3 signal / confidence / thesis / evidence / risks / catalysts

분석 결과의 6개 필드는 의도적으로 단순합니다. AI는 각 필드의 **계약(contract)** 을 정확히 이해해야 합니다.

| 필드 | 의미 | 위반 사례 |
|---|---|---|
| `signal` | 방향성 5단계 (`strong_buy`/`buy`/`hold`/`sell`/`strong_sell`) | 6단계로 늘리거나 확률값으로 바꾸기 |
| `confidence` | 0–100 정수. **자신의 결론이 맞을 확률** 이 아니라 **사용 가능한 증거의 충분성** | 데이터가 부족한데 confidence 90 |
| `thesis` | 2–4문장의 핵심 논리. 페르소나 voice로. | 페르소나에 안 맞는 어휘 사용 |
| `evidence` | `{label, value}[]` 최소 1개 — 스냅샷에서 인용한 구체적 수치 | "강한 펀더멘털" 같은 추상적 라벨 |
| `risks` | thesis가 무너지는 시나리오 | "주가가 떨어질 수 있음" 같은 동어반복 |
| `catalysts` | thesis를 검증/반증할 다가오는 이벤트 | 추상적 매크로 ("금리 변화") |

**confidence ≠ 확률 (중요)**: confidence가 60이면 "60% 확률로 맞다"가 아니라 "이 결론을 내릴 만큼 증거가 60% 정도 충분하다"입니다. 데이터가 부족할 때(`snapshot.warnings`에 항목이 있을 때) confidence는 자동으로 낮아져야 합니다.

### 1.4 페르소나 확장 필드 (`valueFields`, `growthFields`, `quantFields`, `optionsFields`)

페르소나마다 자신의 분석 도구 결과를 추가로 노출합니다.

- `value`: `{fairValueLow, fairValueHigh, marginOfSafetyPct}` — 펀더멘털 평가 결과
- `growth`: `{expectedRevenueCagrPct, expectedEpsCagrPct, pegFair}` — 성장 가정
- `quant`: `{trend, momentumScore, overbought, oversold}` — 기술 상태
- `options`: `{ivRegime, suggestedStructure, breakEvens}` — 옵션 구조 추천

**시간축마다 strict ↔ loose**: long은 추정이 어려운 horizon이라 모든 sub-field가 `nullable`. mid/short는 strict. **AI는 nullable이 곧 "데이터 부족 시 null 반환 허용"이라는 신호로 읽어야 합니다.** 환각 금지의 마지막 안전망입니다.

## 2. 데이터 의미론

### 2.1 `TickerSnapshot` 은 LLM의 유일한 진실 출처

LLM은 자신의 학습 지식을 사용해서는 안 됩니다. 분석 시점에 사용 가능한 사실은 오직 `TickerSnapshot`에 들어있는 값입니다. 이 원칙이 깨지면 (a) 분석이 stale data 위에 만들어지거나 (b) LLM이 학습 cutoff 이전의 가격을 인용해서 false confidence가 만들어집니다.

페르소나 시스템 프롬프트에 명시된 **"You never invent data"** 라인은 이 원칙의 enforcement 지점입니다. AI가 prompt를 수정할 때 이 라인을 제거하거나 약화하면 안 됩니다.

### 2.2 필드별 의미 + null/missing 해석

#### `price`
- `last` — 직전 종가/현재가
- `change`, `changePct` — 직전 종가 대비
- `range52w: [low, high]` — 위치는 모멘텀 정보 (high 근처 = 강세 추세, low 근처 = 약세/저점)
- `volume`, `avgVolume30d` — `volume / avgVolume30d` 비율이 "이상 거래량"의 척도

#### `fundamentals`
모든 절대 수치는 raw 단위 (revenue는 달러 절대값, margins는 0~1 비율). 페르소나가 자기 어휘로 변환해야 합니다.

| 필드 | null/0 의미 | 페르소나 입장에서 |
|---|---|---|
| `pe` null | 손실 기업 또는 데이터 부재 | value: 부정적 신호 / growth: 의미 없을 수 있음 |
| `peg` null | EPS 성장 데이터 부재 | growth: 분석 약화 |
| `freeCashFlow` null | CF 데이터 부재 | value: thesis 약화 — owner earnings 추정 불가 |
| `revenueGrowthYoY` 음수 | 매출 역성장 | growth: thesis 직접 반박 |
| `debt.toEquity` null | 자기자본 0 또는 데이터 부재 | value: 안전성 평가 불가 |

#### `indicators`
- `rsi14`: 30 이하 oversold, 70 이상 overbought. **70 = 매도 신호가 아니라 "강한 상승 추세"** (모멘텀 학파 해석)
- `macd.hist > 0`: 단기 모멘텀 우위. `< 0`: 약화
- `ma50 > ma200`: golden cross 가능 영역. 그 반대는 death cross
- `ma50` null: 50일 이상 거래된 종목 아님 → quant 페르소나 분석 약화

#### `options` (optional)
- 전체 객체가 `undefined` → 옵션 미상장 / 데이터 못 받음. **options 페르소나는 자동으로 ANALYSIS_SKIPPED 처리됩니다.** AI가 이 동작을 우회하면 안 됩니다.
- `nearestExpiry.iv`: ATM IV (annualized). 0.20 = 20%
- `putCallRatio > 1`: bearish sentiment 또는 헤지 수요
- `topStrikes`: open interest 상위 → implied support/resistance 추정에 사용

#### `recommendations`
애널리스트 컨센서스. **참고용**이지 결정적 신호 아닙니다. 페르소나는 이걸 evidence로 인용은 하되 thesis의 주축으로 삼으면 안 됩니다.

#### `news`
헤드라인 + 출처 + 시각. 페르소나는 (a) 이미 가격에 반영된 정보 (b) 아직 반영 안 된 catalysts를 분리해야 합니다.

#### `warnings`
정규화 단계가 채우는 데이터 부재 표시. AI가 prompt에서 "Known data gaps: …"로 LLM에게 전달합니다. **LLM은 warnings에 있는 필드를 인용하면 안 됩니다.**

### 2.3 `asOf` — 신선도 추론

`snapshot.asOf`는 ISO 시각. 페르소나는 이 시각을 분석에 명시적으로 반영해야 합니다. 예: 장 마감 후 데이터로 short-term 분석 시 "다음 거래일 갭" 가능성을 evidence/risks에 포함.

## 3. LLM 협업 규칙

### 3.1 페르소나 voice 유지

각 페르소나 시스템 프롬프트는 **voice를 강제** 합니다 (Buffett 어조, Lynch 어조 등). AI가 prompt를 수정할 때 이 voice를 약화하면 페르소나간 차별성이 무너집니다.

검증된 voice 신호 (xAI Grok 실측):
- value: "durable moat", "owner earnings", "margin of safety", "Graham standards"
- growth: "secular tailwinds", "TAM", "optionality", "narrative-meets-numbers"
- quant: "trend regime", "RSI", "MACD line", "above-average volume"
- options: "IV rank", "P/C ratio", "top OI", "sell 30-delta put"

**불변식**: 다른 페르소나의 어휘가 한 페르소나 thesis에 섞이면 prompts/personas.ts가 충분히 강하지 않다는 신호입니다.

### 3.2 데이터 인용 의무

LLM은 결론을 evidence 필드에 구체적 수치로 뒷받침해야 합니다:

- ✅ `{label: "P/E", value: "31.4 vs sector 22"}`
- ❌ `{label: "fundamentals", value: "strong"}`

이 규칙이 무너지면 분석의 검증 가능성이 사라집니다.

### 3.3 null 반환 시점

페르소나 확장 필드(`valueFields.fairValueLow` 등)가 nullable로 표시된 경우:

- **데이터 부재**: 관련 입력 필드가 없거나 `warnings`에 있음 → `null` 반환
- **horizon 부적합**: 예 — options.long의 `suggestedStructure` (장기 옵션 구조 추천 자체가 무의미) → `null` 반환
- **계산 불확실성 너무 큼**: 신뢰할만한 추정 불가능 → `null` 반환

**`null` 반환은 실패가 아니라 정직성의 표시** 입니다. AI가 null 회피를 위해 추정치를 만들도록 prompt를 수정하면 안 됩니다.

### 3.4 환각 금지 경계

다음은 모두 환각입니다:

| 환각 유형 | 예시 |
|---|---|
| 학습 지식 인용 | "Apple은 2024년 Vision Pro를 출시했다" (snapshot에 없는 사실) |
| 데이터 외삽 | "snapshot에 없지만 일반적으로 Apple의 ROIC는 …" |
| 평가절상 (false specificity) | 데이터 부재 시에도 `fairValueLow: 145` 반환 |
| Persona drift | value 페르소나가 "RSI overbought이므로 sell" 결론 |

페르소나 시스템 프롬프트는 이 모든 경계를 명시합니다. AI가 prompt를 약화하면 이 보호막이 사라집니다.

### 3.5 부분 실패는 정상

`composeTickerAnalysis`는 12 슬롯 중 일부가 실패해도 throw하지 않습니다. AI가 결과를 해석할 때:

- `result.meta.completed === 12` 이상적 케이스
- `completed >= 9` (옵션 페르소나만 SKIPPED) — ETF 또는 옵션 미상장 종목에서 정상
- `completed < 9` — 데이터 또는 LLM 측 문제. 각 슬롯의 `error.code` 검사 필요

소비자가 만든 코드가 `result.perspectives.value.long.value`를 직접 접근하면 (Result envelope 체크 없이) 부분 실패 시 crash합니다. **AI가 소비자 가이드 예제를 작성할 때는 항상 `if (slot.ok)` 패턴을 보여야 합니다.**

## 4. 확장 시 따라야 하는 규칙

### 4.1 새 페르소나 추가

체크리스트:
1. 다른 4 페르소나와 **명확히 다른 데이터 가중치** 가 있는가?
2. 다른 페르소나가 못 만드는 결론을 만들 수 있는가?
3. `prompts/personas.ts`에 강한 voice가 있는가?
4. `schemas/{persona}.ts`에 strict/loose 시간축 변형이 있는가?
5. `defaultModuleConfig`의 `MODULE_NAMES`에 4개 (long/mid/short/lite) 모듈명 추가했는가?
6. `tickerAnalysis.ts`의 fan-out grid에 추가했는가?
7. `AnalysisResult.perspectives` 타입에 키 추가했는가?

위 7개 중 하나라도 빠지면 빌드는 통과해도 런타임에 누락이 생깁니다.

### 4.2 새 시간축 추가

위와 비슷하지만 더 무거운 변경입니다. **현재 long/mid/short 3축이 saju 4축에서 4 → 3으로 의도적으로 줄인 결과**임을 기억해야 합니다 (주식의 시간 의미가 사주의 운명 시간축보다 단순). 새 축을 추가하기 전에 "기존 3축으로 표현 못하는 분석이 있는가"부터 검증.

### 4.3 새 데이터 소스 (DataSourceAdapter) 작성

`DataSourceAdapter` 인터페이스를 구현할 때:
- 필드 부재는 **`null` 반환**이지 throw 아닙니다 (옵션 체인 등은 `options: undefined`로 통째 생략)
- raw 단위를 정규화해서 반환 (예: 매출은 달러 절대값, %가 아닙니다)
- `asOf`는 데이터를 받은 시각 (LLM에 전달되는 신선도 정보)

### 4.4 Zod 스키마 확장

새 필드 추가 시:
- **OpenAI strict mode 호환** 필수: `.optional()` 대신 `.nullable()` 사용
- timeframe별 strict ↔ loose 패턴 유지
- `PerspectiveResult` 타입(`src/types.ts`)에도 mirror 추가

## 5. 자주 묻는 결정 (의도된 trade-off)

| 결정 | 왜 | 대안을 안 고른 이유 |
|---|---|---|
| 4 페르소나만, 5 이상 안 함 | LLM 호출 수 폭증, 페르소나간 의미적 차별 보장 어려움 | 5개로 가면 차별성 만들기 어려움 |
| `signal`을 5단계 enum | 소비자 UI/소팅 단순화 | 확률값은 LLM이 매번 다르게 추정해서 노이즈 큼 |
| `confidence` 정수 0–100 | 사람이 즉시 해석 가능 | 0–1 float는 비교 어렵고 소비자 표시에 변환 필요 |
| Zod에서 `.nullable()` 강제 | OpenAI strict mode 호환 + 환각 방지 | `.optional()`은 OpenAI가 거부, partial은 default 비어보이게 만듦 |
| 옵션 페르소나 자동 skip | ETF·옵션 미상장 종목에서 빈 답변보다 명시적 SKIPPED가 더 가치 | LLM에게 "데이터 없음" 응답시키면 토큰 낭비 + 환각 위험 |
| `Result<T,E>` envelope per slot | 부분 실패가 전체를 망치지 않게 함 | throw + try/catch 패턴은 12 슬롯에서 너무 시끄러움 |
| 시간축 3개 (long/mid/short) | 주식 horizon 분류로 충분 + 12 모듈 한도 | 일중(intraday) 축은 데이터 소스가 일봉이라 의미 없음 |

이 결정들은 saju 라이브러리·llm-gateway·실 LLM 검증 (xAI Grok)에서 학습한 trade-off입니다. AI가 라이브러리를 확장할 때 이 결정을 뒤집으려면 **여기에 명시된 이유보다 더 강한 근거**가 필요합니다.

## 6. 관련 문서

- [`CLAUDE.md`](../CLAUDE.md) — Claude Code 에이전트가 코드 작업할 때 참조하는 아키텍처/명령어
- [`CONTEXT.md`](../CONTEXT.md) — 모듈 prompt에 들어가는 짧은 어휘집
- [`docs/consumer-guide.md`](./consumer-guide.md) — 소비자가 라이브러리를 설치/설정/디버깅할 때 참조
- [`README.md`](../README.md) — 첫 5초 quick start
