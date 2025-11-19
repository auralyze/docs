# Microservices Overview

The Auralyze platform splits heavy lifting into three microservices so the API
and engine can stay lean:

::: warning Timeout Protection
All services implement 25-second timeouts to prevent Railway 502 errors. See [Production Deployment Guide](./operations/production-deployment.md) for details on handling large files.
:::

| Service                | Repo Folder               | Endpoint         | Purpose                                                                                                                                                    |
| ---------------------- | ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio Metadata Service | `/audio-metadata-service` | `POST /metadata` | Wraps `ffprobe` to return duration, format, sample rate, channels, bitrate. Includes timeout protection for large file downloads.                          |
| Audio Analysis Service | `/audio-analysis-service` | `POST /analysis` | Runs `ffmpeg` (`ebur128` + `astats`) to produce loudness, crest factor, spectrum, and stereo width heuristics. Kills long-running FFmpeg processes at 25s. |
| Audio Feedback Service | `/audio-feedback-service` | `POST /feedback` | Calls OpenAI using the engine's `fileInfo`/`analysis` payload to return `{ feedbackText, suggestions[] }`.                                                 |

All three services share the same structure:

- Express + Zod validation
- Global `x-api-key` middleware (`AUDIO_*_API_KEY` envs)
- `GET /health` probes
- Vitest unit/router suites
- ESLint/Prettier/TypeScript configs matching the API repo
- `scripts/generate-api-key.js` to rotate secrets

## Environment & Sync Scripts

| Service  | Default Port | Env Vars                                          | API Sync Script                                                             |
| -------- | ------------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Metadata | `PORT=4001`  | `AUDIO_METADATA_API_KEY`, optional `FFPROBE_PATH` | `npm run metadata:api-key` in `/api` (reads `/audio-metadata-service/.env`) |
| Analysis | `PORT=4002`  | `AUDIO_ANALYSIS_API_KEY`                          | `npm run analysis:api-key`                                                  |
| Feedback | `PORT=4003`  | `AUDIO_FEEDBACK_API_KEY`                          | `npm run feedback:api-key`                                                  |

Run the service-specific `npm run generate:api-key` to rotate secrets, then run
the matching `sync-*.js` script inside `/api` so `METADATA/ANALYSIS/FEEDBACK_SERVICE_API_KEY`
stays in sync.

## Integration Modes

::: tip Stubs Disabled
As of November 2025, stub clients are permanently disabled in the API to ensure production reliability. All deployments must use real service URLs.
:::

- **Metadata** – Required in every deployment. The API always calls this first
  to normalize audio files. Must provide `METADATA_SERVICE_URL` and `METADATA_SERVICE_API_KEY`.
- **Analysis** – Required. Must provide `ANALYSIS_SERVICE_URL` and `ANALYSIS_SERVICE_API_KEY`.
- **Feedback** – Choose between:
  - `FEEDBACK_MODE=openai`: `OpenAIFeedbackClient` with `OPENAI_API_KEY` (recommended)
  - `FEEDBACK_MODE=service`: `HttpAudioFeedbackClient` calling the feedback microservice

A healthy production deployment typically uses:
- Metadata + Analysis services (required)
- `FEEDBACK_MODE=openai` for direct OpenAI calls (simpler, faster)
- OR all three services if you need to customize feedback logic

All services should be on the same network (Railway internal URLs) for optimal performance.
