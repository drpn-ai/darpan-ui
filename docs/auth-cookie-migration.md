# Auth follow-up: httpOnly-cookie session migration (audit #10)

**Status:** planned. The client-side hardening shipped (see "What already shipped"); this document is
the remaining, live-backend-only work to remove the JS-readable bearer token entirely. Do this against
a running stack (`./dev-stack.sh`) — a mistake here breaks login for every user.

## Why

Audit finding #10: the Moqui `login_key` bearer is JS-readable. Even after the hardening below it is
still readable by JavaScript during an active session, so an XSS or malicious dependency can use it
in-session. The only way to make the credential non-exfiltratable is to stop exposing it to JS at all
and authenticate via the backend's **httpOnly** cookie.

## What already shipped (safe, client-only)

`src/lib/api/client.ts` now holds the bearer token in memory + **`sessionStorage`** (not `localStorage`):
per-tab, cleared on tab close, never written to disk, and a legacy `localStorage['darpan.authToken']`
is purged on load. This removes the *persistent / survives-restart / on-disk* exfiltration surface.
`credentials` is still `'omit'` and the `login_key` header is unchanged — **the login contract did not
change**, so this carried no breakage risk. Trade-off accepted: sessions are now per-tab and a full
browser restart requires re-login (until this migration restores durable login via the cookie).

## What the backend already provides (do not rebuild)

- `AuthSessionSupport` (`darpan-backend/.../facade/auth/AuthSessionSupport.groovy`) issues an **httpOnly**
  `darpan_login_key` cookie at login (`AuthFacadeSupport.loginSession` → `writePersistentLoginCookie`),
  with per-request `SameSite` escalation (Lax same-site, None for genuine cross-site + secure) and a
  6-day `Max-Age`. Logout clears + revokes it.
- `restoreAuthenticatedSession(ec)` rebuilds the authenticated user from that cookie. It is **currently
  wired into only `get#SessionInfo`** (`AuthFacadeServices.xml`), and is a no-op today because the SPA
  sends `credentials:'omit'` so the cookie never reaches the server on RPC calls.

## The migration (client + server + CORS + CSRF — all required together)

1. **Client — send credentials.** In `client.ts`, change the RPC `fetch` from `credentials: 'omit'` to
   `credentials: 'include'` so the httpOnly cookie rides along. Stop sending the `login_key` header for
   normal calls once cookie auth is confirmed working (keep it only for the login bootstrap if needed).
   Drop the in-JS token entirely (or keep a short-lived in-memory CSRF token only — see step 4).

2. **Server — restore on every authenticated RPC, not just `get#SessionInfo`.** Today only the session
   probe restores from the cookie. Either (a) call `restoreAuthenticatedSession(ec)` from a pre-auth
   screen/filter that runs for all `/rpc/json` traffic, or (b) confirm Moqui's own HTTP session cookie
   (established by `loginUser`) carries the authenticated user across calls once `credentials:'include'`
   is on — in which case the custom cookie is only needed for cross-restart restore. **This is the part
   that must be verified live:** confirm a data service (e.g. `list#GeneratedOutputs`) authenticates
   with only the cookie, no `login_key` header.

3. **CORS — allow credentials with a specific origin.** Cross-origin dev (`5173` → `8080`) and any
   split prod origin (`darpan.*` → `api.darpan.*`) need `Access-Control-Allow-Credentials: true` and a
   **non-wildcard** `Access-Control-Allow-Origin` echoing the exact request origin, plus
   `Access-Control-Allow-Headers` for `Content-Type`/CSRF and preflight (`OPTIONS`) handling. Verify
   where Moqui/web.xml sets CORS today (the SameSite handling lives in `AuthSessionSupport`; CORS may be
   framework-default and need configuration). Same-origin prod (UI served by the backend) avoids most of
   this — confirm the deployment topology first.

4. **CSRF — required once a cookie auto-authenticates.** With cookie auth, a state-changing POST no
   longer needs the `login_key` header, so a cross-site form/script could ride the victim's cookie.
   Mitigations, in order of preference:
   - The `/rpc/json` body is `application/json`, which forces a CORS preflight cross-origin — already a
     strong guard provided the server does **not** reflect arbitrary origins. Verify this holds.
   - Moqui's `moquiSessionToken` (`ec.web.sessionToken`, already surfaced in screens, e.g.
     `Main.xml`/`MappingSetup.ftl`) as an `X-CSRF-Token` header on every mutating call. The SPA can read
     it (it is not the secret bearer) and echo it.
   Pick one and apply it to all `allow-remote` mutating services.

## Verification checklist (live stack required)

- [ ] Login sets `darpan_login_key` (httpOnly) **and** the SPA no longer stores a JS-readable bearer.
- [ ] A data RPC succeeds with the cookie only (no `login_key` header) after `credentials:'include'`.
- [ ] Full browser restart → app re-authenticates from the cookie (durable login restored).
- [ ] Logout clears + server-revokes the cookie; subsequent calls 401.
- [ ] Cross-origin dev (5173→8080) works: preflight passes, `Allow-Credentials` + exact origin echoed.
- [ ] A cross-site POST without the CSRF token / preflight is rejected.
- [ ] Multi-tab + tenant-switch behave (re-validate `App.vue` storage-event path, now per-tab).

## Rollback

The change is a small client diff (credentials + header) plus server wiring. Keep it behind a build/env
flag (e.g. `VITE_DARPAN_COOKIE_AUTH`) defaulting off until the checklist passes in staging, so a bad
deploy reverts by flipping the flag rather than redeploying.

## Verified design & decisions (2026-06-27)

Live-probed against a running stack (login `john.doe`). Decisions: **CSRF = Option 1 (defense-in-depth)**;
**scope = A+B (security fix + durable login)**. Findings that pin the design:

- **The backend already authenticates general `/rpc/json` via the JSESSIONID session cookie** (no
  per-RPC wiring needed) **and already enforces CSRF** on cookie-authenticated calls: it requires
  `X-CSRF-Token` (= `moquiSessionToken`) and rejects wrong/missing tokens (`401 Session token …`).
  The token is returned as a CORS-exposed **response header** on login and on `get#SessionInfo`.
- **The credential moves to the HttpOnly `darpan_login_key` cookie** (already minted at login); the
  `moquiSessionToken`/`X-CSRF-Token` is an **anti-CSRF token, not the secret** — it is meant to be
  JS-readable, so keeping it in JS (memory/sessionStorage) is correct and satisfies audit #10.
- **CSRF is skipped when** the request is a GET (ScreenRenderImpl:429), or `moqui.request.authenticated`
  is set (the login_key-header path), or the session token is still null (a brand-new session). This is
  why first login and a post-restart `get#SessionInfo` succeed without a token.
- **Bootstrap matrix (verified):** cold-start → login (CSRF-exempt, returns token); same-tab reload →
  token in sessionStorage; **full restart** → `get#SessionInfo` with only `darpan_login_key` restores
  the session + returns a fresh token (CSRF skipped, null session token) — *durable login, no backend
  change*; **new tab while session alive** → token exists → CSRF enforced → the new tab can't read the
  cross-origin cookie → needs the GET endpoint below. (Companion-cookie double-submit does NOT work
  cross-origin: `app.drpn.ai` JS cannot read an `api.drpn.ai` cookie.)

### Implementation (flag-gated by `VITE_DARPAN_COOKIE_AUTH`)

1. **Backend (darpan component) — CSRF-exempt GET token endpoint.** Add a GET transition/service that
   returns the current session `moquiSessionToken`, restoring the authenticated session from
   `darpan_login_key` if no live session. GET ⇒ CSRF-exempt; CORS already echoes only allowlisted
   origins, so only the SPA can read it; the token alone is useless without the HttpOnly cookie. This is
   the uniform bootstrap for new-tab (and a clean path for restart/cold too).
2. **Client (`client.ts`) — cookie mode.** When the flag is on: `fetch` `credentials:'include'`; on boot
   fetch the CSRF token (GET endpoint, falling back through login for the unauthenticated case); send it
   as `X-CSRF-Token` on every `/rpc/json` call; capture/refresh it from every response header; **do not
   send the `login_key` header and do not store the JS-readable bearer** (the cookie is the credential).
   Treat `401 Session token …` as auth-required (existing 401 path → session-expiry redirect).
3. **Dev CORS.** Replace `MoquiDevConf` `allow-origins=*` with an explicit dev origin
   (`http://localhost:5173`) — `*` is invalid with `Access-Control-Allow-Credentials: true`.
4. **Verify** the checklist above against the live stack, including new-tab + restart durability and a
   CSRF-rejection case.
