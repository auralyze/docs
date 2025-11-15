# Prompting & Feedback Generation

`src/prompts/feedback-prompt.ts` constructs deterministic system/user messages for the feedback client. `OpenAIFeedbackClient` reuses the prompt and enforces JSON output via `response_format`.

## Prompt design goals

- **Context-rich** – includes file info, analysis data, and optional `userContext` block.
- **Actionable** – instructs the model to highlight positives, note issues across loudness/dynamics/spectrum/stereo, and return 3–7 concrete suggestions.
- **Machine-parseable** – the client expects a JSON payload with `feedbackText` and `suggestions`.

### System message snippet

```
You are Auralyze, an AI mix and mastering assistant. Generate concise, empathetic, and
practical critiques of songs based on structured analysis data. Speak directly to a music
producer. Always return valid JSON.
```

### User message snippet

```
You are analyzing session ${sessionId}.
Uploaded file URL: ${uploadUrl ?? '(missing)'}.
File info: {...}
Analysis: {...}
User context: {...}
Task:
- Summarize the overall mix character in 2-3 sentences.
- Highlight strengths.
- Highlight issues around loudness, dynamics, spectrum, and stereo imaging.
- Offer 3-7 concrete, actionable suggestions...
Return ONLY JSON with the following shape:
{ "feedbackText": "string", "suggestions": ["string"] }
```

## Custom feedback strategies

You can replace `OpenAIFeedbackClient` entirely or wrap it with rule-based logic.

1. Clone `buildFeedbackPrompt` and adapt the instructions.
2. Feed the prompt into your model of choice (Anthropic, Vertex AI, etc.).
3. Validate the JSON using `FeedbackResponseSchema` to keep parsing strict.

## Validation

`FeedbackResponseSchema` ensures we never accept malformed outputs:

```ts
import { FeedbackResponseSchema } from '@auralyze/engine/prompts/feedback-prompt';

const result = FeedbackResponseSchema.parse(JSON.parse(modelOutput));
```

Tests under `test/feedback-prompt.test.ts` guarantee that the prompt embeds relevant context and rejects suggestion lists outside the 3–7 range.
