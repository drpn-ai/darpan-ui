# darpan-ui

Command-first frontend application for Darpan.

## Purpose

- Serve all custom Darpan UI from this single-page Vue app.
- Consume authenticated facade contracts from `darpan-backend` (`service/facade/**`) over JSON-RPC (`/rpc/json`).
- Keep custom UI/PWA behavior out of backend `screen/**`, `template/**`, and `theme-library/**`.

## Ownership boundary

- `darpan-ui`: all custom UI, PWA shell, and browser interaction flows.
- `darpan-backend`: Moqui backend contracts, business logic, and reconciliation processing only.
- Operator (super-admin) screens for users, tenants, and membership live in the separate `darpan-admin-ui` app, not here.

## Tech Stack

- Vue 3
- TypeScript (strict)
- Vite
- Vue Router
- Pinia
- ESLint (flat config) and Stylelint (design-token gate)
- Vitest

## Source Layout

- `src/router/index.ts` — single route table plus a global `beforeEach` guard. Route meta flags: `requiresAuth`, `requiresReconciliationRun`, `requiresTenantEdit`. The AI provider workflow is gated in the guard itself (global-settings permission). A `?tenantId=` query on a deep link switches the active tenant before the permission gates run.
- `src/stores/` — Pinia stores: `auth`, `permissions`, `referenceData`, `reconciliationDraft`, `runResults`, `mascot`.
- `src/composables/` — shared composition functions (`useActivePopup`, `useCommandPalette`, `useCronExpression`, `useReconciliationDiff`, `useRunResult*`, `useWorkflowStepMachine`, `useTheme`, ...).
- `src/lib/api/` — backend access: `client.ts` (JSON-RPC client, URL resolution, auth mode), `facade.ts` (typed catalog of `facade.*` services), `facadeTypes.ts`, `types.ts`, `contract/` (copied `methods.txt` + `openapi.json`), `generated/` (types generated from the OpenAPI copy).
- `src/lib/` — route, draft, display, mascot, slash-command, and utility helpers shared across pages.
- `src/components/shell/` — app shell pieces (`CommandPalette`, `DarpanMascot`, `MascotDock`, `OfflineBanner`, `AppErrorBoundary`).
- `src/components/ui/` — static-surface building blocks (`StaticPageFrame`, `StaticPageSection`, `AppSelect`, `AppSaveAction`, `AppTableFrame`, `AppListPager`, `AppToggleSwitch`, `ErrorState`, `EmptyState`, `StatusBadge`, ...).
- `src/components/workflow/` — workflow-surface building blocks (`WorkflowPage`, `WorkflowStepForm`, `WorkflowSelect`, `WorkflowChipTextInput`, `WorkflowTimeSelect`, `WorkflowShortcutChoiceCards`, `WorkflowProgressBar`).
- `src/pages/` — route components grouped by surface: `reconciliation/`, `jsonschema/`, `settings/`, plus `HomePage`, `LoginPage`, `AccessDeniedPage`, `NotFoundPage`, and `ReconciliationPlaceholderPage`.

Page-surface conventions (static vs workflow contracts, shared CSS classes, migration rules) live in `docs/ui/page-surface-playbook.md`.

## Configuration

Set environment variables in `.env` for local development:

```bash
# Optional in local dev. If omitted, darpan-ui uses same-origin /rpc/json with the Vite proxy.
# VITE_DARPAN_API_BASE_URL=http://localhost:8080
# VITE_DARPAN_RPC_URL=http://localhost:8080/rpc/json
# Auth mode. false = login_key header token (per-tab sessionStorage). true = HttpOnly cookie + CSRF.
VITE_DARPAN_COOKIE_AUTH=false
# Optional customer-safe roadmap/request pages exposed from /roadmap/reconciliation.
# VITE_DARPAN_LINEAR_ROADMAP_URL=https://linear.app/your-public-roadmap
# VITE_DARPAN_LINEAR_REQUEST_URL=https://linear.app/your-request-form
# Optional. Set false when the target should open only in a new tab.
# VITE_DARPAN_LINEAR_EMBED_ENABLED=true
VITE_DARPAN_AUTH_BYPASS=false
```

Resolution order for the backend target: `VITE_DARPAN_RPC_URL` wins when set; otherwise the origin of `VITE_DARPAN_API_BASE_URL` plus `/rpc/json`; otherwise same-origin `/rpc/json`. In local dev the Vite server proxies `/rpc/json` (and `/qapps/darpan/rpc/json`) to `http://localhost:8080`.

`VITE_DARPAN_COOKIE_AUTH` differs per deployed environment. See `docs/auth-and-cors-by-environment.md` for which mode each target uses and why.

`VITE_DARPAN_AUTH_BYPASS=true` is honored only by the Vite dev server; production builds ignore it.

## Commands

```bash
npm install
npm run dev                 # Vite dev server on http://localhost:5173 (UI only)
npm run check               # lint + lint:css + type-check + vitest run --coverage
npm run lint                # ESLint, zero warnings allowed
npm run lint:css            # Stylelint design-token gate, zero warnings allowed
npm run type-check          # vue-tsc
npm run test                # vitest run --coverage
npm run test:watch          # vitest watch mode
npm run build               # type-check + vite build (production mode)
npm run build:firebase      # vite build --mode firebase (UAT; no type-check)
npm run build:sm-darpan     # vite build --mode sm-darpan (no type-check)
npm run preview             # serve dist on http://localhost:4173
npm run sync-contract       # copy methods.txt + openapi.json from ../darpan-backend
npm run generate-api-types  # regenerate src/lib/api/generated/schema.d.ts from the OpenAPI copy
```

For targeted specs, run `npx vitest run <path>`.

After a backend contract change, run `npm run sync-contract` and then `npm run generate-api-types`.

### Local backend + UI together

Start the full stack from the wrapper root, not from this repo:

```bash
cd .. && ./dev-stack.sh
```

The wrapper script checks for JDK 21 and exports the Spark `--add-opens` JVM flags through `JAVA_TOOL_OPTIONS`, then runs `npm run dev:stack` here. Running `npm run dev:stack` directly skips those flags, and reconciliation runs then fail at the compare stage on JDK 21.

UI: `http://localhost:5173`. Backend: `http://localhost:8080`.

`npm run dev:stack` (`scripts/dev-stack.sh`) starts Vite plus `../darpan-backend/gradlew run`, clears existing listeners on ports 8080 and 5173 first, and stops both on exit. It reads these overrides, which also pass through `./dev-stack.sh`:

```bash
DARPAN_BACKEND_DIR=/absolute/path/to/darpan-backend
DARPAN_BACKEND_TASK=runProduction
DARPAN_BACKEND_COMMAND="./gradlew --no-daemon runProduction"
DARPAN_BACKEND_PORT=8081 DARPAN_FRONTEND_PORT=5174
```

## Routes

Core:

- `/login` (public; all other routes require an authenticated session)
- `/` (home: Sync and Lifecycle runs)
- `/roadmap/reconciliation` (roadmap and request pages, from the configurable `VITE_DARPAN_LINEAR_*` URLs)
- `/access-denied` (shown when a deep link names a tenant the user does not belong to)
- Any unmatched path renders the not-found page.

Reconciliation:

- `/reconciliation/new` (Create Run: pick Sync or Lifecycle)
- `/reconciliation/create` (Sync run create workflow)
- `/reconciliation/diff` (diff review workflow; requires the reconciliation-run permission)
- `/reconciliation/run-live/:savedRunId/:runResultId` (in-progress run view)
- `/reconciliation/run-result/:savedRunId/:outputFileName`
- `/reconciliation/run-history/:savedRunId`
- `/reconciliation/runs/create` (Lifecycle run create workflow)
- `/reconciliation/runs/:reconciliationId/settings` (Lifecycle run settings)
- `/reconciliation/runs/:reconciliationId/run` (start a Lifecycle run for a window)
- `/reconciliation/runs/:reconciliationId/:reconciliationExecutionId?` (Lifecycle run board)
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

- `/settings/tenant` (tenant settings hub; hosts the AI provider, notifications, and timezone workflows via `?workflow=ai-create|ai-edit|notifications|timezone`)
- `/settings/user`
- `/settings/shopify`, `/settings/shopify/auth/:shopifyAuthConfigId`, `/settings/shopify/create`, `/settings/shopify/edit/:shopifyAuthConfigId`
- `/settings/hotwax`, `/settings/hotwax/auth/:omsRestSourceConfigId`, `/settings/hotwax/create`, `/settings/hotwax/edit/:omsRestSourceConfigId` (HotWax OMS REST sources)
- `/settings/netsuite`, `/settings/netsuite/auth/create`, `/settings/netsuite/auth/edit/:nsAuthConfigId`, `/settings/netsuite/endpoints/create`, `/settings/netsuite/endpoints/edit/:nsRestletConfigId`
- `/settings/sftp`, `/settings/sftp/create`, `/settings/sftp/edit/:sftpServerId`
- `/settings/runs` (run editor list), `/settings/runs/edit/:reconciliationMappingId`

Create/edit workflow routes, and the Lifecycle run routes, require the tenant-edit permission. The AI provider workflow also requires the global-settings permission.

## Redirect Support

- `/reconciliation/runs` redirects to `/` (Lifecycle runs are listed on Home).
- `/connections/**` routes redirect into the current settings dashboards and workflows (`/connections/runs` → `/settings/runs`, `/connections/shopify` → `/settings/shopify`, `/connections/hotwax` and `/connections/oms` → `/settings/hotwax`, `/connections/netsuite*` → `/settings/netsuite`, `/connections/sftp` → `/settings/sftp`, `/connections/llm` and `/connections` → `/settings/tenant`, `/connections/notifications` → `/settings/tenant?workflow=notifications`).
- `/settings/ai`, `/settings/ai/create`, and `/settings/ai/edit/:llmProvider` redirect into the `/settings/tenant` AI workflow states.
- `/settings/notifications` redirects to `/settings/tenant?workflow=notifications`.
- `/settings/oms*` legacy routes redirect to the `/settings/hotwax*` equivalents.
- `/schemas` redirects to `/schemas/library`; `/schemas/infer` and `/schemas/edit/:jsonSchemaId` redirect into the current schema create/editor routes.
- `/reconciliation/automations/create` redirects to `/reconciliation/automation/create`; `/reconciliation/automations/:automationId/history` redirects to the automation dashboard.

## Product Flows

- Sync runs: configure mappings in `/settings/runs`, launch from `/reconciliation/create` (or `/reconciliation/new`), watch progress in `/reconciliation/run-live/...`, review diffs in `/reconciliation/diff`, and inspect outputs in `/reconciliation/run-result/...` and `/reconciliation/run-history/...`.
- Lifecycle runs: create from `/reconciliation/new` → Lifecycle, then configure and start them under `/reconciliation/runs/:reconciliationId/...`.
- Rules: author and manage rule sets in `/reconciliation/ruleset-manager` and `/reconciliation/ruleset-manager/rules`; rule failures surface in run results.
- Automations: schedule recurring runs from `/reconciliation/automations` and monitor them on the automation dashboard.
- Alerts: tenant chat spaces (Google Chat webhooks, or Slack channels through the Slack install) are managed in the `/settings/tenant` notifications workflow (`facade.SettingsFacadeServices.list#TenantChatSpaces` / `save#TenantChatSpace` / `delete#TenantChatSpace`). Each user's own notification default is set in `/settings/user`.

## Firebase Hosting Deployment

Firebase uses the `darpan` project alias for project `darpan-fa2aa`. `firebase.json` defines three hosting targets:

| Target | Site | App host | Predeploy build | Env file | API |
| --- | --- | --- | --- | --- | --- |
| `prod` | `hc-darpan` | `app.drpn.ai` | `npm run build` (type-check + build) | `.env.production` (gitignored) | `https://api.drpn.ai` |
| `uat` | `hc-darpan-uat` | `app-uat.drpn.ai` | `npm run build:firebase` (no type-check) | `.env.firebase` (tracked) | `https://api-uat.drpn.ai` |
| `sm-darpan` | `sm-darpan` | dedicated instance | `npm run build:sm-darpan` (no type-check) | `.env.sm-darpan` (tracked) | `https://sm-darpan-maarg.hotwax.io` |

Deploy one target at a time:

```bash
firebase use darpan
firebase deploy --only hosting:prod        # or hosting:uat, hosting:sm-darpan
```

Notes:

- All three targets build into the same `dist/`. Never run a bare `firebase deploy --only hosting`: every predeploy runs in one phase and a site can ship another target's build.
- Only `prod` runs `vue-tsc` before building. Run `npm run check` before deploying `uat` or `sm-darpan`.
- The predeploy builds the working tree, not a commit. Deploy from a clean checkout.
- `.env.example` is a template only. Vite does not load it. Copy it to `.env.production` on the machine that deploys prod; `.env.production` must not be committed.
- After a deploy, grep `dist/assets/*.js` for the expected API host to confirm the right mode was built.
- Response headers per target are explained in `docs/security-headers.md`.

## GitHub Pages Deployment

`.github/workflows/deploy-pages.yml` builds and deploys the app to GitHub Pages on every push to `main` (and on manual dispatch):

- `https://drpn-ai.github.io/darpan-ui/`

The Pages build reads its backend target from GitHub Actions repository or environment variables:

```bash
VITE_DARPAN_API_BASE_URL=https://your-darpan-host.example.com
# or, when the RPC route is different from the API origin:
VITE_DARPAN_RPC_URL=https://your-darpan-host.example.com/rpc/json
```

Notes:

- `VITE_DARPAN_RPC_URL` wins when both are set.
- If neither backend variable is set, the deployed Pages app falls back to same-origin `/rpc/json`. On GitHub Pages that fallback is not a valid backend target, so login and any backend-dependent flow will not work from the Pages URL alone.
- For auth and cookie validation, test against the Firebase Hosting deployments above, which serve real users.

## Notes

- API contracts remain owned by `darpan-backend/runtime/component/darpan/service/facade/**`. `src/lib/api/contract/` is a copy; refresh it with `npm run sync-contract`.
