# Audio Analysis Service

The `audio-analysis-service` is a scaffolded Express microservice that mirrors
the metadata service’s tooling but focuses on the DSP-heavy analysis stage
(`POST /analysis`). It currently returns stubbed data so you can exercise the API
end-to-end while the actual analysis pipeline is under construction.

- Auth is handled via `x-api-key` (`AUDIO_ANALYSIS_API_KEY`, sync via
  `npm run analysis:api-key` inside `/api`).
- Env defaults live in `/audio-analysis-service/.env` (`PORT=4002`).
- The HTTP surface expects `{ path: "/abs/path" }` and returns an
  `Analysis` object matching `@auralyze/engine`.
- `npm run dev`, `npm test`, `npm run lint`, etc. are all wired up just like the
  metadata service.

## Why scaffold a separate service?

- Keeps ffprobe/analysis dependencies out of the API runtime.
- Allows independent scaling (heavy DSP vs. REST traffic).
- Provides a well-defined contract for experimentation (swap in Python workers,
  GPU pipelines, etc.).

When you’re ready, replace the `StubAudioAnalysisService` with your real DSP
implementation and expand the tests to cover your pipeline’s outputs.
