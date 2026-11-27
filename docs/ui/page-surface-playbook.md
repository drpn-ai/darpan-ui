# Darpan Page Surface Playbook

Use this file as the shared contract reference before migrating or creating settings, static, and workflow pages in `darpan-ui`.

## Static surfaces

- Frame with `StaticPageFrame` and section blocks with `StaticPageSection`.
- Use `static-page-record-grid` for saved-record grids.
- Add `static-page-record-grid--fixed` only when the page needs a locked dashboard-style column count.
- Use `static-page-record-tile` for simple saved records.
- Use `static-page-list-tile`, `static-page-list-tile__title`, and `static-page-list-tile__meta` when the tile has secondary copy or metadata.
- Use `static-page-module-grid`, `static-page-module-tile`, and `static-page-module-tile--active` for in-surface navigation tiles.
- Use `static-page-summary-grid`, `static-page-summary-card`, and `static-page-summary-label` for read-only metadata cards.
- Use `static-page-list-toolbar` and `static-page-pager` for saved-list chrome instead of page-local toolbar classes.
- Use `static-page-action-tile` and `static-page-create-action` for primary create/open-workflow actions.
- Use `StaticEditableTitle` for editable item names on static detail pages. Keep the heading visually unchanged; the editable affordance is the text cursor, not input chrome.

## Workflow surfaces

- Frame workflow pages with `WorkflowPage`.
- Build steps with `WorkflowStepForm`.
- Default create-entry workflows to one question per step instead of full-form create screens.
- Keep the record name or identifier on the final create step unless the user explicitly asks for another order.
- Use `WorkflowShortcutChoiceCards` for stepped multiple-choice prompts that should present keyed `A / B / C` choices and advance immediately on click or shortcut-key selection.
- Do not invent page-local multiple-choice card variants when this keyed-choice workflow pattern fits the prompt.
- Use `workflow-form--compact` for dense settings flows.
- Add `workflow-form--edit-single-page` for edit screens that stay on one surface instead of stepping.
- Use `workflow-form-grid`, `workflow-form-grid--two`, and `workflow-form-grid--compact` before inventing page-local layout CSS.
- Use `workflow-form-textarea` and `workflow-form-textarea--single-row` before page-local textarea sizing.
- Default key, PEM, token, headers JSON, and similar settings textareas to `workflow-form-textarea--single-row` unless the user explicitly needs a taller field.
- Keep action buttons on shared `AppSaveAction` and `AppSelect`.

## Shared controls

- Use `AppSelect` or `WorkflowSelect` for controlled select menus; do not fall back to native `<select>` on editable surfaces.
- Use `StaticEditableTitle` for inline title editing instead of page-local `contenteditable` handlers or bordered title inputs.
- Use `AppTableFrame` for editable table patterns and prefer shared table cell classes over scoped alignment fixes.
- Use `resolveRecordLabel()` for saved-record titles so pages stay resilient when descriptions are missing.
- **Edit buttons are icons, everywhere.** A control that edits, changes or renames something is the pencil `app-icon-action` (`<AppIcon name="edit" />`), never a text button reading "Edit", "Change", "Rename", "Change rules →" and the like. Its accessible name (`aria-label`, `title`) carries the words ("Change timezone", "Edit rules"). Where the same control adds when nothing exists, it is the plus icon (`plusIconPath`) with an "Add …" name. A fact cell or row that opens its own popup needs no edit control at all: the cell is the button (`StaticFactStrip`). Submit labels inside a workflow step ("Change" on a password step) are not edit buttons. `src/__tests__/editButtonsAreIcons.spec.ts` fails on a text edit button.
- **Icons are named, never drawn.** A page writes `<AppIcon name="settings" />`; `src/lib/icons.ts` holds each drawing once (its box, fill or stroke, weight and extra parts, such as the gear's hub). A new icon is a new entry there, in the design system's two families: filled on a 20-unit box, or stroked on a 20- or 24-unit box. One drawing per meaning. Guarded by `src/__tests__/iconsAreAppIcon.spec.ts` (DAR-UI-158).
- Every settings or record page opens with `StaticRecordTitle` (the name, caret-only in place, optional bare toggle) and `StaticFactStrip`.

## Motion

Motion confirms, it never decorates. It may carry border, background, opacity, and scale or blur within 3% (`--motion-enter-scale`, `--motion-press-scale`, never below 0.97). Use the tokens in `src/style.css` (`--motion-*`, `--ease-*`), not literal durations or easings.

- **Entrances** ease out (`--ease-out`, `--motion-base`). Nothing appears from nothing: start at `--motion-enter-scale` with opacity 0.
- **Exits** run ~20% shorter than their entrance (`--motion-exit`).
- **On-screen moves** (a reserve opening, a column resizing) ease in-out (`--ease-in-out`).
- **Popovers and help plates** scale from the side of their trigger (`transform-origin` toward it). Edit popups are modals and stay centred.
- **Press feedback** is `scale(var(--motion-press-scale))` on `:active` for `app-icon-action--large` only, over `--motion-press`.
- **Success pulses once.** A success message scales to `--motion-pulse-scale` (1.03) and back over `--motion-pulse` as it appears; `.success-copy` carries it (`@keyframes motion-pulse`). One pulse, never a loop.
- **Icon swaps crossfade.** When one icon replaces another (a tick appearing, copy → check), the incoming icon starts at opacity 0, `--motion-enter-scale` and `blur(var(--motion-swap-blur))` and settles over `--motion-fast`; the outgoing one runs the reverse. The table checkbox tick (`.app-table__checkbox::after`) is the reference.
- **Held means no tween.** While something is dragged or held, its transition is `none`; it follows the pointer exactly.
- **Always instant:** the Cmd+K palette, text-input focus, keyboard-triggered actions, and select menus.
- **No bounce, stretch, arcs, stagger, rubber-banding, or hover lifts** (`translateY` on hover). The mascot is the one exception, the way `--mascot-rust` is the one hue.
- **Tokens only.** No literal duration or curve (`160ms ease`) in any `transition` or `animation`; `src/__tests__/motionUsesTokens.spec.ts` sweeps `src/**/*.{css,vue}` and lists its few exceptions with reasons.
- `prefers-reduced-motion` collapses all of it (global rule at the end of `src/style.css`).

## Audit finding card

The finding detail (`AuditColumns.vue`, built from `src/lib/auditReport.ts` over the backend's `AuditReportAssembler.recordFacts`) follows one contract, so no finding reads emptier or stranger than another (DAR-BE-372, Aditi 2026-11-26).

1. **Only the compared systems.** The card speaks of the systems its check compares (`check.systems`: the systems its label names, else its statement, else its automation's sources), whether or not the check ran today. A HotWax-to-NetSuite finding never shows Shopify; a one-system check has one cell.
2. **Basics come from the read.** Each compared system's status, the amount and the day are filled from any field the check's read carries, including another system's word carried on a row (`omsItemStatusId` on a NetSuite line is HotWax's status). Every status, amount or date field a read gives is placed in `AuditReportAssembler.CARD_FIELDS`; `FindingCardRulesTests` fails on one that is not.
3. **Same rows per kind.** Order: Customer, Sales channel, Ship method. Return: Customer, Sales channel, Channel. Exchange: Customer, Sales channel, Warranty ID. Then anything else known (deposits).
4. **Reference ids.** The order name and the HotWax order id, the ids every system carries; no per-system id cards.
5. **Name records by their business id.** The headline and "Stuck on" name a line by its HotWax item (or the item its own headline names), an order by its name; never the finding id.
6. **No filler.** No "No status read", no "Other system", no dashed boxes for missing data.
7. **Missing is said.** A compared system that holds no record of it reads "Missing", never a dash. A dash is left only where a held record's read gave nothing, which rule 2 exists to prevent.

## Migration rules

- Split settings pages into static saved-record surfaces and workflow create/edit surfaces when the page is doing both jobs.
- Prefer adding a shared utility to `src/style.css` over a new page-local scoped style block when the pattern is likely to recur.
- If a page needs custom CSS, prove why the pattern is not reusable before keeping it local.
- Preserve route behavior and workflow-origin state when static pages launch workflows.
- Keep backend UI untouched; custom page behavior belongs in `darpan-ui`.

## Validation

- Add or update page tests that assert the shared contract classes are used.
- Run `npx vitest run <path>` for the touched pages/components first.
- Run `npm run check` (lint + type-check + vitest with coverage) before handoff.
- From the wrapper root, run `./plugins/darpan-workflows/scripts/check_repo_boundary.sh`.
- From the wrapper root, run `./plugins/darpan-workflows/scripts/run_ui_checks.sh`.
