# darpan-ui

Command-first frontend application for Darpan.

## Purpose

- Host migrated module screens in `darpan-ui` while backend screens remain in parallel during cutover.
- Consume authenticated facade contracts from `darpan-backend` (`service/facade/**`).
- Keep custom UI/PWA behavior out of backend `screen/**`, `template/**`, and `theme-library/**`.

## Ownership boundary

- `darpan-ui`: all custom UI, PWA shell, and browser interaction flows.
- `darpan-backend`: Moqui backend contracts, business logic, and reconciliation processing only.

## Tech Stack

- Vue 3
- TypeScript (strict)
- Vite
- ESLint (flat config)
- Vitest

## Configuration

Set environment variables in `.env` for local development:

```bash
# Optional in local dev. If omitted, darpan-ui uses same-origin /rpc/json with Vite proxy.
# VITE_DARPAN_API_BASE_URL=http://localhost:8080
# VITE_DARPAN_RPC_URL=http://localhost:8080/rpc/json
# Optional customer-safe Linear access pages exposed from /roadmap/reconciliation.
# VITE_DARPAN_LINEAR_ROADMAP_URL=https://linear.app/your-public-roadmap
# VITE_DARPAN_LINEAR_REQUEST_URL=https://linear.app/your-request-form
# Optional. Set false when the Linear target should open only in a new tab.
# VITE_DARPAN_LINEAR_EMBED_ENABLED=true
VITE_DARPAN_AUTH_BYPASS=false
```

## Firebase Hosting Deployment

Firebase uses the `darpan` project alias for project `darpan-fa2aa`.

UAT deploys use target `hosting:uat`, site `hc-darpan-uat`, custom domain `darpan-app-uat.hotwax.io`, and the checked-in `.env.firebase` backend mapping:

```bash
firebase use darpan
firebase deploy --only hosting:uat
```

UAT environment:

```bash
VITE_DARPAN_API_BASE_URL=https://darpan-uat.hotwax.io
VITE_DARPAN_RPC_URL=https://darpan-uat.hotwax.io/rpc/json
```

Production deploys use target `hosting:prod`, site `hc-darpan`, custom domain `darpan-app.hotwax.io`, and an ignored `.env.production` file copied from `.env.example`:

```bash
cp .env.example .env.production
firebase use darpan
firebase deploy --only hosting:prod
```

Production environment:

```bash
VITE_DARPAN_API_BASE_URL=https://darpan.hotwax.io
VITE_DARPAN_RPC_URL=https://darpan.hotwax.io/rpc/json
```

Notes:

- `.env.example` is a template only. Vite does not load it.
- `.env.firebase` overrides local `.env` values during `npm run build:firebase` for UAT.
- `.env.production` is intentionally ignored and must not be committed.
- `firebase deploy --only hosting:uat` runs `npm run build:firebase` automatically through `firebase.json`.
- `firebase deploy --only hosting:prod` runs `npm run build` automatically through `firebase.json`.

## GitHub Pages Deployment

The current public Pages URL is:

- `https://drpn-ai.github.io/darpan-ui/`

For release-week auth and cookie validation, the Pages build must be pointed at a real backend target through GitHub Actions repository or environment variables:

```bash
VITE_DARPAN_API_BASE_URL=https://your-darpan-host.example.com
# or, when the RPC route is different from the API origin:
VITE_DARPAN_RPC_URL=https://your-darpan-host.example.com/rpc/json
```

Notes:

- `VITE_DARPAN_RPC_URL` wins when both are set.
- If neither backend variable is set, the deployed Pages app falls back to same-origin `/rpc/json`.
- On GitHub Pages, that fallback is not a valid backend target by itself, so the Pages URL alone is not enough for release auth or cookie validation.
- Prefer the final smoke test to run against the same-site or reverse-proxied host that will actually serve invite-only users.

For local UI-only prototyping without backend login, set:

```bash
VITE_DARPAN_AUTH_BYPASS=true
```

## Commands

```bash
npm install
npm run dev
npm run dev:stack
npm run check
npm run build
npm run preview
```

Default local URL: `http://localhost:5173`.

Use `npm run dev:stack` when working against the local backend and frontend together. The helper starts Vite plus `../darpan-backend/gradlew run` and stops both when you exit.

Before starting, the helper clears any existing listeners on the expected backend and frontend ports so the new session can come up on the intended ports instead of falling back to alternates.

If the backend checkout lives somewhere else, override the path before running the command:

```bash
DARPAN_BACKEND_DIR=/absolute/path/to/darpan-backend npm run dev:stack
```

If the backend needs a different startup command, Gradle task, or port defaults, override them with one of:

```bash
DARPAN_BACKEND_TASK=runProduction npm run dev:stack
DARPAN_BACKEND_COMMAND="./gradlew --no-daemon runProduction" npm run dev:stack
DARPAN_BACKEND_PORT=8081 DARPAN_FRONTEND_PORT=5174 npm run dev:stack
```

## Routes

- `/login` (initial screen)
- `/` (module hub)
- `/settings/ai`
- `/settings/ai/create`
- `/settings/ai/edit/:llmProvider`
- `/settings/sftp`
- `/settings/sftp/create`
- `/settings/sftp/edit/:sftpServerId`
- `/settings/netsuite`
- `/settings/netsuite/auth/create`
- `/settings/netsuite/auth/edit/:nsAuthConfigId`
- `/settings/netsuite/endpoints/create`
- `/settings/netsuite/endpoints/edit/:nsRestletConfigId`
- `/settings/runs`
- `/settings/runs/edit/:reconciliationMappingId`
- `/schemas/library`
- `/schemas/create`
- `/schemas/editor/:jsonSchemaId`
- `/reconciliation/create`
- `/reconciliation/diff`
- `/reconciliation/ruleset-manager`
- `/reconciliation/ruleset-manager/rules`
- `/reconciliation/run-result/:savedRunId/:outputFileName`
- `/reconciliation/run-history/:savedRunId`
- `/roadmap/reconciliation` (customer roadmap and request access, backed by configurable Linear URLs)

## Redirect Support

- `/connections/**` routes redirect into the current settings dashboards and workflows.
- `/schemas/infer` and `/schemas/edit/:jsonSchemaId` redirect into the current schema create/editor routes.

## Notes

- API contracts remain owned by `darpan-backend/runtime/component/darpan/service/facade/**`.
