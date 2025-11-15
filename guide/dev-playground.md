# Dev Playground

`src/dev.ts` is a small ts-node script that exercises the engine with fake clients. It exists for manual demos and sanity checks.

## Running the playground

```bash
npm run dev
```

- Uses hardcoded metadata + analysis responses.
- Instantiates `OpenAIFeedbackClient` if `OPENAI_API_KEY` is set, otherwise falls back to canned feedback text.
- Prints the resulting `EngineState` to stdout.

## Customizing the playground

Edit `FakeMetadataClient`, `FakeAnalysisClient`, or `DemoFeedbackClient` to mock scenarios:

- Missing metadata/analysis
- Genre-specific prompts
- Experimenting with new schema fields

Because the playground uses the public `runAuralyseSession` API, any behavior you observe matches what the API service would see.
