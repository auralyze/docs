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

## Railway Deployment

::: danger FFmpeg Required
Both metadata and analysis services **require FFmpeg** to be installed. Dockerfiles are provided in each service repository that handle FFmpeg installation automatically.
:::

### Deployment Pattern

Each service deploys as a **separate Railway project** from its own repository:

```
Repository                        Railway Project
────────────────────────────────  ───────────────────────────
audio-metadata-service/          → Metadata Service
  ├── Dockerfile                    (builds with FFmpeg)
  ├── src/
  └── package.json

audio-analysis-service/          → Analysis Service
  ├── Dockerfile                    (builds with FFmpeg)
  ├── src/
  └── package.json

api/                             → API Service
  ├── src/                          (Nixpacks/npm build)
  └── package.json

web/                             → Web Service
  ├── src/                          (Next.js)
  └── package.json
```

### Docker Build Process

Railway automatically detects Dockerfiles and builds with FFmpeg:

```dockerfile
# Both audio services use this pattern
FROM node:22-slim
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production
CMD ["node", "dist/index.js"]
```

**Build Steps:**

1. Install Node.js + FFmpeg
2. Install all dependencies (including TypeScript)
3. Copy source code
4. Build TypeScript → JavaScript
5. Remove dev dependencies
6. Run compiled code

### Service Communication

Services use Railway's **private networking** for internal communication:

```bash
# API calls metadata service
METADATA_SERVICE_URL=https://metadata-service.railway.internal

# API calls analysis service
ANALYSIS_SERVICE_URL=https://analysis-service.railway.internal
```

**Benefits:**

- Faster (no public internet)
- More secure (not exposed publicly)
- Free bandwidth (internal traffic)
- Automatic service discovery

### Deployment Checklist

**1. Generate API Keys:**

```bash
# In each service repo locally
npm run generate:api-key
# Copy output to Railway environment variables
```

**2. Set Environment Variables in Railway:**

| Service  | Required Variables                                                         |
| -------- | -------------------------------------------------------------------------- |
| Metadata | `AUDIO_METADATA_API_KEY`                                                   |
| Analysis | `AUDIO_ANALYSIS_API_KEY`                                                   |
| API      | All service URLs, API keys, `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY` |
| Web      | `NEXT_PUBLIC_API_URL` (API's public URL)                                   |

**3. Add Service References:**

In Railway API project:

- Add reference to PostgreSQL database
- Add reference to metadata service (for `.railway.internal` networking)
- Add reference to analysis service (for `.railway.internal` networking)

**4. Verify Deployment:**

```bash
curl https://your-metadata-service.up.railway.app/health
curl https://your-analysis-service.up.railway.app/health
curl https://your-api.up.railway.app/health
```

::: tip Complete Setup Guide
For detailed step-by-step Railway deployment instructions, see `RAILWAY_SETUP.md` in the project root directory.
:::

