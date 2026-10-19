# Security headers (firebase.json)

All three hosting targets in `firebase.json` (`prod`, `uat`, `sm-darpan`) serve the same header
set. Only the CSP `connect-src` API host differs per target. firebase.json cannot carry comments,
so the rationale for the non-obvious values lives here.

Audit trail: hardened in `f4a5619` (canonical lowercase `nosniff`, Permissions-Policy,
`frame-ancestors 'none'`), re-inventoried 2026-07-02 (MACH P2), re-checked against firebase.json
2026-10-19.

## Current posture

Applied to every path (`source: "**"`):

| Header | Value | Note |
| --- | --- | --- |
| Content-Security-Policy | see below | per-target `connect-src` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | |
| Permissions-Policy | `camera=(self), microphone=(), geolocation=(), payment=(), usb=()` | |
| X-Content-Type-Options | `nosniff` | canonical lowercase in every block |
| Referrer-Policy | `strict-origin-when-cross-origin` | |
| Cache-Control | `no-cache` | `index.html` and SPA routes revalidate on every load, so a deploy is picked up at once |

Path overrides:

| Source | Cache-Control | Why |
| --- | --- | --- |
| `/assets/**` | `public, max-age=31536000, immutable` | Vite emits content-hashed filenames |
| `/favicon.svg` | `public, max-age=86400` | not hashed |

## CSP directives

Shared by all targets:

```
default-src 'self';
base-uri 'self';
object-src 'none';
font-src 'self' data: https://fonts.gstatic.com;
script-src 'self' https://www.gstatic.com https://*.firebaseapp.com;
img-src 'self' data: https:;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
frame-src https://linear.app;
frame-ancestors 'none';
form-action 'self';
```

`connect-src` per target:

| Target | `connect-src` |
| --- | --- |
| `prod` | `'self' https://*.hotwax.io https://api.drpn.ai` |
| `uat` | `'self' https://*.hotwax.io https://api-uat.drpn.ai` |
| `sm-darpan` | `'self' https://sm-darpan-maarg.hotwax.io` |

`frame-src https://linear.app` exists for the embedded roadmap page (`/roadmap/reconciliation`,
`VITE_DARPAN_LINEAR_EMBED_ENABLED`). When a target changes its API host, update that target's
`connect-src` in the same change, or every RPC call is blocked by the browser.

## CSP: why `style-src` keeps `'unsafe-inline'`

`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`

Inventory of the built app (2026-07-02, `npm run build-only`):

- `dist/index.html` contains no inline `<style>` elements and no `style=`
  attributes; all CSS is emitted as external files (21 `dist/assets/*.css`,
  loaded via `<link rel="stylesheet">`).
- The entry bundle contains no runtime `<style>`-element injection and no
  `setAttribute('style', ...)` calls (the single `insertBefore`/style-adjacent
  match is Vue's generic DOM nodeOps, not style injection).
- The source tree has 10 dynamic `:style=` bindings (AppTableFrame column
  widths, JsonCollapseNode indent, WorkflowProgressBar fill width,
  ReconciliationRuleSetEditorPage operator popover/board sizing).

Decision: keep `'unsafe-inline'` for `style-src`. Vue applies `:style` bindings
through the CSSOM (`el.style` / `cssText`), which current browsers do not block
under `style-src`, so removal would *probably* work — but "probably" is not
provable here: Firebase headers are not applied by `vite preview`, so the only
honest verification is a full browser pass of every route with the exact CSP
served, watching for violation reports. Until that pass exists (ideally a
`Content-Security-Policy-Report-Only` rollout without `'unsafe-inline'`),
removing it risks silently dropped styling on dynamic-width tables, JSON trees,
and the rule-set editor.

Hardening path when someone picks this up:

1. Serve `dist/` with the candidate CSP in `Content-Security-Policy-Report-Only`.
2. Drive the app through login + every route; collect violations.
3. If clean, drop `'unsafe-inline'`; consider `style-src-elem`/`style-src-attr`
   split so element and attribute policies can diverge.

## CSP: `script-src`

`script-src 'self' https://www.gstatic.com https://*.firebaseapp.com`

Verified 2026-07-02: contains no `'unsafe-inline'` and no `'unsafe-eval'`
(zero matches in firebase.json); the built `dist/index.html` has no inline
scripts, so nothing depends on relaxing it. Do not add either directive.
