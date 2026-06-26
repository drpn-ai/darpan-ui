# darpan-ui

Command-first frontend application for Darpan.

## Purpose

- Serve all custom Darpan UI from this single-page Vue app.
- Consume authenticated facade contracts from `darpan-backend` (`service/facade/**`) over JSON-RPC (`/rpc/json`).
- Keep custom UI/PWA behavior out of backend `screen/**`, `template/**`, and `theme-library/**`.

## Ownership boundary

- `darpan-ui`: all custom UI, PWA shell, and browser interaction flows.
- `darpan-backend`: Moqui backend contracts, business logic, and reconciliation processing only.

## Tech Stack

- Vue 3
- TypeScript (strict)
- Vite
- Vue Router
- Pinia
- ESLint (flat config)
- Vitest

## Source Layout

- `src/router/index.ts` — single route table plus a global `beforeEach` guard that enforces auth and permission gates (`requiresAuth`, `requiresGlobalSettings`, `requiresReconciliationRun`, `requiresTenantEdit`).
- `src/stores/` — Pinia stores: `auth`, `permissions`, `referenceData`, `reconciliationDraft`, `runResults`.
- `src/composables/` — shared composition functions: `useActivePopup`, `useAutomationSourceDraft`, `useCalendarWidget`, `useCommandPalette`, `useCronExpression`, `useReconciliationDiff`, `useTheme`.
- `src/lib/api/` — backend access: `client.ts` (JSON-RPC client and URL resolution), `facade.ts` (typed catalog of `facade.*` services), `facadeTypes.ts`, `types.ts`.
- `src/lib/` — route, draft, display, and utility helpers shared across pages.
- `src/components/shell/` — app shell pieces (`CommandPalette`).
- `src/components/ui/` — static-surface building blocks (`StaticPageFrame`, `StaticPageSection`, `StaticEditableTitle`, `AppSelect`, `AppSaveAction`, `AppTableFrame`, `AppListPager`, `StatusBadge`, ...).
- `src/components/workflow/` — workflow-surface building blocks (`WorkflowPage`, `WorkflowStepForm`, `WorkflowSelect`, `WorkflowShortcutChoiceCards`, `WorkflowProgressBar`).
- `src/pages/` — route components grouped by surface: `reconciliation/`, `jsonschema/`, `settings/`, plus `HomePage`, `LoginPage`, and `ReconciliationPlaceholderPage`.

Page-surface conventions (static vs workflow contracts, shared CSS classes, migration rules) live in `docs/ui/page-surface-playbook.md`.

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

Resolution order for the backend target: `VITE_DARPAN_RPC_URL` wins when set; otherwise the origin of `VITE_DARPAN_API_BASE_URL` plus `/rpc/json`; otherwise same-origin `/rpc/json`. In local dev the Vite server proxies `/rpc/json` (and `/qapps/darpan/rpc/json`) to `http://localhost:8080`.

## Commands

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run dev:stack    # Vite + local darpan-backend together
npm run check        # lint + type-check + vitest run --coverage
npm run lint         # ESLint, zero warnings allowed
npm run type-check   # vue-tsc
npm run test         # vitest run --coverage
npm run test:watch   # vitest watch mode
npm run build        # type-check + vite build
npm run preview      # serve dist on http://localhost:4173
```

For targeted specs, run `npx vitest run <path>`.

Default local URL: `http://localhost:5173`. Local backend API base: `http://localhost:8080`.

Use `npm run dev:stack` when working against the local backend and frontend together. The helper starts Vite plus `../darpan-backend/gradlew run` and stops both when you exit.

Before starting, the helper clears any existing listeners on the expected backend (8080) and frontend (5173) ports so the new session can come up on the intended ports instead of falling back to alternates.

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

Core:

- `/login` (public; all other routes require an authenticated session)
- `/` (module hub)
- `/roadmap/reconciliation` (customer roadmap and request access, backed by configurable Linear URLs)

Reconciliation:

- `/reconciliation/create` (run create workflow)
- `/reconciliation/diff` (diff review workflow; requires the reconciliation-run permission)
- `/reconciliation/run-result/:savedRunId/:outputFileName`
- `/reconciliation/run-history/:savedRunId`
- `/reconciliation/ruleset-manager` (rule set library)
- `/reconciliation/ruleset-manager/rules` (rule set editor workflow)
- `/reconciliation/automations` (scheduled-run automations list)
- `/reconciliation/automation/create` (automation create workflow)
- `/reconciliation/automations/edit/:automationId` (automation edit workflow)
- `/reconciliation/automations/:automationId` (automation dashboard with run history)

Schemas:

- `/schemas/library`
- `/schemas/create` (schema wizard)
- `/schemas/editor/:jsonSchemaId?` (`jsonSchemaId` optional for a blank editor)

Settings:

- `/settings/tenant` (tenant settings hub; hosts the AI provider and Google Chat notification workflows via `?workflow=` query states)
- `/settings/user`
- `/settings/shopify`, `/settings/shopify/auth/:shopifyAuthConfigId`, `/settings/shopify/create`, `/settings/shopify/edit/:shopifyAuthConfigId`
- `/settings/hotwax`, `/settings/hotwax/auth/:omsRestSourceConfigId`, `/settings/hotwax/create`, `/settings/hotwax/edit/:omsRestSourceConfigId` (HotWax OMS REST sources)
- `/settings/netsuite`, `/settings/netsuite/auth/create`, `/settings/netsuite/auth/edit/:nsAuthConfigId`, `/settings/netsuite/endpoints/create`, `/settings/netsuite/endpoints/edit/:nsRestletConfigId`
- `/settings/sftp`, `/settings/sftp/create`, `/settings/sftp/edit/:sftpServerId`
- `/settings/runs` (run editor list), `/settings/runs/edit/:reconciliationMappingId`

Create/edit workflow routes require the tenant-edit permission; the AI provider workflow additionally requires global-settings permission. Unmatched paths redirect to `/`.

## Redirect Support

- `/connections/**` routes redirect into the current settings dashboards and workflows (`/connections/runs` → `/settings/runs`, `/connections/shopify` → `/settings/shopify`, `/connections/hotwax` and `/connections/oms` → `/settings/hotwax`, `/connections/netsuite*` → `/settings/netsuite`, `/connections/sftp` → `/settings/sftp`, `/connections/llm` and `/connections` → `/settings/tenant`, `/connections/notifications` → `/settings/tenant?workflow=notifications`).
- `/settings/ai`, `/settings/ai/create`, and `/settings/ai/edit/:llmProvider` redirect into the `/settings/tenant` AI workflow states.
- `/settings/notifications` redirects to `/settings/tenant?workflow=notifications`.
- `/settings/oms*` legacy routes redirect to the `/settings/hotwax*` equivalents.
- `/schemas` redirects to `/schemas/library`; `/schemas/infer` and `/schemas/edit/:jsonSchemaId` redirect into the current schema create/editor routes.
- `/reconciliation/automations/create` redirects to `/reconciliation/automation/create`; `/reconciliation/automations/:automationId/history` redirects to the automation dashboard.

## Product Flows

- Reconciliation runs: configure mappings in `/settings/runs`, launch from `/reconciliation/create`, review diffs in `/reconciliation/diff`, and inspect outputs in `/reconciliation/run-result/...` and `/reconciliation/run-history/...`.
- Rules: author and manage rule sets in `/reconciliation/ruleset-manager` and `/reconciliation/ruleset-manager/rules`; rule failures surface in run results.
- Automations: schedule recurring runs from `/reconciliation/automations` and monitor them on the automation dashboard.
- Alerts: configure the Google Chat webhook in `/settings/tenant` (notifications workflow) to receive run-completion notifications in the tenant channel (settings backed by `facade.SettingsFacadeServices.get#TenantNotificationSettings` / `save#TenantNotificationSettings`).

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

`.github/workflows/deploy-pages.yml` builds and deploys the app to GitHub Pages on every push to `main` (and on manual dispatch):

- `https://toaditi.github.io/darpan-ui/`

The Pages build reads its backend target from GitHub Actions repository or environment variables:

```bash
VITE_DARPAN_API_BASE_URL=https://your-darpan-host.example.com
# or, when the RPC route is different from the API origin:
VITE_DARPAN_RPC_URL=https://your-darpan-host.example.com/rpc/json
```

Notes:

- `VITE_DARPAN_RPC_URL` wins when both are set.
- If neither backend variable is set, the deployed Pages app falls back to same-origin `/rpc/json`. On GitHub Pages that fallback is not a valid backend target, so login and any backend-dependent flow will not work from the Pages URL alone.
- For auth and cookie validation, test against the same-site or reverse-proxied host that will actually serve users (the Firebase Hosting deployments above).

For local UI-only prototyping without backend login, set:

```bash
VITE_DARPAN_AUTH_BYPASS=true
```

## Notes

- API contracts remain owned by `darpan-backend/runtime/component/darpan/service/facade/**`.
