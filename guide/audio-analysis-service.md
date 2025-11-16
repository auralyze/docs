# Audio Analysis Service

The `audio-analysis-service` computes lightweight DSP metrics using `ffmpeg`
filters (`ebur128` + `astats`) and exposes them via `POST /analysis`. It returns
objects that conform to the engine’s `AnalysisSchema` (loudness, dynamics,
spectrum, stereo width).

- Auth via `x-api-key` (`AUDIO_ANALYSIS_API_KEY`). Sync the key into the API
  with `npm run analysis:api-key`.
- Default env lives in `/audio-analysis-service/.env` (`PORT=4002`,
  `FFMPEG_PATH=ffmpeg` if you want to override the bundled `ffmpeg-static`).
- Request body: `{ "path": "/abs/path" }`.
- Response: `{ loudness, dynamics, spectrum, stereo }` where loudness fields are
  real LUFS/LRA/TP readings and the other sections are heuristics derived from
  RMS stats.
- Tooling mirrors the other services (ts-node-dev, ESLint, Vitest, Prettier).

## Implementation Highlights

- `FfmpegAudioAnalysisService` executes two commands:
  - `ebur128=metadata=1:peak=true` for integrated loudness, loudness range, true
    peak.
  - `astats=metadata=1` for RMS levels, crest factor, RMS difference (used as a
    stereo width proxy).
- The service derives normalized low/mid/high spectrum scores and a width score
  from those statistics, so even short clips get deterministic metrics.
- Errors from ffmpeg are surfaced as 500s with descriptive messages.

You can replace the internal implementation with a Python microservice or GPU
pipeline later; just ensure you continue returning the `Analysis` shape.
