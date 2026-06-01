# 설계: 옵션 페르소나 무체인 추론 + 한국어 출력

날짜: 2026-06-01
대상: `@krdn/tickerlens`
관련 소비자: `gons-dashboard` `/stocks` (변경 없음)

## 배경

`/stocks` "주식 타임프레임 분석" 화면에서 한국 종목(예: 삼성전자 005930.KS)을
분석하면 두 가지 문제가 보인다.

1. **옵션 페르소나 3칸(장기/중기/단기)이 모두 "분석 실패"로 표시된다.**
2. **모든 분석 narration(thesis)이 영어로 나온다.**

## 코드로 확정된 원인

| 화면 증상 | 진짜 원인 | 위치 |
|---|---|---|
| 옵션 3칸 "분석 실패" | 한국 종목은 `snapshot.options`가 없어 옵션 LLM 호출을 의도적으로 스킵(`ANALYSIS_SKIPPED`). 소비자 UI가 이를 "분석 실패"로 표시 | `compose/tickerAnalysis.ts:123, 180` (스킵), `gons-dashboard PerspectiveCell.tsx:5` (표시) |
| 영어 출력 | 프롬프트 어디에도 출력 언어 지시가 없음 | `prompts/personas.ts`, `prompts/builders.ts` |

Yahoo Finance가 KRX 옵션 체인을 제공하지 않아, 한국 종목은 구조적으로
`snapshot.options === undefined`다.

## 결정

- **옵션**: 옵션 체인이 없어도 LLM이 가격 변동성 기반으로 일반적 옵션 전략을
  추론한다. 단 그것이 추정임을 명시한다.
- **한국어**: 모든 페르소나·타임프레임의 자유 텍스트를 항상 한국어로 출력한다
  (한국·미국 종목 모두). `signal`/`ivRegime` 등 enum 기계값은 영어 유지.

## 중요한 비-변경: 소비자 UI는 건드리지 않는다

소비자 앱 `PerspectiveCell.tsx`는 `slot.error.code`를 보지 않고
`!slot.ok`이면 무조건 "분석 실패"를 표시한다 — 즉 `ANALYSIS_SKIPPED`와
`ANALYSIS_FAILED`를 구분하지 않는다.

그러나 **옵션 스킵 가드를 제거하면 옵션도 LLM을 호출해 `ok:true`가 되므로
`ANALYSIS_SKIPPED`는 도달 불가 코드가 된다.** 스킵 가드는 `tickerAnalysis.ts`의
두 곳(123, 180)뿐임이 전수 확인됐다. 따라서:

- UI는 손대지 않는다 (닿지 않는 경우를 고치는 것은 YAGNI 위반).
- 진짜 실패에 "분석 실패"가 뜨는 것은 올바른 동작이므로 그대로 둔다.
- 모든 변경은 tickerlens 안에서 완결된다.

## 변경 범위 — tickerlens 4개 파일

### 1. 옵션 스킵 가드 제거 — `compose/tickerAnalysis.ts`

- `runFullFanOut` 123행: `if (p === "options" && !snapshot.options) → skipped(...)` 분기 제거
- `runLiteFanOut` 180행: `if (name === "options" && !snapshot.options) → makeAllSkipped(...)` 분기 제거
- 옵션도 다른 3개 페르소나와 동일하게 항상 `runOne`/`runLiteOne`을 탄다.
- 제거로 고아가 되는 헬퍼(`makeAllSkipped`, `skipped` import 등)가 있으면 함께 정리.

### 2. OPTIONS 페르소나 프롬프트 재작성 — `prompts/personas.ts:33-39`

현재 OPTIONS 프롬프트는 무체인 추론을 **명시적으로 금지**한다:
*"suggest concrete option structures … only when the chain supports it …
You quote the actual greeks/IV/strike values … You never invent data."*

→ 가드만 풀고 disclaimer만 더해도, 모델은 시스템 프롬프트를 따라 구조 제안을
거부하거나 thesis를 "데이터 없음"으로 채운다. 이 프롬프트 재작성이
load-bearing 변경이다.

변경 방향:
- 옵션 체인 데이터가 있으면 그대로 IV/그릭스/행사가를 인용해 분석.
- **없으면** 가격 변동폭(change/changePct), 52주 범위 내 위치, 거래량,
  그리고 RSI/MACD/MA 같은 기술 지표로 IV regime(high/neutral/low)을 **추정**하고,
  그 추정에 부합하는 일반적 옵션 구조를 제안한다.
- 추정 경로일 때는 실제 옵션 데이터가 없다는 사실을 thesis에서 밝힌다.

### 3. 옵션 slice 확장 — `prompts/builders.ts:73-78`

`personaSlice`의 options 케이스는 현재
`{ ...base, indicators: { ivRank: snapshot.indicators.ivRank }, options: snapshot.options }`를
반환한다. `snapshot.options`가 undefined이면 `ivRank`도 undefined라
`JSON.stringify`가 두 키를 모두 누락시켜, 옵션 페르소나가 받는 데이터가 사실상
`{ticker, asOf, price}`뿐이 된다.

→ 옵션 부재 시 `snapshot.indicators` 전체(RSI/MACD/MA50/MA200)를 slice에 포함해
변동성 추론의 근거를 제공한다. 체인이 있을 때의 slice는 그대로 둔다.

### 4. 한국어 지시 + 조건부 disclaimer — `prompts/builders.ts:18` (`buildUserPrompt`)

16개 모듈 전부가 거치는 단일 chokepoint에 추가한다:

- **항상**: 모든 자유 텍스트(thesis, evidence, risks, catalysts,
  suggestedStructure 등)를 한국어로 작성하라는 지시.
- **`!snapshot.options`일 때만**: 실제 옵션 체인 데이터가 없으므로 가격 변동성
  기반 추정임을 명시하라는 disclaimer. (조건부여야 실제 체인이 있는 미국 종목에
  오안내가 붙지 않는다. 시스템 프롬프트는 정적이라 snapshot 유무로 분기 불가 →
  snapshot에 접근 가능한 builders.ts가 유일하게 올바른 위치.)

새 `common.ts` 파일은 만들지 않는다 — `buildUserPrompt`가 이미 단일
어셈블러이므로 직접 추가하는 것이 더 단순하다(YAGNI).

`signal`/`ivRegime`/`trend` enum은 Zod로 강제되어 LLM이 한국어화할 수 없으므로
기계값 영어 유지는 별도 작업 없이 자동 보장된다.

## 정직한 트레이드오프

- **무체인 옵션 분석은 근거가 약하다.** 옵션 체인이 없으면 quant 페르소나와 일부
  겹치는 일반적 변동성 서술이 된다. disclaimer로 "추정"임을 표시하지만, 실제
  IV rank·행사가별 OI 기반 분석만큼 정밀하지 않다. (사용자가 완결성 > 정밀도를
  선택해 이 트레이드오프를 수용함.)
- **mid/short 옵션 스키마**(`schemas/options.ts`의 `optionsFieldsStrict`)는
  `ivRegime`을 non-null enum으로 강제하므로, 무체인에서도 모델이 regime을 하나
  찍는다(크래시 아님, 근거만 약함). 미국 종목 동작을 바꾸지 않도록 스키마는
  전역 완화하지 않는다.

## 테스트

- `compose/tickerAnalysis.test.ts:162-177` — "옵션 체인 없을 때 3칸 스킵" 테스트가
  깨진다. 옵션도 호출하므로 기대값을 `completed===12 / failed===0`으로 재작성하고,
  이제 옵션이 runner를 타므로 runModule mock이 옵션 경로를 커버하도록 갱신한다.
- `data/snapshot.test.ts:114` — `warnings`에 `"options chain unavailable"`이
  들어가는지 단언. `snapshot.ts:42` 경고는 건드리지 않으므로 통과 유지.
- 한국어 변경은 깨는 테스트가 없다(tickerlens엔 프롬프트 스냅샷/byte-identical
  테스트가 없음).

## 검증 기준

1. `pnpm typecheck` 통과.
2. `pnpm test` 통과(위 테스트 갱신 포함).
3. 한국 종목(005930.KS, lite) 분석 시 옵션 행 3칸이 "분석 실패" 대신 한국어
   추정 분석으로 채워진다.
4. 모든 페르소나·타임프레임 thesis가 한국어로 출력된다.
5. 미국 종목(옵션 체인 보유)은 기존 동작 유지 — disclaimer 미부착, 실제 옵션
   데이터 기반 분석.
