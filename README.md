# Mixtapelabs Engine Documentation (`@mixtapelabs/docs`)

VitePress site that documents the LangGraph-powered `@mixtapelabs/engine`. These docs explain how to run the mix-analysis workflow (`runMixtapelabsSession`), wire custom metadata/analysis/LLM clients, and publish guidance for teams integrating the engine into APIs, workers, or CLI tooling.

## Overview

- **Audience** – Audio tool engineers, infra teams, and contributors who need architectural and operational context for the engine.
- **Scope** – Session state schemas, dependency injection contracts, LangGraph node behavior, prompting strategies, testing practices, and release automation.
- **Goal** – Keep downstream services aligned on how mixes are validated, enriched, analyzed, and pushed through feedback modules so responses stay actionable and consistent.

## Stack & Layout

| Path                       | Purpose                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `index.md`                 | Landing page outlining the end-to-end `runMixtapelabsSession` flow.                                                   |
| `guide/getting-started.md` | Onboarding walkthrough plus install/auth instructions for the private npm package.                                    |
| `guide/session-state.md`   | Canonical Zod schemas for inputs, metadata, and DSP outputs.                                                          |
| `guide/langgraph.md`       | Details for every LangGraph node (validate → metadata → analysis → feedback → finalize).                              |
| `guide/clients.md`         | How to implement `audioMetadataClient`, `audioAnalysisClient`, and `feedbackClient` including OpenAI-backed defaults. |
| `guide/prompting.md`       | LLM prompt curation, tone guidelines, and safety rails.                                                               |
| `guide/testing.md`         | Vitest coverage expectations for nodes, prompt builders, and public API contracts.                                    |
| `guide/releasing.md`       | Package publishing + CI release workflow; ties back to `.github/workflows/release.yml`.                               |
| `guide/dev-playground.md`  | Scratchpad for experimenting with LangGraph sessions locally.                                                         |

The site relies purely on TypeScript/VitePress—no server-side logic—so it can be hosted anywhere that serves static assets.

## Developing Locally

```bash
npm install
npm run docs:dev     # VitePress dev server at http://localhost:5173
npm run docs:build   # Emit static site to .vitepress/dist
npm run docs:preview # Preview the latest production build locally
```

VitePress hot reload mirrors the engine’s iterative workflow development: update guides, component diagrams, or code samples and refresh to verify formatting. Keep example snippets in sync with the actual package (`@mixtapelabs/engine`) so users can copy/paste realistic usage such as:

```ts
const result = await runMixtapelabsSession(input, {
  audioMetadataClient,
  audioAnalysisClient,
  feedbackClient: new OpenAIFeedbackClient({ model: "gpt-4o-mini" }),
});
```

## Authoring Content

- Favor task-based sections (e.g., “Injecting custom analysis clients”) rather than passive reference dumps.
- Highlight environment variables like `OPENAI_API_KEY`, `AURALYZE_ENV`, and downstream DSP credentials near the workflows that require them.
- Use callouts for private-registry steps (`npm install @mixtapelabs/engine --registry https://npm.pkg.github.com`) so teams avoid auth surprises.
- Keep diagrams (Mermaid) focused on session state transitions—`validateInput → metadataStep → analysisStep → feedbackStep → finalize`.
- Update release/test guides whenever scripts in the engine repo change (`npm run typecheck`, `npm run ci`, etc.).

## Deployment

- `.github/workflows/docs.yml` builds the site on every push to `main`.
- The action force-pushes `.vitepress/dist` into a companion repo/branch (defaults to `mixtapelabs/engine-docs@gh-pages`).
- Add `DOCS_PUBLISH_TOKEN` (and optional `DOCS_REPOSITORY`, `DOCS_BRANCH`) secrets so the workflow can push over HTTPS.
- Enable GitHub Pages on the destination repo to publish the site publicly or privately.

## Related Projects

- [`@mixtapelabs/engine`](https://github.com/mixtapelabs/engine) – LangGraph workflow engine that powers mix analysis.
- `mixtapelabs/engine-docs` (publish target) – Static artifact repo served via GitHub Pages.

Questions or improvement ideas? Open an issue in the docs repo so updates ship alongside the latest engine changes.
