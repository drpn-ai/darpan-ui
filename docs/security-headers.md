# Security headers (firebase.json)

Both hosting targets (`uat`, `prod`) in `firebase.json` serve the same header set;
only the CSP `connect-src` API host differs. firebase.json cannot carry comments,
so the rationale for the non-obvious values lives here.

Audit trail: hardened in `f4a5619` (canonical lowercase `nosniff`, Permissions-Policy,
`frame-ancestors 'none'`), re-inventoried 2026-07-02 (MACH P2).

## Current posture

| Header | Value | Note |
| --- | --- | --- |
| Content-Security-Policy | see below | per-target `connect-src` |
| X-Content-Type-Options | `nosniff` | canonical lowercase in both blocks |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | |
| Referrer-Policy | `strict-origin-when-cross-origin` | |
| Permissions-Policy | camera=(self), everything else denied | |

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
