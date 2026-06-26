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
