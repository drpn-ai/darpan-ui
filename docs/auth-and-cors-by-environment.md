# Auth and CORS by environment

darpan-ui has two ways to authenticate RPC calls. The build picks one with
`VITE_DARPAN_COOKIE_AUTH`, read once at load in `src/lib/api/client.ts`. This page records which
environment uses which mode, why, and what must happen before the mode changes.

## The two modes

| | Header mode (`VITE_DARPAN_COOKIE_AUTH=false`) | Cookie mode (`VITE_DARPAN_COOKIE_AUTH=true`) |
| --- | --- | --- |
| Credential | login-key token returned by `login#Session`, sent in the `login_key` request header | HttpOnly `darpan_login_key` cookie set by the backend |
| Where the browser keeps it | memory plus `sessionStorage` (`darpan.authToken`), per tab, cleared when the tab closes | the cookie jar; JavaScript cannot read it |
| `fetch` credentials | `omit` (no cookies sent) | `include` |
| CSRF | not used | `X-CSRF-Token` header on every RPC. The token comes from `GET /apps/darpan/csrfToken` and is refreshed from each response's `X-CSRF-Token` / `moquiSessionToken` header. Kept in memory plus `sessionStorage` (`darpan.csrfToken`) |
| CORS need | any allowlisted origin; no credentialed CORS | the API must return the exact SPA origin with `Access-Control-Allow-Credentials: true`. A `*` origin is rejected by browsers on credentialed requests |

Older builds kept the token in `localStorage`. The client deletes that key on load; nothing is
written to `localStorage` now.

Cookie mode is the intended end state for every browser deployment (see the policy comment in
`darpan/src/main/groovy/darpan/facade/auth/AuthSessionSupport.groovy`). Header mode stays the
channel for non-browser callers (curl, integrations).

## Per environment

| Environment | Build / env file | API | Mode | Why |
| --- | --- | --- | --- | --- |
| Local dev | `npm run dev` / `.env` (optional) | `localhost:8080` via the Vite proxy | header (default `false`) | no TLS, same-origin proxy |
| Prod | `hosting:prod`, `npm run build`, `.env.production` (gitignored) | `https://api.drpn.ai` | cookie (`true`) | the prod backend allowlist is exact (no `*`), so credentialed CORS works |
| UAT | `hosting:uat`, `npm run build:firebase`, `.env.firebase` | `https://api-uat.drpn.ai` | header (`false`) | the UAT ingress rewrites `Access-Control-Allow-Origin` to `*`, so credentialed requests cannot connect |
| sm-darpan | `hosting:sm-darpan`, `npm run build:sm-darpan`, `.env.sm-darpan` | `https://sm-darpan-maarg.hotwax.io` | header (`false`) | same ingress behaviour as UAT |
| GitHub Pages | `deploy-pages.yml` | from repo/environment variables | header (unset) | preview only; not a supported user host |

`.env.production` is not in git. Whoever deploys prod must have a copy that sets
`VITE_DARPAN_COOKIE_AUTH=true`; a build without it falls back to header mode.

## Backend side

- The backend origin allowlist is `webapp_allow_origins` in `MoquiProductionConf.xml`, overridden at
  boot from `Moqui_WEBAPP_ALLOW_ORIGINS` by the container entrypoint (darpan-docker-config).
- The prod image (`docker/prod/Dockerfile`) ships an exact list of app origins.
- The UAT image (`docker/Dockerfile`) prepends `*` to that list. This is a temporary posture from
  2026-07-02 that matches the UAT ingress behaviour above.
- The `darpan_login_key` cookie is issued `SameSite=Lax`, and `SameSite=None; Secure` only when the
  request's `Origin` host differs from the API host over HTTPS (`AuthSessionSupport.resolveCookieSameSite`).
  Both Dockerfiles also switch the framework's own cookies to `SameSite=None` at build time.

## Turning cookie mode on for UAT or sm-darpan

The order matters. Do these steps in this sequence (tracked as DAR-OPS-001 in the wrapper
`roadmap/BACKLOG.md`):

1. Remove `*` from `Moqui_WEBAPP_ALLOW_ORIGINS` in `darpan-docker-config/docker/Dockerfile`, and
   rebuild and redeploy the backend. This must land before, or together with, the ingress fix.
   While `*` is in the allowlist, the backend accepts credentialed requests from any origin, so
   cookie sessions and the CSRF token endpoint would not be limited to the app's own origin.
2. Fix the ingress so it passes the backend's per-origin `Access-Control-Allow-Origin` through
   instead of stamping `*`.
3. Only then set `VITE_DARPAN_COOKIE_AUTH=true` in `.env.firebase` (UAT) or `.env.sm-darpan`, and
   redeploy that hosting target.
4. Check in the browser: sign in, reload (the session restores from the cookie), and confirm RPC
   calls carry `X-CSRF-Token` and no `login_key` header.

Never flip step 3 while step 1 is still open.
