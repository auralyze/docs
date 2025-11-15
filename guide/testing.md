# Testing Strategy

Auralyse Engine ships with a layered Vitest suite and 100% coverage over `src/`.

## Commands

```bash
npm test -- --run              # unit + integration
npm run test -- --coverage --run  # includes coverage report
```

## Suites

| File | Focus |
| --- | --- |
| `test/state.test.ts` | Zod schemas accept valid shapes and reject invalid ones. |
| `test/tools.test.ts` | Tool wrappers enforce input schemas before hitting injected clients. |
| `test/feedback-prompt.test.ts` | Prompt builder includes context, schema enforces suggestion count. |
| `test/config/llm.test.ts` | `OpenAIFeedbackClient` handles missing keys, valid responses, malformed JSON, and empty content. |
| `test/graph/auralyseGraph.unit.test.ts` | LangGraph nodes cover happy path plus error propagation. |
| `test/graph/auralyseGraph.integration.test.ts` | End-to-end run via `runAuralyseSession` using fake clients. |

## Writing new tests

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildAuralyseGraph } from '../src/graph/auralyse-graph';

it('handles new crest-factor node', async () => {
  const deps = { ... };
  const graph = buildAuralyseGraph(deps);
  const result = await graph.invoke(initialState);
  expect(result.analysis?.transients).toBeDefined();
});
```

Remember to stub your injected clients (`vi.fn()`) so unit tests stay deterministic.
