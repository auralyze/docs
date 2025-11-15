# VitePress Documentation

This directory contains the VitePress site for `@auralyze/engine`.

## Key files
- `.vitepress/config.ts` – site metadata, navigation, sidebar.
- `index.md` – landing page with architecture summary.
- `guide/` – topic-specific docs (onboarding, state schemas, LangGraph workflow, testing, releasing, etc.).

## Scripts
```bash
npm run docs:dev     # local dev server at http://localhost:5173
npm run docs:build   # emit static site to docs/.vitepress/dist
npm run docs:preview # preview the built site
```

## Deployment
The workflow `.github/workflows/docs.yml` builds the site on pushes to `main` and force-pushes the static output to a separate repository/branch (defaults `auralyze/engine-docs` → `gh-pages`). Configure the `DOCS_PUBLISH_TOKEN` secret and optional `DOCS_REPOSITORY` / `DOCS_BRANCH` variables to control the destination. Enable GitHub Pages on the target repo to publish the documentation.
