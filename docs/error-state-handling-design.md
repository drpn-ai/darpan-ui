# Error-State Handling & Recovery — Design

- **Date:** 2026-06-26
- **Status:** Design (pending review)
- **Surfaces:** `darpan-ui` (Vue SPA, primary) + `darpan-backend` Moqui screens (`component://darpan/screen/**`)
- **Scope:** P0 + P1 error states, shared design language, explicit recovery policy. Offline is P2 (optional).

## 1. Problem

Error/denied states are currently raw and inconsistent:

- **Moqui screens** (`/apps/darpan`): a non-super-admin who reaches them gets a bare `"Reconciliation administration screens are restricted to super-admin users."` rendered by Moqui's default error display (repeated, HTTP 200) from a `<return error="true" .../>` in `<pre-actions>`. The sibling URL-authz path dumps `403 User X is not authorized for View on Screen component://darpan/screen/…` — which also **leaks internal artifact paths**.
- **SPA**: no global error boundary (an uncaught component/promise error white-screens — flagged in the 2026-06-11 MACH audit), only an `EmptyState` component (no error/denied/offline/not-found UI), permission-blocked users are **silently redirected** with no "why", no 404 catch-all, and `ApiCallError`s surface per-page ad hoc.

Good bones to build on: errors are already **typed** (`AuthRequiredError`/`ApiCallError`, `lib/api/client.ts`), route-permission **guards** exist (`router/index.ts`, `stores/auth`), and `EmptyState.vue` is a clean component pattern. Both surfaces already share brand values under different token namespaces.

## 2. Goals / Non-goals

**Goals**
- One calm, on-brand, accessible treatment for every error/denied state, consistent across SPA and Moqui.
- An explicit **recovery policy**: auto-recover when safe; require user action only when warranted.
- A global SPA error boundary that captures (and reports via a hook) instead of white-screening.
- Correct semantics: real `403`, no internal-path leakage, one consistent denial experience.

**Non-goals (YAGNI)**
- **No change to the existing SPA UI.** This work is purely **additive**: net-new error components and error-only code paths. It does **not** edit existing page markup, layouts, styles, or happy-path behavior; introduces **no global CSS** that restyles existing elements (all new styles are scoped to the new error components); and leaves `EmptyState.vue` untouched (we add a sibling, not modify it). Existing happy-path screens render and behave exactly as before; the full `npm run check` suite must stay green.
- No new runtime dependency. **No Sentry/library** — only a pluggable `reportError` hook for the audit's future observability work.
- No service worker / true-PWA offline support. Offline detection is an optional P2 banner only.
- No rework of the route-permission model itself; we improve how its denials are *presented*.

## 3. Approach — shared token contract, surface-native states

The error state is defined **once** as a semantic anatomy + token contract, then implemented idiomatically on each surface. Both surfaces already carry the same brand values, so a shared contract (not a shared CSS file) yields an identical look.

| Role | SPA (`src/style.css`) | Moqui (`theme-library/css/tokens.css`) | Value |
|---|---|---|---|
| card surface | `--surface` | `--dt-color-bg-1` | `#101010` |
| border | `--border` | `--dt-color-border` | `#303030`/`#2a2a2a` |
| title text | `--text` | `--dt-color-fg-strong` | `#f2f2f2` |
| muted text | `--text-muted` | `--dt-color-fg-muted` | `#a0a0a0`/`#9a9a9a` |
| spacing | `--space-5` | `--dt-space-5` | ~24px |
| radius | `--radius-md` | `--dt-radius-md` | ~10px |
| shadow | `--shadow` (none) | *(omit `--dt-shadow-1`)* | none — flat on both |

Alternatives rejected: **(B)** Moqui redirecting into the SPA's error route (over-couples a server-admin surface to consumer SPA URLs, cross-origin/session friction); **(C)** minimal per-surface with no shared system (fails the shared-language goal, won't scale).

## 4. Visual design language

Deliberately **monochrome and flat** — the design system's `--success/--warning/--danger` are all grays and `--shadow` is none, so a denial is *informational*, not a red alarm. This matches both best practice (denial ≠ system-failure) and the product's no-bold aesthetic.

One shared **anatomy**, a sibling of `EmptyState`, centered with an icon + (conditional) primary action:

```
┌──────────────────────────────────────────────┐  surface: card surface token
│            ◯   icon (muted-text token)         │  border: 1px SOLID border token
│         <Title>            (title token, w400)  │  radius: md token
│     <plain-language reason; no jargon/paths>    │  padding: space-5 token
│              [ <action, if any> ]               │  (action: existing button style)
└──────────────────────────────────────────────┘
```

- **Differentiator:** `EmptyState` keeps its **dashed** border (nothing wrong); error states use a **solid** border (attention) — no color shift.
- **Variants** differ only in icon + copy + action (see §5 for whether the action is auto or manual):

  | Variant | Icon | Title | Action (per recovery policy) |
  |---|---|---|---|
  | AccessDenied | lock | "Super-admin access required" | "Go to Darpan" (manual) |
  | ServerError / Crash | alert | "Something went wrong" | "Try again" / "Reload" (manual) |
  | SessionExpired | clock | "Your session ended" | usually **automatic**; manual only if data at risk |
  | NotFound | — | "Page not found" | "Back to home" (manual) |
  | Offline (P2) | — | (banner) "You're offline" | **automatic** on reconnect |

- **Accessibility:** `role="alert"` for error/denied content, focus moved to the state on mount, action is a real `<button>`/`<a>`, copy avoids blame and jargon.

## 5. Recovery policy (auto vs. require-action)

**Rule:** *Take the action for the user when recovery is safe, idempotent, deterministic, loop-free, and needs no decision or awareness. Require user action when there's data at risk, a non-idempotent write, a possible loop, a choice they own, or a boundary they must understand.*

**Always automatic, never a user chore:** (a) **capturing/reporting** the error; (b) **recovering once the blocking condition clears** (reconnect → re-fire the failed read).

| State | Behavior | Rationale |
|---|---|---|
| **Server error — READ (idempotent)** | **Auto-retry** 2–3× with backoff in the API client; show `ServerError` (with manual "Try again") only after retries exhaust | A transient GET failure is the app's problem; don't offload a self-healing blip. |
| **Server error — WRITE (mutation)** | **Never auto-retry.** Surface immediately with explicit "Try again" | Non-idempotent. **Hard constraint:** Darpan has no idempotency keys yet (open MACH-audit item), so a retried `create#RuleSetRun`/`run#SavedRunDiff` duplicates the run. Auto-retry here is a correctness bug, not just UX. |
| **Session expired** | **Auto-redirect** to login (preserving return path) when the view is passive/clean; **require action** with form preserved when there is unsaved input | Auto-recovery is safe until a dirty form makes it data-loss. Branch on form-dirty state. |
| **Crash boundary** | **Auto-capture**; offer a soft route/component **reset** first, full **reload** as fallback; **never auto-reload** | Unknown state can loop (crash → reload → crash); the human breaks the loop, the machine logs it. |
| **Access denied — hard boundary** (no access at all, e.g. non-super-admin → admin screens, or an API 403) | **Prevent** (hide nav for the role) + on direct hit **show transparently** with a way out; don't silent-redirect | A total boundary should be understood, not teleported around — silent redirects erode trust. |
| **Soft permission downgrade** (can use the app, not *this* action — e.g. view-only on a mutation route) | **Gentle redirect** to the permitted equivalent (e.g. the read view); a brief inline note is enough | Bouncing to the view they *can* use is kinder than an access-denied wall; keep the existing guard behavior. |
| **Not found (404)** | **Require action** (we can't infer intent) | — |
| **Offline (P2)** | Informational banner; **auto-recover** (re-fire failed read, drop banner) on reconnect | Blocking condition clears itself. |

The shared `ErrorState` card is therefore *not* the first response for reads (auto-retry precedes it) and is reserved for: writes, persistent failures, 404, access-denied, and crash-reset.

## 6. Component architecture

### 6.1 SPA (`darpan-ui`)

> **Design-system alignment (source of truth):** the error components mirror the **Error State** pattern in the **Darpan Design System** (canonical, read via the `claude_design` MCP). Empty State already exists there (dashed border); Error State has been authored to match as its **solid-border** sibling (`docs/design-system/comp-error-state.html`, ready to push to `preview/comp-error-state.html`). The SPA implements to match; `ErrorState.vue` consumes existing tokens only — no new visual values — so it cannot drift from the system. Confirmed system rules: IBM Plex Mono, weight-400 only, **grayscale status (never hue)**, flat.


- **`components/ui/ErrorState.vue`** — sibling of `EmptyState`; props: `icon?`, `title`, `message?`, `action?` (`{ label, onClick | to }`), `tone?` (`'denied' | 'error'`, both monochrome). Renders the §4 anatomy with the solid-border treatment. *One unit; understandable and testable in isolation.*
- **Variant presets** — thin wrappers / a `variant` map (`AccessDenied`, `ServerError`, `SessionExpired`, `NotFound`) supplying icon + copy + default action; no logic beyond content.
- **Global error boundary** — `app.config.errorHandler` in `main.ts` + an `onErrorCaptured` boundary wrapping `<RouterView>` in `App.vue`; renders `ServerError` (reset/reload per §5) and calls `reportError`. The boundary is a **transparent pass-through** in the happy path (renders its slot unchanged, no layout/DOM impact) and swaps to the fallback **only** on a captured error.
- **`lib/errors/reportError.ts`** — `reportError(err, context)`; logs to console now, single pluggable sink for future observability. The boundary and the API error path both call it.
- **API client retry layer** (`lib/api/client.ts`) — idempotent-read auto-retry (capped, backoff) per §5; writes explicitly excluded; `AuthRequiredError` handling branches on form-dirty (see session-expired).
- **404 catch-all route** (`router/index.ts`) — `:pathMatch(.*)*` → `NotFound`.
- **Access-denied presentation** — add an `AccessDenied` state for **hard** boundaries (API `403` / no-access routes); **keep** the existing gentle guard redirects for **soft** downgrades (view-only on a mutation route). Continue hiding nav entries the role can't use (prevention).

### 6.2 Moqui (`darpan-backend/.../darpan`)

- **Shared error-state styles** — add an error-state block to `theme-library/css/components.css` using `--dt-*` tokens (matching §3), flat (no shadow), solid border.
- **Reusable access-denied screen/partial** — replace the per-screen `<return error="true" .../>` super-admin guard with a forward to a single access-denied screen rendering the §4 anatomy and returning **HTTP 403** (not a 200 error blob), with no internal paths in the body.
- **Hide nav for non-super-admins** — gate the `subscreens-item` menu entries (e.g. `menu-include` condition on `isSuperAdmin`) so non-super-admins don't see what they can't open.
- **Sanitize the URL-authz 403** — present the same access-denied treatment for `ArtifactAuthorizationException`, stripping the `component://…` artifact path from the user-facing message.

## 7. Testing

**SPA (vitest):**
- `ErrorState` renders each variant (icon/title/message/action), `role="alert"`, focus behavior.
- Global boundary: a throwing child renders `ServerError` **and** calls `reportError` (spy).
- Retry policy: a transient **read** auto-retries then succeeds/falls-through; a **write** does **not** auto-retry (assert single call) and surfaces explicit retry.
- Session-expired: passive view auto-redirects to login w/ return path; dirty-form path preserves input and requires action.
- 404 catch-all renders `NotFound`; access-denied route/guard renders `AccessDenied` and nav entries are hidden for the role.
- **Non-regression:** the full existing `npm run check` (lint + type-check + vitest) stays green; the boundary wrapper is verified to pass through unchanged when no error occurs (happy-path markup parity), confirming the existing UI is unaffected.

**Moqui (extend `ScreenUiAuthzTests`):**
- A non-super-admin gets the access-denied screen with **403** (not a raw 200 error blob) and **no `component://` path** in the response body; nav entries are hidden.

## 8. Dependencies & open items

- **Super-admin grant decision (open):** the earlier `DARPAN_SCREEN_UI` grant-scope question (DARPAN_ADMIN vs DARPAN_SUPER_ADMIN vs decommission) intersects here. This design assumes the screens stay super-admin-only; the access-denied state is what a denied user sees regardless of the final grant. Resolve before the Moqui slice ships.
- **Idempotency keys (out of scope, blocking for write auto-retry):** write auto-retry stays disabled until the audit's idempotency-key work lands. Tracked separately.
- **Offline (P2, deferred):** banner + reconnect auto-retry only; no service worker.

## 9. Phasing

1. **Foundation:** `ErrorState` + `reportError` + global boundary + 404 (closes the white-screen gap).
2. **Policy:** API-client read auto-retry + write no-retry; session-expired branch.
3. **Access-denied parity:** SPA access-denied state + nav hiding; Moqui access-denied screen + 403 + path sanitization + nav hiding (shared visual).
4. **Optional:** offline banner (P2).
