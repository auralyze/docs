# Audio Feedback Service

The `audio-feedback-service` mirrors the other microservices but focuses on the
feedback-generation step (`POST /feedback`). It now calls OpenAI’s Responses API
to turn the engine’s `fileInfo`, `analysis`, and `userContext` payloads into
`{ feedbackText, suggestions[] }`.

- Auth via `x-api-key` (`AUDIO_FEEDBACK_API_KEY`). Sync the key into the API with
  `npm run feedback:api-key`.
- Default env lives in `/audio-feedback-service/.env` (`PORT=4003`,
  `OPENAI_MODEL=gpt-4.1-mini`).
- Request body: subset of `EngineState` (fileInfo/analysis/userContext). The API
  already has this after calling metadata + analysis, so it simply forwards the
  state to the service.
- Response matches the engine’s `FeedbackClient` contract.

The API will call this service when `FEEDBACK_MODE=service` and both
`FEEDBACK_SERVICE_URL` and `FEEDBACK_SERVICE_API_KEY` are configured. You can
still fall back to `FEEDBACK_MODE=openai` (direct SDK call) or `FEEDBACK_MODE=stub`
if you want to bypass the microservice.
