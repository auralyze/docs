# Dependency Injection & Clients

The engine never calls external services on its own. Instead you inject concrete clients through `AuralyzeEngineDeps`.

## Interfaces

```ts
export interface AudioMetadataClient {
  getMetadata(input: { url: string }): Promise<FileInfo>;
}

export interface AudioAnalysisClient {
  analyze(input: { url: string }): Promise<Analysis>;
}

export interface FeedbackClient {
  generateFeedback(state: EngineState): Promise<{
    feedbackText: string;
    suggestions: string[];
  }>;
}
```

### Metadata client tips

- Call your storage/DAM service or ffprobe wrapper.
- Normalize units (seconds, Hz, kbps) before returning.
- Throw descriptive errors; the metadata node surfaces the message via `EngineState.error`.

### Analysis client tips

- Keep heavy DSP work outside this repo (FFmpeg, pyloudnorm, proprietary ML).
- Return partial analysis objects when metrics are missing—the schema is optional per block.
- Prefer deterministic outputs for tests; the Vitest suites stub these clients extensively.

### Feedback client tips

- `OpenAIFeedbackClient` lives in `src/config/llm.ts` and expects `OPENAI_API_KEY`.
- You can wrap Claude, Gemini, or an internal rule engine so long as you return `{ feedbackText, suggestions[] }`.
- The client receives the entire `EngineState` so you can make decisions based on metadata, genre, or analysis gaps.

### Example: hybrid feedback implementation

```ts
import { OpenAIFeedbackClient } from '@auralyze/engine';

const llmClient = new OpenAIFeedbackClient({ model: 'gpt-4o-mini' });

const feedbackClient: FeedbackClient = {
  async generateFeedback(state) {
    if (!state.analysis?.loudness) {
      // fallback when DSP timed out
      return {
        feedbackText: 'Upload did not finish analysis. Please retry.',
        suggestions: ['Re-upload the mix', 'Verify the file is stereo WAV'],
      };
    }

    return llmClient.generateFeedback(state);
  },
};
```

Keep clients pure and side-effect free; the LangGraph workflow retries are easier when nodes simply read state and return partial updates.
