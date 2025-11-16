# Audio Feedback Service

The `audio-feedback-service` mirrors the other microservices but focuses on the
feedback-generation step (`POST /feedback`). Right now it returns stubbed
responses so you can test the API/engine integration without depending on LLMs.

- Auth via `x-api-key` (`AUDIO_FEEDBACK_API_KEY`). Sync it into the API with
  `npm run feedback:api-key`.
- Default env lives in `/audio-feedback-service/.env` (`PORT=4003`).
- Request body: `{ "path": "/abs/path" }`. Response matches the
  `FeedbackClient` contract (`{ feedbackText, suggestions[] }`).
- Tooling matches the other services (ts-node-dev, ESLint, Vitest, etc.).

This service is a natural place to host deterministic rule-based feedback or to
proxy an LLM provider you manage separately from the API runtime. The API will
call it when `FEEDBACK_MODE=service` and both `FEEDBACK_SERVICE_URL` and
`FEEDBACK_SERVICE_API_KEY` are configured.
