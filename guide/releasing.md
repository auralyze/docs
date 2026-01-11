# Releasing & CI/CD

This page explains how to run CI locally, publish the npm package, and deploy the VitePress docs.

## CI workflow

`.github/workflows/ci.yml` triggers on every push and pull request:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test -- --run`
5. `npm run build`

Run `npm run ci` locally before opening a PR.

## NPM publishing

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm publish --access public   # or private registry
```

The `prepare` script ensures `npm publish` always builds fresh artifacts.

## Docs deployment

A dedicated workflow (`.github/workflows/docs.yml`) builds the VitePress site and pushes the static assets to a separate repo (default `mixtapelabs/engine-docs`) on the `gh-pages` branch.

Configure secrets:

| Secret               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `DOCS_PUBLISH_TOKEN` | PAT with `repo` scope for the destination docs repository. |

By default the workflow runs on pushes to `main`, but you can restrict it to tags or manual triggers.

## GitHub Pages setup (remote repo)

1. Create a repository (e.g., `mixtapelabs/engine-docs`).
2. Enable GitHub Pages for the `gh-pages` branch.
3. Store a PAT as `DOCS_PUBLISH_TOKEN` in the engine repo.
4. Merge to `main`; the workflow builds docs and pushes to the docs repo, which GitHub Pages serves.

## Versioning guidelines

- Bump `package.json` `version` when changing the EngineState schema or LangGraph behavior.
- Document breaking changes in `docs/guide/session-state.md` and the README changelog section (if you add one).
- Tag releases (`git tag v0.x.y && git push origin --tags`) to trigger the release workflow.
