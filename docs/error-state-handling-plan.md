# Error-State Handling & Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add elegant, consistent error/denied states + an explicit recovery policy across the Darpan SPA (and a Moqui access-denied slice), without changing any existing happy-path UI.

**Architecture:** A net-new `ErrorState` component family (sibling of `EmptyState`) consuming only existing design tokens; a transparent global error boundary + `reportError` hook; an idempotent-read-only auto-retry layer in the API client; a 404 catch-all; and a Moqui access-denied screen returning a real 403. Everything is additive and visually driven by the canonical **Darpan Design System** Error State (`docs/design-system/comp-error-state.html`).

**Tech Stack:** Vue 3 + TypeScript + Vite + Pinia + vue-router (SPA); Vitest. Moqui XML screens + `theme-library` CSS + JUnit (backend).

## Global Constraints

- **Purely additive — existing SPA UI must not change.** No edits to existing page markup/layout/behavior; **no global CSS** (all new styles use `<style scoped>` consuming existing CSS vars); `EmptyState.vue` is left untouched (add a sibling).
- **No new runtime dependency.** No Sentry/library — only the `reportError` hook.
- **Monochrome, flat, mono.** Grayscale only — status differs by tonal step, **never hue**; weight 400 (no bold); no shadow; IBM Plex Mono inherited. Copy is lowercase, no trailing period (matches Empty State).
- **Differentiator:** Error State uses a **solid** 1px `var(--border)`; Empty State stays **dashed**. No color difference.
- **Recovery policy:** auto-retry idempotent READS (capped, backoff); **never auto-retry WRITES** (no idempotency keys exist — a retried mutation duplicates). Capture/report is always automatic.
- **Verification gate:** `cd darpan-ui && npm run check` (lint + type-check + vitest) must stay green at every commit.
- **Node:** `>=20`. Test runner: `npx vitest run <path>`.

---

## File Structure

**New (SPA):**
- `src/lib/errors/reportError.ts` — single error sink (console now, pluggable later).
- `src/components/ui/ErrorState.vue` — base error-state card (scoped styles, solid border).
- `src/components/ui/errorStateIcons.ts` — inline SVG strings: `lock`, `alert`, `clock`, `offline`.
- `src/components/ui/errorVariants.ts` — preset factories (`accessDenied`, `serverError`, `sessionExpired`, `notFound`).
- `src/components/shell/AppErrorBoundary.vue` — transparent `onErrorCaptured` boundary.
- `src/pages/NotFoundPage.vue` — 404 page (uses `notFound` variant).
- `src/pages/AccessDeniedPage.vue` — hard-403 page (uses `accessDenied` variant).
- `src/lib/api/retry.ts` — idempotent-read retry helper.

**Modified (SPA):**
- `src/main.ts` — `app.config.errorHandler` + `unhandledrejection` → `reportError`.
- `src/App.vue` — wrap `<RouterView>` in `<AppErrorBoundary>`.
- `src/router/index.ts` — 404 catch-all + `/access-denied` route.
- `src/lib/api/client.ts` — apply read-only retry; route `AuthRequiredError` to login w/ return path.

**New/Modified (Moqui — `darpan-backend/runtime/component/darpan`):**
- `screen/AccessDenied.xml` — shared styled access-denied screen, sets HTTP 403.
- `screen/Reconciliation.xml`, `Settings.xml`, et al. — swap the raw `<return error>` guard for the shared screen; hide nav for non-super-admins.
- `theme-library/css/components.css` — `.error-state` block using `--dt-*` tokens.
- `src/test/groovy/darpan/security/ScreenUiAuthzTests.groovy` — extend: 403 + no `component://` leak.

---

## Phase 1 — Foundation (P0)

### Task 1: `reportError` sink

**Files:**
- Create: `src/lib/errors/reportError.ts`
- Test: `src/lib/errors/__tests__/reportError.spec.ts`

**Interfaces:**
- Produces: `reportError(error: unknown, context?: ErrorContext): void`; `interface ErrorContext { source?: string; method?: string; [k: string]: unknown }`

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { reportError } from '../reportError'

describe('reportError', () => {
  afterEach(() => vi.restoreAllMocks())
  it('forwards the error and context to the sink (console.error) exactly once', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom')
    reportError(err, { source: 'test', method: 'get#Thing' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ error: err, source: 'test', method: 'get#Thing' })
  })
})
```
- [ ] **Step 2: Run test to verify it fails** — `cd darpan-ui && npx vitest run src/lib/errors/__tests__/reportError.spec.ts` → FAIL (module not found).
- [ ] **Step 3: Write minimal implementation**
```ts
export interface ErrorContext {
  source?: string
  method?: string
  [key: string]: unknown
}

/**
 * Single error sink for the SPA. Console for now; this is the one place a future
 * observability backend plugs in (see error-state-handling-design.md §8). Never throws.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    console.error('[darpan] captured error', { error, ...context })
  } catch {
    /* reporting must never throw */
  }
}
```
- [ ] **Step 4: Run test to verify it passes** — same command → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/lib/errors/reportError.ts src/lib/errors/__tests__/reportError.spec.ts
git commit -m "feat(errors): add reportError sink hook"
```

### Task 2: `errorStateIcons` + `ErrorState.vue`

**Files:**
- Create: `src/components/ui/errorStateIcons.ts`, `src/components/ui/ErrorState.vue`
- Test: `src/components/ui/__tests__/ErrorState.spec.ts`

**Interfaces:**
- Produces: `errorStateIcons: Record<'lock'|'alert'|'clock'|'offline', string>` (raw SVG markup).
- Produces `ErrorState` props: `{ title: string; message?: string; icon?: keyof typeof errorStateIcons; action?: { label: string; onClick?: () => void; href?: string } }`. Renders `role="alert"`, solid-border card.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorState from '../ErrorState.vue'

describe('ErrorState', () => {
  it('renders title, message, role=alert, and fires the action onClick', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ErrorState, {
      props: { title: 'super-admin access required', message: 'limited to super-admins', icon: 'lock', action: { label: 'go to darpan', onClick } },
    })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('super-admin access required')
    expect(wrapper.text()).toContain('limited to super-admins')
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('omits the action button when no action is given', () => {
    const wrapper = mount(ErrorState, { props: { title: 'page not found' } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
```
- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/components/ui/__tests__/ErrorState.spec.ts` → FAIL.
- [ ] **Step 3: Write the icons module**
```ts
// src/components/ui/errorStateIcons.ts — monochrome line icons (stroke=currentColor), 24x24.
export const errorStateIcons = {
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4"/><circle cx="12" cy="17.2" r="0.55" fill="currentColor" stroke="none"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>',
  offline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l18 18"/><path d="M5 12a10 10 0 0 1 4-3M8.5 16.5a5 5 0 0 1 6 0M12 20h.01"/></svg>',
} as const
```
- [ ] **Step 4: Write `ErrorState.vue`** (scoped styles mirror `docs/design-system/comp-error-state.html`)
```vue
<template>
  <div class="error-state" role="alert">
    <span v-if="icon" class="error-state__icon" aria-hidden="true" v-html="errorStateIcons[icon]" />
    <h3 class="error-state__title">{{ title }}</h3>
    <p v-if="message" class="error-state__msg">{{ message }}</p>
    <a v-if="action?.href" class="btn-primary" :href="action.href">{{ action.label }}</a>
    <button v-else-if="action" class="btn-primary" type="button" @click="action.onClick">{{ action.label }}</button>
  </div>
</template>

<script setup lang="ts">
import { errorStateIcons } from './errorStateIcons'
defineProps<{
  title: string
  message?: string
  icon?: keyof typeof errorStateIcons
  action?: { label: string; onClick?: () => void; href?: string }
}>()
</script>

<style scoped>
.error-state {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: var(--space-3); padding: var(--space-5);
  border: 1px solid var(--border); /* solid vs EmptyState dashed */
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 72%, transparent);
}
.error-state__icon { width: 1.7rem; height: 1.7rem; color: var(--text-dim); }
.error-state__icon :deep(svg) { width: 100%; height: 100%; display: block; }
.error-state__title { font-size: 1.02rem; font-weight: 400; color: var(--text); margin: 0; }
.error-state__msg { font-size: var(--type-muted-size, 0.88rem); color: var(--text-soft); margin: 0; max-width: 40ch; line-height: 1.5; }
.btn-primary {
  min-width: 4.7rem; min-height: 2.6rem; padding-inline: 0.9rem; margin-top: var(--space-1);
  background: color-mix(in oklab, var(--surface-3) 82%, var(--text) 18%);
  border: 1px solid color-mix(in oklab, var(--border) 72%, var(--text) 28%);
  border-radius: var(--radius-sm); color: var(--text); font: inherit; font-size: 0.95rem; font-weight: 500;
  cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
}
.btn-primary:hover { border-color: color-mix(in oklab, var(--border) 60%, var(--accent)); }
</style>
```
- [ ] **Step 5: Run tests to verify they pass** — `npx vitest run src/components/ui/__tests__/ErrorState.spec.ts` → PASS.
- [ ] **Step 6: Commit**
```bash
git add src/components/ui/errorStateIcons.ts src/components/ui/ErrorState.vue src/components/ui/__tests__/ErrorState.spec.ts
git commit -m "feat(ui): add ErrorState component (sibling of EmptyState)"
```

### Task 3: `errorVariants` presets

**Files:**
- Create: `src/components/ui/errorVariants.ts`
- Test: `src/components/ui/__tests__/errorVariants.spec.ts`

**Interfaces:**
- Produces: `errorVariants.accessDenied()`, `.serverError(onRetry)`, `.sessionExpired(onSignIn)`, `.notFound(onHome)` — each returns the `ErrorState` props object `{ title, message, icon, action }`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi } from 'vitest'
import { errorVariants } from '../errorVariants'

describe('errorVariants', () => {
  it('serverError wires the retry callback into the action', () => {
    const onRetry = vi.fn()
    const v = errorVariants.serverError(onRetry)
    expect(v.icon).toBe('alert')
    expect(v.title).toBe('something went wrong')
    v.action?.onClick?.()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('accessDenied has a lock icon and no jargon/path in the message', () => {
    const v = errorVariants.accessDenied()
    expect(v.icon).toBe('lock')
    expect(v.message).not.toMatch(/component:\/\/|exception|null/i)
  })
})
```
- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Write minimal implementation**
```ts
import type { errorStateIcons } from './errorStateIcons'

type Variant = { title: string; message?: string; icon?: keyof typeof errorStateIcons; action?: { label: string; onClick?: () => void; href?: string } }

export const errorVariants = {
  accessDenied: (onHome?: () => void): Variant => ({
    icon: 'lock', title: 'super-admin access required',
    message: 'these administration screens are limited to super-admin users — head back to the app to keep working',
    action: onHome ? { label: 'go to darpan', onClick: onHome } : { label: 'go to darpan', href: '/' },
  }),
  serverError: (onRetry: () => void): Variant => ({
    icon: 'alert', title: 'something went wrong', message: 'we hit an unexpected error',
    action: { label: 'try again', onClick: onRetry },
  }),
  sessionExpired: (onSignIn: () => void): Variant => ({
    icon: 'clock', title: 'your session ended', message: 'please sign in to continue',
    action: { label: 'sign in', onClick: onSignIn },
  }),
  notFound: (onHome?: () => void): Variant => ({
    title: 'page not found', message: "that page doesn't exist or has moved",
    action: onHome ? { label: 'back to home', onClick: onHome } : { label: 'back to home', href: '/' },
  }),
}
```
- [ ] **Step 4: Run test to verify it passes** → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/components/ui/errorVariants.ts src/components/ui/__tests__/errorVariants.spec.ts
git commit -m "feat(ui): add error-state variant presets"
```

### Task 4: `AppErrorBoundary` + global handlers

**Files:**
- Create: `src/components/shell/AppErrorBoundary.vue`, `src/components/shell/__tests__/AppErrorBoundary.spec.ts`
- Modify: `src/App.vue` (wrap `<RouterView>`), `src/main.ts` (global handlers)

**Interfaces:**
- Consumes: `ErrorState`, `errorVariants.serverError`, `reportError`.
- Produces: `<AppErrorBoundary>` — renders its default slot unchanged until a descendant throws, then renders `serverError`. Exposes nothing.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import AppErrorBoundary from '../AppErrorBoundary.vue'
import * as report from '../../../lib/errors/reportError'

const Boom = defineComponent({ setup() { throw new Error('render boom') } })
const Ok = defineComponent({ setup: () => () => h('div', { class: 'ok' }, 'fine') })

describe('AppErrorBoundary', () => {
  it('passes the slot through unchanged when no error (happy path)', () => {
    const wrapper = mount(AppErrorBoundary, { slots: { default: () => h(Ok) } })
    expect(wrapper.find('.ok').exists()).toBe(true)
    expect(wrapper.find('.error-state').exists()).toBe(false)
  })
  it('renders ServerError and reports once when a child throws', () => {
    const spy = vi.spyOn(report, 'reportError').mockImplementation(() => {})
    const wrapper = mount(AppErrorBoundary, { slots: { default: () => h(Boom) } })
    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('something went wrong')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
```
- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Write `AppErrorBoundary.vue`**
```vue
<template>
  <ErrorState v-if="failed" v-bind="serverProps" />
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import ErrorState from '../ui/ErrorState.vue'
import { errorVariants } from '../ui/errorVariants'
import { reportError } from '../../lib/errors/reportError'

const failed = ref(false)
const serverProps = errorVariants.serverError(() => { window.location.reload() })

onErrorCaptured((err) => {
  failed.value = true
  reportError(err, { source: 'boundary' })
  return false // stop propagation; we've handled it
})
</script>
```
- [ ] **Step 4: Run test to verify it passes** → PASS.
- [ ] **Step 5: Wire into `App.vue`** — wrap the existing `<RouterView :key="routerViewKey" />` (do not change any other markup):
```vue
<!-- in <template>, replace the existing <RouterView .../> line: -->
<AppErrorBoundary>
  <RouterView :key="routerViewKey" />
</AppErrorBoundary>
<!-- in <script setup>, add the import alongside the existing imports: -->
import AppErrorBoundary from './components/shell/AppErrorBoundary.vue'
```
- [ ] **Step 6: Add global handlers in `src/main.ts`** — after the app is created and before/after `app.mount(...)` (do not remove existing lines):
```ts
import { reportError } from './lib/errors/reportError'
// after `const app = createApp(App)` (and after other app.use(...) calls):
app.config.errorHandler = (err, _instance, info) => reportError(err, { source: 'vue', info: String(info) })
window.addEventListener('unhandledrejection', (e) => reportError(e.reason, { source: 'unhandledrejection' }))
```
- [ ] **Step 7: Verify no UI change + tests green**
Run: `npx vitest run src/components/shell/__tests__/AppErrorBoundary.spec.ts && npm run type-check`
Expected: PASS; App renders identically (boundary is transparent).
- [ ] **Step 8: Commit**
```bash
git add src/components/shell/AppErrorBoundary.vue src/components/shell/__tests__/AppErrorBoundary.spec.ts src/App.vue src/main.ts
git commit -m "feat(errors): transparent global error boundary + handlers"
```

### Task 5: 404 catch-all route + `NotFoundPage`

**Files:**
- Create: `src/pages/NotFoundPage.vue`
- Modify: `src/router/index.ts` (append catch-all)
- Test: `src/router/__tests__/notFound.spec.ts`

**Interfaces:**
- Consumes: `ErrorState`, `errorVariants.notFound`, router.
- Produces: route `{ path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage }`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest'
import { router } from '../index' // if not exported, build a test router from the routes array
import NotFoundPage from '../../pages/NotFoundPage.vue'

describe('router 404', () => {
  it('matches an unknown path to the not-found route', () => {
    const match = router.resolve('/totally/unknown/path')
    expect(match.name).toBe('not-found')
    expect(match.matched[0]?.components?.default).toBe(NotFoundPage)
  })
})
```
> If `router` isn't exported, export the `routes` array and resolve against a throwaway `createRouter({ history: createMemoryHistory(), routes })` in the test.
- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Write `NotFoundPage.vue`**
```vue
<template>
  <main class="not-found-page">
    <ErrorState v-bind="errorVariants.notFound(() => router.push('/'))" />
  </main>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import ErrorState from '../components/ui/ErrorState.vue'
import { errorVariants } from '../components/ui/errorVariants'
const router = useRouter()
</script>
<style scoped>
.not-found-page { display: flex; justify-content: center; padding: var(--space-7) var(--space-4); }
</style>
```
- [ ] **Step 4: Append the catch-all in `src/router/index.ts`** — as the LAST entry in the `routes` array:
```ts
import NotFoundPage from '../pages/NotFoundPage.vue'
// ...last item in routes: []:
{ path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
```
- [ ] **Step 5: Run test to verify it passes** → PASS.
- [ ] **Step 6: Commit**
```bash
git add src/pages/NotFoundPage.vue src/router/index.ts src/router/__tests__/notFound.spec.ts
git commit -m "feat(router): 404 catch-all with NotFound error state"
```

---

## Phase 2 — Recovery policy (P1)

### Task 6: idempotent-read auto-retry

**Files:**
- Create: `src/lib/api/retry.ts`, `src/lib/api/__tests__/retry.spec.ts`
- Modify: `src/lib/api/client.ts` (apply retry around the read path only)

**Interfaces:**
- Produces: `isIdempotentReadMethod(method: string): boolean` (true for `get#*`/`list#*`/`search#*`); `retryRead<T>(fn: () => Promise<T>, opts?: { attempts?: number; baseDelayMs?: number }): Promise<T>` — retries on thrown error up to `attempts` (default 3 total) with exponential backoff; re-throws the last error.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi } from 'vitest'
import { isIdempotentReadMethod, retryRead } from '../retry'

describe('retry policy', () => {
  it('classifies only get/list/search verbs as idempotent reads', () => {
    expect(isIdempotentReadMethod('facade.X.get#Thing')).toBe(true)
    expect(isIdempotentReadMethod('facade.X.list#Things')).toBe(true)
    expect(isIdempotentReadMethod('facade.X.search#Things')).toBe(true)
    expect(isIdempotentReadMethod('facade.X.create#Run')).toBe(false)
    expect(isIdempotentReadMethod('facade.X.run#SavedRunDiff')).toBe(false)
  })
  it('retries a failing read then succeeds, with capped attempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce('ok')
    const out = await retryRead(fn, { attempts: 3, baseDelayMs: 0 })
    expect(out).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('re-throws after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'))
    await expect(retryRead(fn, { attempts: 2, baseDelayMs: 0 })).rejects.toThrow('down')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
```
- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Write `src/lib/api/retry.ts`**
```ts
const READ_VERBS = ['get', 'list', 'search']

/** A facade method is `facade.<Service>.<verb>#<Noun>`; only get/list/search are safe to auto-retry. */
export function isIdempotentReadMethod(method: string): boolean {
  const verb = method.split('.').pop()?.split('#')[0]?.toLowerCase() ?? ''
  return READ_VERBS.includes(verb)
}

export async function retryRead<T>(fn: () => Promise<T>, opts: { attempts?: number; baseDelayMs?: number } = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3)
  const baseDelayMs = opts.baseDelayMs ?? 200
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw lastErr
}
```
- [ ] **Step 4: Run test to verify it passes** → PASS.
- [ ] **Step 5: Apply in `src/lib/api/client.ts`** — in `callService` (or the single function that POSTs to `/rpc/json`), wrap ONLY reads. Locate where the request promise is created and wrap it:
```ts
import { isIdempotentReadMethod, retryRead } from './retry'
// where the request is dispatched for `method`:
const doRequest = () => /* existing fetch/dispatch returning the parsed result */
const result = isIdempotentReadMethod(method)
  ? await retryRead(doRequest)           // reads: capped auto-retry
  : await doRequest()                     // writes: exactly once, never retried
```
> Do NOT retry inside `doRequest`. Do NOT alter `AuthRequiredError` handling here (Task 7). Confirm `method` is the `facade.*` string already in scope.
- [ ] **Step 6: Run full check** — `npm run check` → PASS (no existing test regresses).
- [ ] **Step 7: Commit**
```bash
git add src/lib/api/retry.ts src/lib/api/__tests__/retry.spec.ts src/lib/api/client.ts
git commit -m "feat(api): auto-retry idempotent reads; never retry writes"
```

### Task 7: session-expired → login with return path

**Files:**
- Modify: `src/lib/api/client.ts` or `src/stores/auth.ts` (central `AuthRequiredError` handling)
- Test: `src/lib/api/__tests__/sessionExpired.spec.ts`

**Interfaces:**
- Consumes: existing `AuthRequiredError`, `buildAuthRedirect(redirect)` from `stores/auth`, router.
- Produces: `handleAuthExpiry(currentPath: string): void` — pushes the login route with a `redirect` query equal to `currentPath`. (Form-dirty preservation is page-level per spec §5; not global.)

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect, vi } from 'vitest'
import { handleAuthExpiry } from '../sessionExpiry' // (new module; see step 3)

describe('handleAuthExpiry', () => {
  it('redirects to login preserving the current path as the return target', () => {
    const push = vi.fn()
    handleAuthExpiry('/settings/sftp', { push, build: (r) => ({ name: 'login', query: { redirect: r } }) })
    expect(push).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/settings/sftp' } })
  })
})
```
- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Write `src/lib/api/sessionExpiry.ts`**
```ts
interface Nav { push: (to: unknown) => void; build: (redirect: string) => unknown }
/** Passive/clean view → bounce to login keeping the return path (spec §5). */
export function handleAuthExpiry(currentPath: string, nav: Nav): void {
  if (currentPath.startsWith('/login')) return
  nav.push(nav.build(currentPath))
}
```
- [ ] **Step 4: Wire it where `AuthRequiredError` is currently surfaced** — in the app-level catch (e.g. the boundary's sibling auth handler or the existing global auth handling in `App.vue`/`stores/auth`), call `handleAuthExpiry(router.currentRoute.value.fullPath, { push: router.push, build: buildAuthRedirect })`. Keep existing login-page error display (`authStore.error`) intact.
- [ ] **Step 5: Run test to verify it passes** → PASS.
- [ ] **Step 6: Commit**
```bash
git add src/lib/api/sessionExpiry.ts src/lib/api/__tests__/sessionExpired.spec.ts src/lib/api/client.ts
git commit -m "feat(auth): route session expiry to login with return path"
```

---

## Phase 3 — Access-denied parity (P1)

### Task 8: SPA hard-403 AccessDenied

**Files:**
- Create: `src/pages/AccessDeniedPage.vue`
- Modify: `src/router/index.ts` (add `/access-denied`); the guard/handler that detects a hard 403 redirects here
- Test: `src/pages/__tests__/AccessDeniedPage.spec.ts`

**Interfaces:**
- Consumes: `ErrorState`, `errorVariants.accessDenied`.
- Produces: route `{ path: '/access-denied', name: 'access-denied', component: AccessDeniedPage }`. **Soft** permission downgrades keep their existing gentle redirects (do not change them).

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccessDeniedPage from '../AccessDeniedPage.vue'

describe('AccessDeniedPage', () => {
  it('shows the access-denied state without leaking internal detail', () => {
    const wrapper = mount(AccessDeniedPage, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('super-admin access required')
    expect(wrapper.text()).not.toMatch(/component:\/\/|403|exception/i)
  })
})
```
- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Write `AccessDeniedPage.vue`**
```vue
<template>
  <main class="access-denied-page">
    <ErrorState v-bind="errorVariants.accessDenied(() => router.push('/'))" />
  </main>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import ErrorState from '../components/ui/ErrorState.vue'
import { errorVariants } from '../components/ui/errorVariants'
const router = useRouter()
</script>
<style scoped>
.access-denied-page { display: flex; justify-content: center; padding: var(--space-7) var(--space-4); }
</style>
```
- [ ] **Step 4: Add the route + redirect hard 403s** — add `{ path: '/access-denied', name: 'access-denied', component: AccessDeniedPage }`; where a guard detects a *total* role boundary (not a soft view-only downgrade), `next({ name: 'access-denied' })`. Leave existing soft-downgrade redirects unchanged.
- [ ] **Step 5: Run test to verify it passes** → PASS; then `npm run check`.
- [ ] **Step 6: Commit**
```bash
git add src/pages/AccessDeniedPage.vue src/router/index.ts src/pages/__tests__/AccessDeniedPage.spec.ts
git commit -m "feat(router): hard-403 access-denied state (soft redirects unchanged)"
```

### Task 9: Moqui access-denied screen (403, no leak, nav hidden)

> Depends on the open super-admin grant decision (spec §8). The screens stay super-admin-only; this only changes *presentation*.

**Files:**
- Create: `screen/AccessDenied.xml` (in `darpan-backend/runtime/component/darpan/`)
- Modify: `screen/Reconciliation.xml`, `screen/Settings.xml`, and the other guarded screens — swap the `<return error>` guard; gate `subscreens-item menu-include` on `isSuperAdmin`
- Modify: `theme-library/css/components.css` — `.error-state` block (`--dt-*` tokens)
- Test: extend `src/test/groovy/darpan/security/ScreenUiAuthzTests.groovy`

**Interfaces:**
- Produces: a shared `AccessDenied` screen rendering the §4 anatomy via `theme-library`, setting HTTP 403, with no `component://` path in the body.

- [ ] **Step 1: Write the failing test (extend `ScreenUiAuthzTests`)** — assert a denied render carries 403 and no internal path. Add a method that renders the screen via Moqui's `ScreenTest` harness as a non-super-admin and asserts the response status is 403 and the body excludes `component://`.
```groovy
@Test
void deniedUserGetsCleanAccessDeniedNotRawError() {
  // render component://darpan/screen/Reconciliation.xml as a DARPAN_TENANT_USER through ScreenTest;
  // assert status == 403 and !body.contains('component://') and body.contains('super-admin')
}
```
> Confirm the exact `org.moqui.impl.screen.ScreenTest` API in this framework version when implementing; the assertion targets are status=403 and absence of `component://`.
- [ ] **Step 2: Run it to confirm it fails** — `cd darpan-backend && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew --no-daemon :runtime:component:darpan:test --tests '*ScreenUiAuthzTests'` → FAIL.
- [ ] **Step 3: Create `screen/AccessDenied.xml`**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<screen require-authentication="true">
    <pre-actions><script>ec.web?.response?.setStatus(403)</script></pre-actions>
    <widgets>
        <container-box><box-body>
            <render-mode><text type="html"><![CDATA[
              <div class="error-state" role="alert">
                <h3 class="error-state__title">super-admin access required</h3>
                <p class="error-state__msg">these administration screens are limited to super-admin users — head back to the app to keep working</p>
              </div>
            ]]></text></render-mode>
        </box-body></container-box>
    </widgets>
</screen>
```
- [ ] **Step 4: Swap the guard in each protected screen** — replace the `<pre-actions><if condition="!...isSuperAdmin(ec)"><return error.../></if></pre-actions>` with a forward to `AccessDenied` (e.g. `<sri.forceResponseInclude>`/subscreen include returning 403) instead of the raw `<return error message>`; verify the chosen mechanism renders `AccessDenied` and stops the protected content.
- [ ] **Step 5: Hide nav for non-super-admins** — on each `subscreens-item` for the protected screens, add `menu-include="..."` gated on `isSuperAdmin` so non-super-admins don't see the entries.
- [ ] **Step 6: Add `.error-state` to `theme-library/css/components.css`**
```css
.error-state {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: var(--dt-space-3); padding: var(--dt-space-5);
  border: 1px solid var(--dt-color-border); border-radius: var(--dt-radius-md);
  background: var(--dt-color-bg-1);
}
.error-state__title { color: var(--dt-color-fg-strong); font-weight: 400; margin: 0; }
.error-state__msg { color: var(--dt-color-fg-muted); margin: 0; max-width: 40ch; }
```
- [ ] **Step 7: Run the test to verify it passes** → PASS (403 + no path leak).
- [ ] **Step 8: Commit**
```bash
git add screen/AccessDenied.xml screen/Reconciliation.xml screen/Settings.xml theme-library/css/components.css src/test/groovy/darpan/security/ScreenUiAuthzTests.groovy
git commit -m "feat(screen): styled access-denied (403, no path leak), nav hidden for non-super-admins"
```

---

## Phase 4 — Optional (P2): offline banner

### Task 10: offline detection + auto-recover (optional)

**Files:**
- Create: `src/components/shell/OfflineBanner.vue`, test
- Modify: `src/App.vue` (mount the banner above the shell)

- [ ] **Step 1:** Test: mounting with `navigator.onLine === false` shows the banner; dispatching `online` hides it. (Use `vi.stubGlobal`/event dispatch.)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `OfflineBanner.vue`: `ref` bound to `navigator.onLine`, `online`/`offline` listeners, renders the slim banner (`errorStateIcons.offline`, scoped styles) only when offline; on `online`, emits `reconnect` so callers can re-fire the last failed read.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Mount in `App.vue` (additive, above `<AppErrorBoundary>`); confirm no happy-path change when online.
- [ ] **Step 6:** Commit `feat(ui): offline banner with auto-recover on reconnect`.

---

## Self-Review

**Spec coverage:** Access-denied (Tasks 8–9) · crash boundary (Task 4) · server/API error + read-retry/no-write-retry (Tasks 4, 6) · session-expired (Task 7) · 404 (Task 5) · offline P2 (Task 10) · shared token contract (Tasks 2 + 9 use the same anatomy via each surface's tokens) · capture hook (Task 1) · non-disruption (scoped styles, transparent boundary, `npm run check` gates every commit) · Moqui 403 + no path leak + nav hide (Task 9). ✓ All spec sections map to a task.

**Placeholder scan:** Two intentional verify-when-implementing notes (client.ts read-path insertion point in Task 6; Moqui `ScreenTest`/forward mechanism in Task 9) — both name the exact target (the `method`-keyed dispatch; status=403 + no `component://`) rather than leaving logic undefined. No "TBD"/"add error handling"/"similar to" placeholders.

**Type consistency:** `ErrorState` props `{ title, message?, icon?, action? }` are produced verbatim by `errorVariants.*` (Task 3) and consumed by `AppErrorBoundary` (Task 4), `NotFoundPage` (Task 5), `AccessDeniedPage` (Task 8). `isIdempotentReadMethod`/`retryRead` (Task 6) and `handleAuthExpiry` (Task 7) names are stable across their tasks. ✓
