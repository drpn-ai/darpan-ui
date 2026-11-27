/**
 * DAR-UI-158. Every icon the app draws, and how it is drawn. A page names an icon (<AppIcon name="settings" />) and
 * never writes its own <svg>: the drawing (its box, fill or stroke, weight, extra parts and nudges) lives here once,
 * so it cannot be drawn wrong on one page. Two families, as the design system sets them:
 *   - filled, on a 20-unit box (fill: currentColor);
 *   - stroked, round caps and joins, on a 20- or 24-unit box at the weight its family uses.
 * One drawing per meaning (Aditi 2026-11-27): a second drawing of the same thing is a bug.
 */
export interface IconCircle {
  cx: number
  cy: number
  r: number
  /** A solid dot (the eye's pupil) inside a stroked icon. */
  solid?: true
}

export interface IconRect {
  x: number
  y: number
  width: number
  height: number
  rx?: number
}

export interface IconDrawing {
  box: 20 | 24
  paint: 'fill' | 'stroke'
  /** Stroked icons only. */
  strokeWidth?: number
  paths: readonly string[]
  circles?: readonly IconCircle[]
  rects?: readonly IconRect[]
  /** Optical nudge so the glyph sits centred in its button. */
  transform?: string
}

const filled = (path: string, transform?: string): IconDrawing => ({ box: 20, paint: 'fill', paths: [path], ...(transform ? { transform } : {}) })
const stroked = (box: 20 | 24, strokeWidth: number, paths: readonly string[], circles?: readonly IconCircle[],
  rects?: readonly IconRect[]): IconDrawing =>
  ({ box, paint: 'stroke', strokeWidth, paths, ...(circles ? { circles } : {}), ...(rects ? { rects } : {}) })

export const ICONS = {
  // Filled, 20-unit box.
  edit: filled('M14.73 2.73a1.75 1.75 0 0 1 2.48 2.48l-1.2 1.2-2.48-2.48 1.2-1.2ZM12.47 4.99 4.8 12.66l-1.18 3.72 3.72-1.18 7.67-7.67-2.54-2.54Z'),
  trash: filled(
    'M7.5 3.5A1.5 1.5 0 0 1 9 2h2a1.5 1.5 0 0 1 1.5 1.5V4H15a.75.75 0 0 1 0 1.5h-.57l-.58 9.17A1.75 1.75 0 0 1 12.1 16.5H7.9a1.75 1.75 0 0 1-1.75-1.33L5.57 5.5H5a.75.75 0 0 1 0-1.5h2.5v-.5ZM11 3.5h-2V4h2v-.5ZM7.07 5.5l.56 8.89c.02.19.13.31.27.31h4.2c.14 0 .25-.12.27-.31l.56-8.89H7.07Zm1.68 1.75a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75Zm2.5 0a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75Z',
    'translate(0 0.75)',
  ),
  // Arrow into a tray.
  download: filled('M10 2.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5Zm-5 11a.75.75 0 0 1 .75.75v1.5c0 .14.11.25.25.25h8c.14 0 .25-.11.25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 14 17.5H6A1.75 1.75 0 0 1 4.25 15.75v-1.5A.75.75 0 0 1 5 13.5Z'),
  back: filled('M9.53 4.47a.75.75 0 0 1 0 1.06L6.81 8.25H15a.75.75 0 0 1 0 1.5H6.81l2.72 2.72a.75.75 0 1 1-1.06 1.06l-4-4a.75.75 0 0 1 0-1.06l4-4a.75.75 0 0 1 1.06 0Z'),
  list: filled('M5.5 5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm2-.75h8a.75.75 0 0 1 0 1.5h-8a.75.75 0 0 1 0-1.5ZM5.5 10a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm2-.75h8a.75.75 0 0 1 0 1.5h-8a.75.75 0 0 1 0-1.5ZM5.5 15a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm2-.75h8a.75.75 0 0 1 0 1.5h-8a.75.75 0 0 1 0-1.5Z'),
  play: filled('M6.75 4.2c0-.91.99-1.48 1.78-1.01l7.1 4.25a1.18 1.18 0 0 1 0 2.02l-7.1 4.25a1.18 1.18 0 0 1-1.78-1.01V4.2Z', 'translate(0 1.5)'),
  plus: filled('M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z'),
  // Dismiss: popups and chip removes.
  close: filled('M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 1 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z'),
  // More actions.
  ellipsis: filled('M5 8.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z'),
  // A floppy disk: AppSaveAction.
  save: filled('M4.75 3A1.75 1.75 0 0 0 3 4.75v10.5C3 16.22 3.78 17 4.75 17h10.5c.97 0 1.75-.78 1.75-1.75V6.31c0-.46-.18-.9-.51-1.23l-1.57-1.57A1.75 1.75 0 0 0 13.69 3H4.75Zm2 1.5h5.5v2h-5.5v-2Zm-2 .25c0-.14.11-.25.25-.25h.25v2A1.5 1.5 0 0 0 6.75 8h5.5a1.5 1.5 0 0 0 1.5-1.5v-2h-.06c.07 0 .13.03.18.07l1.56 1.56c.05.05.07.11.07.18v8.94a.25.25 0 0 1-.25.25H13V12a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 7 12v3.5H4.75a.25.25 0 0 1-.25-.25V4.75ZM8.5 12h3v3.5h-3V12Z'),

  // Stroked, 20-unit box, 1.8: the cancel X (AppCancelAction) and the chevrons that open and close a section.
  cancel: stroked(20, 1.8, ['M5 5l10 10M15 5L5 15']),
  chevronLeft: stroked(20, 1.8, ['M12.3 4.8 7.1 10l5.2 5.2']),
  chevronDown: stroked(20, 1.8, ['M5 7.5 10 12.5l5-5']),
  // Two chevrons: fold a side panel away.
  chevronsLeft: stroked(20, 1.8, ['M12.3 4.8 7.1 10l5.2 5.2', 'M16 4.8 10.8 10l5.2 5.2']),
  // Stroked, 20-unit box, 1.6: a tick and the move-up / move-down arrows of an ordered list.
  check: stroked(20, 1.6, ['M4 10l4 4 8-8']),
  arrowUp: stroked(20, 1.6, ['M10 15V5M5 10l5-5 5 5']),
  arrowDown: stroked(20, 1.6, ['M10 5v10M5 10l5 5 5-5']),
  // Stroked, 20-unit box, 1.5: connection diagnostics (a pulse line), code, and show-a-secret (an eye).
  diagnostics: stroked(20, 1.5, ['M2.75 10h2.9l1.7-4.6a.75.75 0 0 1 1.42.06l2.2 8 1.66-5.2a.75.75 0 0 1 1.4-.08l.9 1.82h2.32']),
  code: stroked(20, 1.5, ['M7.5 5.5 3 10l4.5 4.5M12.5 5.5 17 10l-4.5 4.5']),
  eye: stroked(20, 1.5, ['M2.5 10s2.75-5 7.5-5 7.5 5 7.5 5-2.75 5-7.5 5-7.5-5-7.5-5Z'], [{ cx: 10, cy: 10, r: 2.25, solid: true }]),

  // Stroked, 24-unit box, 1.8: page and finding actions.
  settings: stroked(24, 1.8, [
    'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.7a2 2 0 0 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6v-.3a2 2 0 0 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h.3a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z',
  ], [{ cx: 12, cy: 12, r: 3 }]),
  // Re-check all open findings: an open ring with its arrowhead (DAR-UI-147).
  recheck: stroked(24, 1.8, ['M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4']),
  // Resolve one finding: a tick in a ring (DAR-BE-123).
  resolve: stroked(24, 1.8, ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM8 12.5l2.5 2.5L16 9.5']),
  // Acknowledge a finding: an eye with a check for its pupil (DAR-UI-144).
  acknowledge: stroked(24, 1.8, ['M2.5 12C4.5 8 8 6 12 6s7.5 2 9.5 6c-2 4-5.5 6-9.5 6s-7.5-2-9.5-6ZM9.25 12.25l1.75 1.75 3.75-3.75']),
  // Speech bubble: the feedback trigger on a finding (DAR-UI-144).
  feedback: stroked(24, 1.8, ['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z']),

  // Stroked, 24-unit box, 1.4: the run types (DAR-UI-049, DAR-UI-058), drawn small beside their word.
  sync: stroked(24, 1.4, ['M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4']),
  // The flowchart in miniature (three stages, a side exit), not the circular-arrows glyph, which reads as sync.
  lifecycle: stroked(24, 1.4, ['M10 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 6v4M8 14v4M10 12h9M16 9l3 3-3 3']),
  audit: stroked(24, 1.4, ['M4 6l1.5 1.5L8.5 4.5M11 6h9M4 12l1.5 1.5L8.5 10.5M11 12h9M4 18l1.5 1.5L8.5 16.5M11 18h9']),

  // Stroked, 24-unit box, 1.4: the blocking error states, the offline banner and the empty state, drawn large and dim.
  lock: stroked(24, 1.4, ['M8 11V8a4 4 0 0 1 8 0v3'], undefined, [{ x: 5, y: 11, width: 14, height: 9, rx: 1.5 }]),
  alert: stroked(24, 1.4, ['M12 4 2.5 20h19L12 4Z', 'M12 10v4'], [{ cx: 12, cy: 17.2, r: 0.55, solid: true }]),
  clock: stroked(24, 1.4, ['M12 8v4l2.5 2'], [{ cx: 12, cy: 12, r: 8 }]),
  offline: stroked(24, 1.4, ['M3 3l18 18', 'M5 12a10 10 0 0 1 4-3M8.5 16.5a5 5 0 0 1 6 0M12 20h.01']),
  inbox: stroked(24, 1.4, ['M4 13l2.2-7.2A2 2 0 0 1 8.1 4.4h7.8a2 2 0 0 1 1.9 1.4L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z', 'M4 13h4l1.5 2.4h5L16 13h4']),
} as const satisfies Record<string, IconDrawing>

export type IconName = keyof typeof ICONS
