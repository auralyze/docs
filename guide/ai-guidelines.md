# AI Collaboration Guidelines

These guardrails help keep the proprietary engine safe when collaborating with copilots or LLMs.

## Golden rules

1. **Never share secrets** – reference `OPENAI_API_KEY` or other env vars, but do not paste tokens into chats or code.
2. **Keep the public API stable** – `runAuralyzeSession`, `EngineState`, and client interfaces are our contract with hosting services.
3. **No framework coupling** – do not add Express/Fastify adapters here; keep the package transport-agnostic.
4. **Isolate experimental nodes** – gate new LangGraph nodes behind config flags or feature branches.
5. **Update docs + tests** – whenever behavior changes, add or adjust Vitest coverage and VitePress sections.

## Suggested prompts

- “Describe how to add a stereo-image analysis node to `buildAuralyzeGraph` without breaking existing state.”
- “Draft Vitest cases covering the metadata node when ffprobe returns channel counts > 2.”
- “Explain how the feedback prompt should reference user experience levels.”

## Forbidden prompts

- Asking copilots to implement ffmpeg/DSP/HTTP clients directly in this repository.
- Requesting secrets or internal endpoints.
- Copying code snippets from GPL or unknown sources.

Keep internal discussions in approved channels and remember that this repository is proprietary.
