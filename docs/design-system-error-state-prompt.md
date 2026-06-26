# Design-system — add "Error State" component

**Status:** the canonical component is authored at [`design-system/comp-error-state.html`](./design-system/comp-error-state.html), built to match the live **Darpan Design System** (read via the `claude_design` MCP — `colors_and_type.css`, `comp-empty-state.html`, `color-status.html`). Because the system is **file-based** (`preview/comp-*.html` with `@dsCard` markers), that file can be pushed to the design system at `preview/comp-error-state.html`. The prompt below is a regenerate-from-scratch fallback.

**Confirmed canonical conventions** the component follows: **IBM Plex Mono** (mono-first), **weight 400 everywhere** (bold is disabled), **grayscale by design — status tones differ by tonal step, never hue** (even "failed" is gray), flat (no shadow), the `@dsCard` preview convention, the shared `.btn-primary`, and Empty State's **lowercase / no-period** copy voice. **Empty State already exists** (dashed border); Error State is its **solid-border** sibling.

---

Add an **Error State** component family to the Darpan design system, as a sibling of **Empty State**. It must match the system's existing visual language exactly — do not invent new colors, weights, or effects.

**Design language (follow strictly):**
- **Monochrome and flat.** The palette is grayscale only — there is NO red/amber/green for status. Do not introduce any color for errors. Severity is conveyed by copy and a subtle icon, never by hue.
- **No shadows** (flat surfaces). **No bold** — all text is weight 400.
- **Dark + light themes**, using the existing tokens:
  - Card surface: `--surface` (#101010 dark / #ffffff light)
  - Border: `--border` (#303030 dark / #d4d4d4 light)
  - Title text: `--text` (#f2f2f2 / #141414)
  - Body / muted text: `--text-muted` (#a0a0a0 / #5f5f5f)
  - Spacing scale: `--space-1`…`--space-7`; card padding `--space-5`
  - Radius: `--radius-md`
- Typography: same family and scale as Empty State; title weight 400, calm sizing.

**Anatomy — a centered card:**
- Optional **icon**: a monochrome line icon in `--text-muted`, ~24–28px, top-centered.
- **Title**: short, weight 400, `--text`.
- **Message**: one or two sentences, plain language, `--text-muted`. No jargon, no stack traces, no internal IDs/paths.
- Optional **primary action**: a single button in the existing button style; optional secondary text link below it.

**The only differentiator from Empty State:** Empty State uses a **dashed** 1px border (nothing is wrong). Error State uses a **solid** 1px `--border` (something needs attention). No color difference — border style is the sole signal.

**Variants (same anatomy, content presets):**
1. **Access denied** — icon: lock. Title: "Super-admin access required". Message: explains the role requirement in plain language. Action: "Go to Darpan".
2. **Server error** — icon: alert triangle. Title: "Something went wrong". Message: "We hit an unexpected error." Action: "Try again".
3. **Session expired** — icon: clock. Title: "Your session ended". Message: "Please sign in to continue." Action: "Sign in".
4. **Not found** — no icon. Title: "Page not found". Message: "That page doesn't exist or has moved." Action: "Back to home".
5. **Offline banner** *(separate from the card)* — a slim, full-width inline banner (not a card): "You're offline. We'll reconnect automatically." No action. Same monochrome/flat treatment.

**Show these states/props in the component:** with icon / without icon · with action / without action · with secondary link · dark + light themes · all four card variants · the offline banner.

**Accessibility:** the card uses `role="alert"`; the action is a real, focusable button/link; copy is blameless and calm (no blame, no fear).

**Empty State:** if Empty State is not already a documented component, add it as the **dashed-border** sibling (title + optional message, same tokens), so Empty State and Error State read as a matched pair.

Deliver as a reusable component with the variants as presets, fully consistent with the rest of the Darpan system.
