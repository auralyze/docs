# API Reference

The `/api` repo exposes a thin REST layer in front of `@mixtapelabs/engine`. All
endpoints live under the same Express app and share JWT/Cerberus middleware.

## Base URL & Auth

- **Base URL** – depends on your deployment (`https://api.mixtapelabs.com` or
  `http://localhost:4001`).
- **Authentication** – production requests carry `Authorization: Bearer <token>`
  issued by Cerberus IAM. Local/dev flows can fall back to `JWT_SECRET` for
  signing tokens.

## Endpoints

### POST `/api/auth/login`

Proxy to Cerberus `/v1/auth/login`. Accepts `{ email, password, otp? }` and
returns the Cerberus user/org payload (no tokens).

### POST `/api/auth/token`

Unified token helper with two grant types:

- `authorization_code` – body includes `code`, `redirectUri`, `codeVerifier`.
- `client_credentials` – body includes optional `scope`; client credentials are
  read from env unless overridden.

Response matches Cerberus (`access_token`, `refresh_token`, `expires_in`, etc.).

### GET `/api/auth/me`

Requires `Authorization: Bearer <token>`. The API introspects the token via
Cerberus and returns the verified user payload (user, organisation, scopes).

### POST `/api/sessions`

Entrypoint for the engine. Body:

```jsonc
{
  "sessionId": "mix-42",
  "uploadUrl": "https://cdn.example.com/mix.wav",
  "userContext": { "daw": "Ableton Live" }
}
```

Response: `EngineState` as defined in `@mixtapelabs/engine`. Include an auth token
in production; local dev can stub auth middleware if needed.

Errors conform to the same JSON shape (`{ error: string }`).

## Environment Summary

| Variable                                                              | Purpose                                     |
| --------------------------------------------------------------------- | ------------------------------------------- |
| `PORT`                                                                | API port (default `4001`).                  |
| `DATABASE_URL`                                                        | PostgreSQL DSN for the session repository.  |
| `CERBERUS_BASE_URL` / `CERBERUS_CLIENT_ID` / `CERBERUS_CLIENT_SECRET` | Required for production auth.               |
| `JWT_SECRET`                                                          | Optional fallback for local JWTs.           |
| `METADATA_SERVICE_URL` / `_API_KEY`                                   | Required when not using stubs.              |
| `ANALYSIS_SERVICE_URL` / `_API_KEY`                                   | Same as above.                              |
| `FEEDBACK_SERVICE_URL` / `_API_KEY`                                   | Required when `FEEDBACK_MODE=service`.      |
| `FEEDBACK_MODE`                                                       | `openai`, `stub`, or `service`.             |
| `OPENAI_API_KEY`                                                      | Needed when `FEEDBACK_MODE=openai`.         |
| `USE_STUB_CLIENTS`                                                    | Force stub clients regardless of URLs/keys. |

Use the sync scripts (`npm run metadata:api-key`, `analysis:api-key`,
`feedback:api-key`) to copy secrets from each microservice’s `.env` file into
`api/.env`.
