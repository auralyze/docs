# Microservices Overview

The Auralyze platform splits heavy lifting into three microservices so the API
and engine can stay lean:

| Service | Repo Folder | Endpoint | Purpose |
| --- | --- | --- | --- |
| Audio Metadata Service | `/audio-metadata-service` | `POST /metadata` | Wraps `ffprobe` to return duration, format, sample rate, channels, bitrate. |
| Audio Analysis Service | `/audio-analysis-service` | `POST /analysis` | Placeholder today; future DSP pipeline to compute loudness, stereo, spectrum, etc. |
| Audio Feedback Service | `/audio-feedback-service` | `POST /feedback` | Stub feedback generator; future home for deterministic rules or a managed LLM service. |

All three services share the same structure:

- Express + Zod validation
- Global `x-api-key` middleware (`AUDIO_*_API_KEY` envs)
- `GET /health` probes
- Vitest unit/router suites
- ESLint/Prettier/TypeScript configs matching the API repo
- `scripts/generate-api-key.js` to rotate secrets

## Environment & Sync Scripts

| Service | Default Port | Env Vars | API Sync Script |
| --- | --- | --- | --- |
| Metadata | `PORT=4001` | `AUDIO_METADATA_API_KEY`, optional `FFPROBE_PATH` | `npm run metadata:api-key` in `/api` (reads `/audio-metadata-service/.env`) |
| Analysis | `PORT=4002` | `AUDIO_ANALYSIS_API_KEY` | `npm run analysis:api-key` |
| Feedback | `PORT=4003` | `AUDIO_FEEDBACK_API_KEY` | `npm run feedback:api-key` |

Run the service-specific `npm run generate:api-key` to rotate secrets, then run
the matching `sync-*.js` script inside `/api` so `METADATA/ANALYSIS/FEEDBACK_SERVICE_API_KEY`
stays in sync.

## Integration Modes

- **Metadata** – required in every deployment. The API always calls this first
  to normalize audio files.
- **Analysis** – optional until the DSP pipeline exists; the API expects a URL
  and key but you can run in `USE_STUB_CLIENTS=true` mode locally.
- **Feedback** – choose between:
  - `FEEDBACK_MODE=stub`: canned responses from `createStubDeps()`
  - `FEEDBACK_MODE=openai`: `OpenAIFeedbackClient` with `OPENAI_API_KEY`
  - `FEEDBACK_MODE=service`: `HttpAudioFeedbackClient` calling the microservice

A healthy deployment wires all three services (plus the API) behind the same
network so the engine can complete every node without touching third-party
APIs directly.
