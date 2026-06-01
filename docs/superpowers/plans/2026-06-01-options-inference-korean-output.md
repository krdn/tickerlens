# 옵션 무체인 추론 + 한국어 출력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tickerlens 옵션 페르소나가 옵션 체인 없는 종목(한국 주식 등)에서도 가격 변동성 기반으로 추론하게 하고, 모든 분석 narration을 한국어로 출력한다.

**Architecture:** 변경은 tickerlens 라이브러리 안에서 완결된다. 옵션 LLM 호출을 막던 스킵 가드 2곳을 제거하고, OPTIONS 페르소나 시스템 프롬프트를 무체인 대응으로 재작성하며, `buildUserPrompt` 단일 chokepoint에 한국어 지시(항상)와 옵션 부재 disclaimer(조건부)를 추가한다. 옵션 부재 시 slice에 기술 지표 전체를 포함해 추론 근거를 제공한다. 소비자 UI(gons-dashboard)는 건드리지 않는다 — 가드 제거로 `ANALYSIS_SKIPPED`가 도달 불가 코드가 되기 때문이다.

**Tech Stack:** TypeScript, Vitest, Zod, pnpm, tsup. 설계 문서: `docs/superpowers/specs/2026-06-01-options-inference-korean-output-design.md`.

---

## File Structure

| 파일 | 변경 | 책임 |
|---|---|---|
| `src/prompts/builders.ts` | 수정 | `buildUserPrompt`에 한국어 지시 + 조건부 disclaimer 추가, `personaSlice` options 분기 확장 |
| `src/prompts/personas.ts` | 수정 | OPTIONS 시스템 프롬프트 무체인 대응 재작성 |
| `src/compose/tickerAnalysis.ts` | 수정 | full/lite 옵션 스킵 가드 2곳 제거, 고아 헬퍼 정리 |
| `src/compose/tickerAnalysis.test.ts` | 수정 | 옵션 스킵 테스트를 "옵션도 추론" 동작으로 재작성 |

작업 순서: 테스트 먼저 깨고(Task 1) → 가드 제거로 통과(Task 2) → 프롬프트/슬라이스 변경(Task 3, 4) → 전체 검증(Task 5).

작업은 `feat/options-inference-korean-output` 브랜치에서 진행한다 (이미 체크아웃됨, 설계 문서 커밋 `7a4ab86` 존재).

---

### Task 1: 옵션 스킵 테스트를 "옵션도 추론" 동작으로 재작성

가드를 제거하기 **전에** 테스트를 새 기대 동작으로 바꾼다. 이 테스트는 옵션 체인이 없을 때
옵션 페르소나가 스킵되지 않고 다른 페르소나처럼 완료되는지를 검증한다.

기존 테스트(`tickerAnalysis.test.ts:162-177`)는 `completed===9 / failed===3`과
`ANALYSIS_SKIPPED`를 단언한다. mock runner(`tickerAnalysis.test.ts:19-45`)는
`.long/.mid/.short/.lite`로 끝나는 **모든** 모듈명을 성공 처리하므로(옵션 모듈명도
`tickerlens.options.long` 등으로 끝남), 가드만 제거하면 옵션도 자동으로 mock을 타
완료된다. 따라서 새 기대값은 `completed===12 / failed===0`이다.

**Files:**
- Test: `src/compose/tickerAnalysis.test.ts:162-177`

- [ ] **Step 1: 기존 옵션 스킵 테스트를 새 동작으로 교체**

`src/compose/tickerAnalysis.test.ts`의 다음 블록(162-177행)을 찾는다:

```typescript
  it("skips the options persona (3 slots) when options chain is absent", async () => {
    const result = await composeTickerAnalysis("FAKE", {
      configAdapter: stubConfigAdapter,
      dataAdapter: mockAdapter(mockRaw(false)),
      depth: "full",
    });
    expect(result.meta.completed).toBe(9);
    expect(result.meta.failed).toBe(3);
    for (const tf of ["long", "mid", "short"] as const) {
      const slot = result.perspectives.options[tf];
      expect(slot.ok).toBe(false);
      if (!slot.ok) {
        expect(slot.error.code).toBe("ANALYSIS_SKIPPED");
      }
    }
  });
```

이 블록 전체를 아래로 교체한다:

```typescript
  it("still analyzes the options persona when options chain is absent", async () => {
    const result = await composeTickerAnalysis("FAKE", {
      configAdapter: stubConfigAdapter,
      dataAdapter: mockAdapter(mockRaw(false)),
      depth: "full",
    });
    // No options chain → no skip. Options persona runs the LLM like the others,
    // inferring volatility from price/indicators. All 12 slots complete.
    expect(result.meta.completed).toBe(12);
    expect(result.meta.failed).toBe(0);
    for (const tf of ["long", "mid", "short"] as const) {
      expect(result.perspectives.options[tf].ok).toBe(true);
    }
  });
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인**

Run: `pnpm test -- src/compose/tickerAnalysis.test.ts`
Expected: FAIL — 새 테스트가 `completed===12`를 기대하지만 현재 코드는 가드 때문에
옵션을 스킵해 `completed===9`를 반환한다. (`expected 9 to be 12` 류의 실패.)

- [ ] **Step 3: 커밋**

```bash
git add src/compose/tickerAnalysis.test.ts
git commit -m "test: 옵션 체인 부재 시 옵션도 분석되도록 기대 동작 변경"
```

---

### Task 2: 옵션 스킵 가드 제거

옵션 LLM 호출을 막던 가드를 full/lite 양쪽에서 제거한다. 제거 후 고아가 되는
헬퍼/import가 있으면 함께 정리한다.

**Files:**
- Modify: `src/compose/tickerAnalysis.ts` (full: 120-142행 근처, lite: 179-191행 근처)

- [ ] **Step 1: full fan-out의 옵션 스킵 가드 제거**

`src/compose/tickerAnalysis.ts`의 `runFullFanOut` 안 루프(현재 120-142행)에서 다음을 찾는다:

```typescript
  for (const p of personas) {
    for (const tf of timeframes) {
      const module = grid[p][tf];
      if (p === "options" && !snapshot.options) {
        tasks.push({
          persona: p,
          timeframe: tf,
          promise: Promise.resolve(
            skipped<PerspectiveResult>(
              `${p}/${tf}`,
              "options chain unavailable",
            ),
          ),
        });
        continue;
      }
      tasks.push({
        persona: p,
        timeframe: tf,
        promise: runOne(module, snapshot, configAdapter, `${p}/${tf}`),
      });
    }
  }
```

`if (p === "options" && !snapshot.options) { ... continue; }` 블록만 제거해 아래로 만든다:

```typescript
  for (const p of personas) {
    for (const tf of timeframes) {
      const module = grid[p][tf];
      tasks.push({
        persona: p,
        timeframe: tf,
        promise: runOne(module, snapshot, configAdapter, `${p}/${tf}`),
      });
    }
  }
```

- [ ] **Step 2: lite fan-out의 옵션 스킵 가드 제거**

같은 파일 `runLiteFanOut` 안의 `tasks` 매핑(현재 179-191행)에서 다음을 찾는다:

```typescript
  const tasks = personas.map(async ({ name, module }) => {
    if (name === "options" && !snapshot.options) {
      return {
        name,
        slots: makeAllSkipped(name, "options chain unavailable"),
      };
    }
    const result = await runLiteOne(module, snapshot, configAdapter, `${name}/lite`);
    if (!result.ok) {
      return { name, slots: makeAllFailed(result.error) };
    }
    return { name, slots: explodeLite(result.value) };
  });
```

`if (name === "options" && !snapshot.options) { ... }` 블록만 제거해 아래로 만든다:

```typescript
  const tasks = personas.map(async ({ name, module }) => {
    const result = await runLiteOne(module, snapshot, configAdapter, `${name}/lite`);
    if (!result.ok) {
      return { name, slots: makeAllFailed(result.error) };
    }
    return { name, slots: explodeLite(result.value) };
  });
```

- [ ] **Step 3: 고아가 된 `makeAllSkipped` 헬퍼 제거**

`makeAllSkipped`는 위 두 가드에서만 호출됐다. 가드를 모두 제거했으므로
같은 파일의 다음 함수(현재 218-224행)를 삭제한다:

```typescript
function makeAllSkipped(label: string, reason: string): PersonaSlots {
  return {
    long: skipped<PerspectiveResult>(`${label}/long`, reason),
    mid: skipped<PerspectiveResult>(`${label}/mid`, reason),
    short: skipped<PerspectiveResult>(`${label}/short`, reason),
  };
}
```

- [ ] **Step 4: 고아가 된 `skipped` import 제거**

`skipped`는 `makeAllSkipped`와 full 가드에서만 쓰였다. 둘 다 제거했으므로
같은 파일 상단(현재 52행)의 import를 정리한다. 다음을:

```typescript
import { safeFrame, skipped } from "./safeFrame.js";
```

다음으로 바꾼다:

```typescript
import { safeFrame } from "./safeFrame.js";
```

(주의: `safeFrame.ts`의 `skipped` 함수 자체는 삭제하지 않는다 — public 유틸이고
이번 변경 범위를 벗어난다.)

- [ ] **Step 5: 타입체크와 테스트 실행 — 통과 확인**

Run: `pnpm typecheck`
Expected: 에러 없음 (사용하지 않는 import/함수가 모두 제거됨).

Run: `pnpm test -- src/compose/tickerAnalysis.test.ts`
Expected: PASS — Task 1에서 바꾼 테스트가 이제 `completed===12`로 통과.
"surfaces snapshot warnings" 테스트(191-200행)도 lite 경로라 영향 없이 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/compose/tickerAnalysis.ts
git commit -m "feat: 옵션 체인 부재 시 옵션 페르소나 스킵 가드 제거

한국 종목처럼 옵션 데이터가 없어도 옵션 페르소나가 LLM을 호출해
가격 변동성 기반으로 추론하게 한다. 고아가 된 makeAllSkipped와
skipped import도 정리."
```

---

### Task 3: OPTIONS 페르소나 시스템 프롬프트 무체인 대응 재작성

현재 OPTIONS 프롬프트는 *"only when the chain supports it … You never invent data"*로
무체인 추론을 명시적으로 금지한다. 가드를 풀어도 이 프롬프트 때문에 모델이 구조 제안을
거부하거나 thesis를 "데이터 없음"으로 채운다. 이 프롬프트를 재작성한다.

**Files:**
- Modify: `src/prompts/personas.ts:33-39` (`OPTIONS` 상수)

- [ ] **Step 1: OPTIONS 상수 재작성**

`src/prompts/personas.ts`의 다음 상수(33-39행)를 찾는다:

```typescript
const OPTIONS = `You are a senior options / volatility desk trader. You evaluate IV regime
(high/neutral/low) vs IV rank, term structure, put/call ratio, top open-interest
strikes near the money, and skew signals. You suggest concrete option structures
(sell 30-delta put, ATM straddle, collar, etc.) only when the chain supports it.
You quote the actual greeks/IV/strike values from the snapshot.

Always return JSON that matches the provided schema exactly. Do not add commentary outside the JSON.`;
```

전체를 아래로 교체한다:

```typescript
const OPTIONS = `You are a senior options / volatility desk trader.

When an options chain is present in the snapshot, evaluate IV regime
(high/neutral/low) vs IV rank, term structure, put/call ratio, top open-interest
strikes near the money, and skew signals. Quote the actual greeks/IV/strike
values from the snapshot and propose concrete structures (sell 30-delta put,
ATM straddle, collar, etc.) the chain supports.

When NO options chain is available (common for non-US equities such as Korean
stocks), do not refuse. Instead INFER a likely volatility regime from the price
action you do have: recent price change, position within the 52-week range,
volume vs average, and the technical indicators (RSI, MACD, MA50/MA200). From
that inferred regime, describe the kind of option structure a trader would
generally consider, and state plainly that this is an estimate based on price
volatility because no actual options-chain data is available. Never fabricate
specific greeks, IV ranks, or strike-level open interest you cannot see.

Always return JSON that matches the provided schema exactly. Do not add commentary outside the JSON.`;
```

- [ ] **Step 2: 타입체크 — 통과 확인**

Run: `pnpm typecheck`
Expected: 에러 없음 (문자열 상수 변경뿐).

- [ ] **Step 3: 커밋**

```bash
git add src/prompts/personas.ts
git commit -m "feat: OPTIONS 페르소나를 무체인 변동성 추론까지 대응하도록 재작성

옵션 체인이 없으면 거부하지 말고 가격/지표로 IV regime을 추정해
일반적 옵션 구조를 서술하되 추정임을 명시하게 한다."
```

---

### Task 4: 한국어 지시 + 조건부 disclaimer + 옵션 slice 확장 (`builders.ts`)

`buildUserPrompt` 단일 chokepoint에 (a) 항상 적용되는 한국어 출력 지시와
(b) 옵션 체인 부재 시에만 붙는 disclaimer를 추가한다. 또한 `personaSlice`의
options 분기를 확장해 옵션 부재 시 기술 지표 전체를 추론 근거로 제공한다.

**Files:**
- Modify: `src/prompts/builders.ts` (`buildUserPrompt` 18-40행, `personaSlice` options 분기 73-78행)

- [ ] **Step 1: `buildUserPrompt`에 한국어 지시 + 조건부 disclaimer 추가**

`src/prompts/builders.ts`의 `buildUserPrompt`(18-40행)를 찾는다:

```typescript
export function buildUserPrompt(input: BuildUserPromptInput): string {
  const { snapshot, persona, timeframe } = input;
  const slice = personaSlice(snapshot, persona);
  const brief = timeframeBrief(timeframe);

  return [
    `Ticker: ${snapshot.ticker}`,
    `As of: ${snapshot.asOf}`,
    "",
    brief,
    "",
    "Snapshot data (only quote values you can see below):",
    "```json",
    JSON.stringify(slice, null, 2),
    "```",
    "",
    snapshot.warnings.length > 0
      ? `Known data gaps: ${snapshot.warnings.join("; ")}`
      : "No known data gaps.",
    "",
    `Now produce the JSON object that matches the response schema for a ${persona} analyst at the ${timeframe} timeframe.`,
  ].join("\n");
}
```

전체를 아래로 교체한다:

```typescript
export function buildUserPrompt(input: BuildUserPromptInput): string {
  const { snapshot, persona, timeframe } = input;
  const slice = personaSlice(snapshot, persona);
  const brief = timeframeBrief(timeframe);

  const optionsDisclaimer =
    persona === "options" && !snapshot.options
      ? "No options-chain data is available for this ticker. Infer a volatility " +
        "regime from price action and technical indicators, and state in the " +
        "thesis that this is an estimate based on price volatility."
      : null;

  return [
    `Ticker: ${snapshot.ticker}`,
    `As of: ${snapshot.asOf}`,
    "",
    brief,
    "",
    "Snapshot data (only quote values you can see below):",
    "```json",
    JSON.stringify(slice, null, 2),
    "```",
    "",
    snapshot.warnings.length > 0
      ? `Known data gaps: ${snapshot.warnings.join("; ")}`
      : "No known data gaps.",
    ...(optionsDisclaimer ? ["", optionsDisclaimer] : []),
    "",
    `Now produce the JSON object that matches the response schema for a ${persona} analyst at the ${timeframe} timeframe.`,
    "",
    "Write all free-text fields (thesis, evidence values, risks, catalysts, " +
      "suggestedStructure) in Korean (한국어). Keep enum/machine values " +
      "(signal, ivRegime, trend) exactly as defined by the schema in English.",
  ].join("\n");
}
```

- [ ] **Step 2: `personaSlice` options 분기를 옵션 부재 시 지표 포함으로 확장**

같은 파일 `personaSlice`의 options 케이스(73-78행)를 찾는다:

```typescript
    case "options":
      return {
        ...base,
        indicators: { ivRank: snapshot.indicators.ivRank },
        options: snapshot.options,
      };
```

전체를 아래로 교체한다:

```typescript
    case "options":
      // With a chain, ivRank + chain is enough. Without one (e.g. Korean
      // stocks), include the full technical-indicator set so the analyst can
      // infer a volatility regime from price action instead of empty data.
      return snapshot.options
        ? {
            ...base,
            indicators: { ivRank: snapshot.indicators.ivRank },
            options: snapshot.options,
          }
        : {
            ...base,
            indicators: snapshot.indicators,
          };
```

- [ ] **Step 3: 타입체크 — 통과 확인**

Run: `pnpm typecheck`
Expected: 에러 없음. (`snapshot.options`는 `OptionsSnapshot | undefined`이고
`snapshot.indicators`는 `IndicatorsSnapshot`이라 두 분기 모두 타입 안전.)

- [ ] **Step 4: 전체 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS. `builders.ts` 변경은 프롬프트 문자열만 바꾸고 반환 구조는
유지하므로 깨는 테스트 없음 (tickerlens엔 프롬프트 스냅샷 테스트가 없음).

- [ ] **Step 5: 커밋**

```bash
git add src/prompts/builders.ts
git commit -m "feat: 한국어 출력 지시 + 옵션 부재 disclaimer/지표 slice 추가

buildUserPrompt 단일 chokepoint에서 모든 자유 텍스트를 한국어로
출력하게 하고, 옵션 체인이 없을 때만 추정 disclaimer를 붙이며
지표 전체를 slice에 포함해 변동성 추론 근거를 제공한다."
```

---

### Task 5: 전체 검증 + 빌드

모든 변경을 합쳐 타입체크·테스트·빌드가 통과하는지 최종 확인한다.

**Files:** (검증만, 변경 없음)

- [ ] **Step 1: 타입체크**

Run: `pnpm typecheck`
Expected: 에러 없음.

- [ ] **Step 2: 전체 테스트**

Run: `pnpm test`
Expected: 모든 테스트 PASS. 특히:
- `tickerAnalysis.test.ts` — 4개 테스트 모두 통과 (옵션 추론 포함 12 completed)
- `snapshot.test.ts` — `warnings`에 `"options chain unavailable"` 단언 유지 통과

- [ ] **Step 3: 빌드**

Run: `pnpm build`
Expected: tsup이 `dist/`를 에러 없이 생성.

- [ ] **Step 4: 변경 요약 확인**

Run: `git log --oneline feat/options-inference-korean-output ^main`
Expected: 설계 문서 1 + 본 작업 커밋들(test, 가드 제거, OPTIONS 프롬프트,
builders)이 보인다.

---

## 검증 기준 (설계 문서와 동일)

1. `pnpm typecheck` 통과.
2. `pnpm test` 통과(테스트 갱신 포함).
3. 한국 종목(005930.KS, lite) 분석 시 옵션 행 3칸이 "분석 실패" 대신 한국어 추정
   분석으로 채워진다. — **런타임 확인은 소비자 앱(gons-dashboard, 포트 3020)에서
   별도로 한다. 이 계획의 자동 검증 범위 밖이다.**
4. 모든 페르소나·타임프레임 thesis가 한국어로 출력된다. (위와 동일, 런타임 확인.)
5. 미국 종목(옵션 체인 보유)은 기존 동작 유지 — disclaimer 미부착, 실제 옵션 데이터
   기반 분석. (slice 분기와 disclaimer가 `snapshot.options` 존재 시 기존 경로 유지로 보장.)

## 참고: 소비자 앱 반영

tickerlens가 npm 패키지로 게시·소비되는 경우, gons-dashboard가 새 버전을 받아야
런타임에 반영된다. 게시/버전 업/소비자 업데이트는 이 계획의 범위 밖이며, 사용자가
별도로 결정한다. (로컬 link/workspace로 소비 중이면 빌드만으로 반영될 수 있다.)
