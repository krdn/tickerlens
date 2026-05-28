# @krdn/tickerlens 소비자 가이드

소비자 프로젝트에서 `@krdn/tickerlens`를 사용하는 방법, 프로바이더 선택, 데이터 소스 커스터마이징, 그리고 자동 업데이트 구성까지를 다룹니다.

## 설치

```bash
pnpm add @krdn/tickerlens @krdn/llm-gateway
```

> `@krdn/llm-gateway`는 peer dependency입니다. 소비자가 직접 설치해야 하며, 버전은 `^3.0.0` 이상.

## 기본 사용

```typescript
import { composeTickerAnalysis, defaultModuleConfig } from '@krdn/tickerlens';
import { createInMemoryModelConfig } from '@krdn/llm-gateway/adapters';

const configAdapter = createInMemoryModelConfig({
  modules: defaultModuleConfig({
    provider: 'xai',
    model: 'grok-3-mini',
  }),
  // apiKey는 환경변수(XAI_API_KEY 등)에서 자동 해석. 명시하려면:
  // providerDefaults: { xai: { apiKey: process.env.XAI_API_KEY } }
});

const result = await composeTickerAnalysis('AAPL', {
  configAdapter,
  depth: 'lite', // 4 LLM 호출 — 데모/스크리닝 용도. 'full'은 12 호출.
});

console.log(result.meta); // { completed, failed, durationMs, depth }
console.log(result.perspectives.value.long); // Result<PerspectiveResult>
```

## 프로바이더 선택 가이드

`tickerlens`는 Zod 스키마 기반 **structured output**에 강하게 의존합니다. 프로바이더가 strict JSON 스키마를 처리하는 방식에 따라 결과 품질·성공률이 크게 달라집니다.

### 실측 호환성 매트릭스

`v0.1.0` 시점에 `examples/analyze-aapl.ts`로 lite 모드(4 호출, mock AAPL snapshot) 검증한 결과입니다.

| 프로바이더 | 모델 (테스트) | 결과 | 비고 |
|---|---|---|---|
| **xai** | `grok-3-mini` | ✅ 12/12 슬롯 완료, 22초 | 가장 안정적. structured output 빠르고 정확. |
| **anthropic** | `claude-sonnet-4-6` | 미검증 (키 부재) | llm-gateway가 native structured output 지원. 권장 production 선택지. |
| **gemini** | `gemini-2.5-flash` | 미검증 (키 부재) | structured output 지원. 비용 효율 좋음. |
| **openai** | `gpt-4.1-mini` | ⚠️ Strict mode 거부 (해결됨) | OpenAI는 모든 properties를 `required`로 강제. tickerlens v0.1.0+는 `.nullable()` 패턴으로 해결. |
| **deepseek** | `deepseek-chat` | ❌ `response_format type unavailable` | DeepSeek API는 현재 `json_schema` response_format을 거부합니다. `tickerlens`에서 사용 불가. |
| **openrouter** | `openai/gpt-4.1-mini` | 미검증 | json-mode 경로. 통과 가능성 높음. |

### 권장 선택

- **production**: `anthropic` (claude-sonnet-4-6) 또는 `openai` (gpt-4.1-mini/o4-mini).
- **개발/테스트**: `xai` (grok-3-mini) — 비용 낮고 빠름.
- **저비용 스크리닝**: `gemini` (gemini-2.5-flash) + `depth: 'lite'`.
- **회피**: `deepseek` (현재 미지원), `ollama`/`gemini-cli`/`claude-cli` (structured output 미지원 — llm-gateway가 2-step text→JSON 폴백을 시도하지만 schema 복잡도가 높은 tickerlens에서는 통과율 낮음).

### 프로바이더별 모듈 분배

production에서는 모듈별로 다른 프로바이더/모델을 쓰는 것이 일반적입니다. 깊이 있는 long 분석은 강한 모델로, 단순한 short 분석은 저렴한 모델로:

```typescript
const configAdapter = createInMemoryModelConfig({
  modules: {
    // Long 분석은 가장 강한 모델로
    'tickerlens.value.long':   { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    'tickerlens.growth.long':  { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    'tickerlens.quant.long':   { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    'tickerlens.options.long': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    // Mid는 중간
    'tickerlens.value.mid':    { provider: 'openai', model: 'gpt-4.1-mini' },
    'tickerlens.growth.mid':   { provider: 'openai', model: 'gpt-4.1-mini' },
    'tickerlens.quant.mid':    { provider: 'openai', model: 'gpt-4.1-mini' },
    'tickerlens.options.mid':  { provider: 'openai', model: 'gpt-4.1-mini' },
    // Short는 저렴한 모델로
    'tickerlens.value.short':  { provider: 'xai', model: 'grok-3-mini' },
    'tickerlens.growth.short': { provider: 'xai', model: 'grok-3-mini' },
    'tickerlens.quant.short':  { provider: 'xai', model: 'grok-3-mini' },
    'tickerlens.options.short':{ provider: 'xai', model: 'grok-3-mini' },
    // Lite 모드도 매핑 필요 (depth: 'lite' 사용 시)
    'tickerlens.value.lite':   { provider: 'xai', model: 'grok-3-mini' },
    'tickerlens.growth.lite':  { provider: 'xai', model: 'grok-3-mini' },
    'tickerlens.quant.lite':   { provider: 'xai', model: 'grok-3-mini' },
    'tickerlens.options.lite': { provider: 'xai', model: 'grok-3-mini' },
  },
  providerDefaults: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
    xai: { apiKey: process.env.XAI_API_KEY! },
  },
});
```

## 데이터 소스 커스터마이징

기본은 `yahoo-finance2`이지만, rate limit·정확도·라이선스 이유로 다른 소스로 교체하고 싶을 수 있습니다.

### 기본 (Yahoo)

```typescript
const result = await composeTickerAnalysis('AAPL', { configAdapter });
// 내부적으로 createYahooAdapter() 사용
```

### 다른 어댑터 주입

```typescript
import type { DataSourceAdapter, RawTickerData } from '@krdn/tickerlens/data';

const polygonAdapter: DataSourceAdapter = {
  name: 'polygon',
  async fetch(ticker: string): Promise<RawTickerData> {
    // Polygon API 호출 → RawTickerData로 매핑
    return {
      quote: { /* ... */ },
      fundamentals: { /* ... */ },
      bars: [ /* ... */ ],
      options: { /* optional */ },
      recommendations: { /* ... */ },
      news: [ /* ... */ ],
    };
  },
};

const result = await composeTickerAnalysis('AAPL', {
  configAdapter,
  dataAdapter: polygonAdapter,
});
```

### Yahoo rate limit 우회

기본 `yahoo-finance2` v2는 캐시되지 않은 ticker에 대해 종종 `Too Many Requests`를 반환합니다. 대안:

1. **재시도 + 백오프**: 어댑터 wrapper로 감싸기.
2. **캐싱**: Redis/메모리 LRU로 같은 ticker 분 단위 캐시.
3. **유료 소스로 교체**: Polygon, Alpha Vantage, Tiingo.

## depth 모드 선택

| 모드 | LLM 호출 | 비용 예상 (Sonnet 기준) | 사용 시기 |
|---|---|---|---|
| `full` (기본) | 12 | $0.30~$0.80 / 종목 | production. 페르소나·시간축마다 독립 호출 → 가장 세밀. |
| `lite` | 4 | $0.05~$0.15 / 종목 | 스크리닝, 배치, 비용 민감 흐름. 페르소나마다 3 시간축을 한 응답으로. |

비용 절감 추가 전략:
- 시간축마다 다른 모델 (위 "프로바이더별 모듈 분배" 참조)
- 입력 토큰 줄이기: `snapshot.news`를 최근 3개만, `historicalIv`를 줄이기 (yahoo adapter 옵션 미래 추가 예정)

## 부분 실패 처리

`composeTickerAnalysis`는 한 페르소나가 실패해도 throw하지 않습니다. 각 슬롯이 `Result<PerspectiveResult, TickerlensError>`로 감싸져 반환됩니다:

```typescript
const result = await composeTickerAnalysis('AAPL', { configAdapter });

const valueLong = result.perspectives.value.long;
if (valueLong.ok) {
  console.log(valueLong.value.signal); // 'buy' | 'hold' | ...
  console.log(valueLong.value.thesis);
} else {
  console.error(valueLong.error.code, valueLong.error.message);
  // code: 'ANALYSIS_FAILED' | 'ANALYSIS_SKIPPED' | ...
}

console.log(result.meta);
// { completed: 11, failed: 1, durationMs: 14230, depth: 'full' }
```

라이브러리 전체가 throw하는 경우는 데이터 fetch 자체가 실패할 때(`DATA_FETCH_FAILED`)뿐입니다. 옵션 페르소나는 `snapshot.options`가 없으면 자동으로 `ANALYSIS_SKIPPED`로 처리됩니다.

## 서브패스 import

번들 크기에 민감한 환경(예: edge runtime)이면 필요한 것만 import:

```typescript
// 데이터만 정규화하고 분석은 직접
import { createYahooAdapter, normalizeSnapshot } from '@krdn/tickerlens/data';

// 자기 LLM 파이프라인에서 prompt만 빌리기
import { buildUserPrompt, personaSystemPrompt } from '@krdn/tickerlens/prompts';

// Zod schema만 확장
import { valueLongSchema } from '@krdn/tickerlens/schemas';

// 개별 모듈만 실행 (composeTickerAnalysis 우회)
import { valueLong } from '@krdn/tickerlens/analysts';
import { runModule } from '@krdn/llm-gateway/runner';
```

## 디버깅

### "completed: 0, failed: N" — 모든 슬롯 실패

증상: `result.meta.failed === 12`이고 각 슬롯의 `error.code === 'ANALYSIS_FAILED'`.

원인 가능성:
1. **API 키 미설정**: `OPENAI_API_KEY` 등 환경변수 확인.
2. **quota 초과**: provider 콘솔에서 billing/usage 확인.
3. **strict schema 거부 (DeepSeek)**: 위 호환성 매트릭스 참고. 다른 프로바이더로 교체.
4. **모델 미지원**: `gpt-4.1-mini` 등 정확한 모델 ID인지 확인.

`result.perspectives.value.long.error.message`에 LLM 측 에러 메시지가 포함되므로 그것부터 확인.

### "completed: 9, failed: 3" — 옵션 페르소나만 실패

증상: options.long/mid/short만 `ANALYSIS_SKIPPED`.

원인: `snapshot.options`가 `undefined`. 해당 ticker의 옵션 체인을 yfinance가 못 받았거나(rate limit), 옵션 미상장 종목(일부 ETF, ADR). `snapshot.warnings`를 확인하세요.

### "DATA_FETCH_FAILED" throw

증상: `composeTickerAnalysis`가 throw, 메시지에 "Too Many Requests" 등.

원인: yfinance rate limit. 해결:
- 잠시 대기 (수 분).
- `createYahooAdapter({ fetchOptions: false })`로 옵션 fetch 끄기 (가장 자주 막히는 호출).
- 다른 데이터 소스로 교체.

## 자동 업데이트 구성 (소비자 레포)

릴리스 → 소비자 PR 자동 생성 흐름은 `@krdn/llm-gateway` 패턴과 동일합니다.

### 동작 흐름

```
@krdn/tickerlens 새 버전 릴리스
│
├─① npm publish (publish.yml)
│   └─ 소비자 레포로 repository_dispatch 전송 → 즉시 PR 생성
│
├─② Dependabot 또는 Renovate (매일)
│   └─ 새 버전 감지 → PR 생성
│
└─③ 백업 cron 워크플로우
    └─ tag 체크 → PR 생성
```

### 소비자 레포에 추가할 워크플로우

`.github/workflows/update-tickerlens.yml`:

```yaml
name: Update @krdn/tickerlens

on:
  repository_dispatch:
    types: [tickerlens-updated]
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  check-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Update @krdn/tickerlens
        id: update
        run: |
          CURRENT=$(pnpm list @krdn/tickerlens --json 2>/dev/null \
            | grep -oP '"version":\s*"\K[^"]+' | head -1 || echo "0.0.0")
          pnpm update @krdn/tickerlens
          pnpm install
          UPDATED=$(pnpm list @krdn/tickerlens --json 2>/dev/null \
            | grep -oP '"version":\s*"\K[^"]+' | head -1 || echo "0.0.0")
          if [ "$CURRENT" = "$UPDATED" ]; then
            echo "needs_pr=false" >> "$GITHUB_OUTPUT"
          else
            echo "needs_pr=true" >> "$GITHUB_OUTPUT"
            echo "current=$CURRENT" >> "$GITHUB_OUTPUT"
            echo "updated=$UPDATED" >> "$GITHUB_OUTPUT"
          fi

      - name: Create PR
        if: steps.update.outputs.needs_pr == 'true'
        uses: peter-evans/create-pull-request@v7
        with:
          branch: chore/update-tickerlens-v${{ steps.update.outputs.updated }}
          delete-branch: true
          title: "chore(deps): @krdn/tickerlens ${{ steps.update.outputs.current }} → ${{ steps.update.outputs.updated }}"
          body: "`@krdn/tickerlens` 자동 업데이트"
          labels: dependencies
```

Renovate 사용 시 `.github/renovate.json`:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchPackageNames": ["@krdn/tickerlens", "@krdn/llm-gateway"],
      "automerge": true,
      "schedule": ["at any time"],
      "rangeStrategy": "bump",
      "labels": ["dependencies", "automerge"]
    }
  ]
}
```

## 면책

이 라이브러리는 알고리즘적 분석을 생성하며, 어떤 슬롯의 응답도 **투자 자문이 아닙니다**. 모든 거래 결정은 본인의 실사·관할권의 규제·전문가 자문을 거쳐야 합니다.
