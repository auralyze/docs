# Audio Metadata Service

The audio-metadata service is a small Express microservice that wraps `ffprobe`
and returns the file-level metadata the engine needs (`durationSec`, `format`,
`sampleRate`, `channels`, `bitrate`). It lives at the top level of the repo in
`/audio-metadata-service` and is deployed as an independent process next to the
API.

## Responsibilities & Architecture

- **Single endpoint** – `POST /metadata` that accepts `{ "path": "/abs/path" }`
  and responds with a `FileInfo` payload that matches `@auralyze/engine`.
- **Authentication** – every request is protected by an `x-api-key` header; the
  key is stored in the service’s `.env` and mirrored into the API via a sync
  script.
- **ffprobe orchestration** – metadata extraction is handled by the
  `FfprobeAudioMetadataService` which shells out to the ffprobe binary bundled
  via `ffprobe-static`. Parsing and validation are consolidated inside
  `src/utils/audio-metadata.ts` so the HTTP layer can stay minimal.
- **Typed errors** – failures inside the service are surfaced as
  `AudioMetadataError`s (`NO_AUDIO_STREAM`, `INCOMPLETE_METADATA`,
  `PROBE_FAILED`). The router currently maps all failures to a `500` while
  logging the error.
- **Health check** – `GET /health` returns `{ "status": "ok" }`.

```text
audio-metadata-service/
├─ src/
│  ├─ app.ts                     # Express app composition
│  ├─ index.ts                   # bootstrap entrypoint
│  ├─ config/env.ts              # zod-validated env loader
│  ├─ middleware/api-key-auth.ts # reusable auth middleware
│  ├─ routes/metadata.ts         # POST /metadata implementation
│  ├─ services/audio-metadata-service.ts
│  └─ utils/audio-metadata.ts    # parsing helpers + error types
├─ scripts/generate-api-key.js   # issues AUDIO_METADATA_API_KEY
├─ package.json / tsconfig.json
└─ test/                         # vitest unit & router tests
```

## Environment & API Keys

`/audio-metadata-service/.env` defines three variables:

```ini
PORT=4001
AUDIO_METADATA_API_KEY=super-secret-key
FFPROBE_PATH=ffprobe
```

- `AUDIO_METADATA_API_KEY` secures the service. Run
  `npm run generate:api-key` inside `audio-metadata-service/` to rotate the key.
- `FFPROBE_PATH` defaults to the static binary packaged with `ffprobe-static`.
  Override it if your deployment needs a system binary.

To keep the API in sync, run `npm run metadata:api-key` inside `/api`. The
script in `api/scripts/sync-metadata-api-key.js` copies the key from the
service `.env` into `api/.env` under `METADATA_SERVICE_API_KEY`.

## Running Locally

```bash
cd audio-metadata-service
npm install
npm run dev # ts-node-dev with live reload
```

`npm run build` compiles to `dist/` and `npm start` runs the JS build. Use
`npm test` (Vitest) for unit + router coverage. Tests cover:

- Success path for `FfprobeAudioMetadataService`
- Error classification (`NO_AUDIO_STREAM`, `INCOMPLETE_METADATA`, `PROBE_FAILED`)
- Router level validation/authentication and error logging

## HTTP Interface

### Authentication

Every request must include `x-api-key: <AUDIO_METADATA_API_KEY>`. Calls without a
key or with the wrong value receive `401 { "error": "Unauthorized" }`.

### Health

```bash
curl http://localhost:4001/health
# -> { "status": "ok" }
```

### POST /metadata

Request body (validated with Zod):

```json
{
  "path": "/absolute/or/container/path/to/audio.wav"
}
```

Response (`FileInfo`):

```json
{
  "durationSec": 213.42,
  "format": "wav",
  "sampleRate": 48000,
  "channels": 2,
  "bitrate": 1411200
}
```

Possible error responses:

| Status | Body                                   | When                                       |
| ------ | -------------------------------------- | ------------------------------------------ |
| 400    | `{ "error": "Invalid request body" }`  | Missing/empty `path`                       |
| 401    | `{ "error": "Unauthorized" }`          | Missing or incorrect `x-api-key`           |
| 500    | `{ "error": "Failed to read metadata" }` | ffprobe fails or returns incomplete data |

In production we can easily extend the router to inspect the error `code`
(`NO_AUDIO_STREAM`, `INCOMPLETE_METADATA`, `PROBE_FAILED`) and map them to
`4xx/5xx` responses.

## Integration with the API

Inside `/api` the `HttpAudioMetadataClient` calls this service and implements
the `AudioMetadataClient` interface required by `@auralyze/engine`:

```ts
const metadataClient = new HttpAudioMetadataClient({
  baseUrl: process.env.METADATA_SERVICE_URL,
  apiKey: process.env.METADATA_SERVICE_API_KEY,
});
```

The Session Service passes that client to `runAuralyzeSession`, so every engine
run automatically enriches the session with the metadata returned by the
microservice.

### Required API Env Vars

| Variable                     | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `METADATA_SERVICE_URL`       | e.g. `http://audio-metadata-service:4001`   |
| `METADATA_SERVICE_API_KEY`   | kept in sync with `AUDIO_METADATA_API_KEY` |

If either value is missing the API falls back to stub clients, so make sure
both are configured in real environments.

## Deployment Checklist

1. Build the service (`npm run build`) and ship the `dist/` folder plus `node_modules`.
2. Provide a writable directory where the service can access the audio files
   (the `path` is treated as an on-disk location right now).
3. Set `AUDIO_METADATA_API_KEY` and share it with the API via
   `METADATA_SERVICE_API_KEY`.
4. Ensure ffprobe is available – the bundled static binary works on most linux
   targets, otherwise configure `FFPROBE_PATH`.
5. Wire health checks to `GET /health`.

With those pieces in place the engine pipeline can rely on a consistent,
authenticated metadata provider, fully decoupled from the main API process.
