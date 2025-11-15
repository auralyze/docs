# Getting Started

This guide shows how to install `@auralyze/engine`, wire your dependency clients, and invoke the workflow from another service.

## Installation

```bash
npm install @auralyze/engine
```

The package ships ESM + CJS bundles and TypeScript declarations so you can consume it from any Node 18+ project.

## Minimum dependencies

Provide three clients when calling `runAuralyzeSession`:

```ts
import {
  runAuralyzeSession,
  type AuralyzeEngineDeps,
} from '@auralyze/engine';

const deps: AuralyzeEngineDeps = {
  audioMetadataClient: {
    async getMetadata({ url }) {
      // your ffprobe microservice or storage metadata
      return {
        durationSec: 210,
        format: 'wav',
        sampleRate: 48000,
        channels: 2,
        bitrate: 320000,
      };
    },
  },
  audioAnalysisClient: {
    async analyze({ url }) {
      // your DSP analysis worker
      return {
        loudness: {
          integratedLUFS: -12,
          truePeak: -1,
          loudnessRange: 7,
        },
        dynamics: { crestFactor: 9.5 },
        spectrum: { low: -6, mids: -3, highs: -4 },
        stereo: { widthScore: 0.71 },
      };
    },
  },
  feedbackClient: {
    async generateFeedback(state) {
      // typically wraps OpenAI or another LLM
      return {
        feedbackText: `Mix ${state.sessionId} has solid momentum but re-balance low mids`,
        suggestions: [
          'Tighten 250Hz in bass buss',
          'Ease limiter ceiling by ~0.5 dB',
          'Automate vocal air EQ for choruses',
        ],
      };
    },
  },
};

const engineState = await runAuralyzeSession(
  {
    sessionId: 'mix-42',
    uploadUrl: 'https://cdn.example.com/uploads/mix.wav',
    userContext: {
      daw: 'Ableton Live',
      genre: 'trap',
      experienceLevel: 'intermediate',
    },
  },
  deps,
);
```

`engineState` mirrors the `EngineStateSchema` defined in `src/state.ts`.

## Scripts

| Command                            | Description                                 |
| ---------------------------------- | ------------------------------------------- |
| `npm run lint`                     | ESLint against `src/**/*.ts`                |
| `npm run typecheck`                | `tsc --noEmit`                              |
| `npm test -- --run`                | Vitest                                      |
| `npm run test -- --coverage --run` | Vitest with coverage                        |
| `npm run build`                    | `tsup` build to `dist/`                     |
| `npm run dev`                      | `ts-node` playground with fake clients      |
| `npm run docs:dev`                 | VitePress docs dev server                   |
| `npm run docs:build`               | Build static docs to `docs/.vitepress/dist` |

## Environments and secrets

| Variable             | Purpose                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`     | Required for `OpenAIFeedbackClient`; the engine never hardcodes keys.                                                                      |
| `DOCS_PUBLISH_TOKEN` | Personal access token used by the docs workflow to push built artifacts to the public docs repo (see [Releasing & CI/CD](./releasing.md)). |

You now have a minimal integration. Continue to the next sections to understand state modeling, LangGraph execution, and tooling.
