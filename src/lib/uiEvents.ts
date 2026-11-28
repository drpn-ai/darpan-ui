export const INLINE_MENU_OPEN_EVENT = 'darpan:inline-menu-open'
export const DISMISS_INLINE_MENUS_EVENT = 'darpan:dismiss-inline-menus'
export const WORKFLOW_CANCEL_REQUEST_EVENT = 'darpan:workflow-cancel-request'
export const WORKFLOW_HINT_REQUEST_EVENT = 'darpan:workflow-hint-request'
/** DAR-UI-121. A page asks the shell to open Ask Darpan, optionally already in a slash command (the mascot's bow does the same). */
export const COMMAND_PALETTE_OPEN_REQUEST_EVENT = 'darpan:command-palette-open-request'

export type WorkflowHintTone = 'neutral' | 'warning'

export interface WorkflowHintRequestDetail {
  message: string
  tone?: WorkflowHintTone
  durationMs?: number
}

export interface CommandPaletteOpenRequestDetail {
  initialQuery?: string
}

/** DAR-OPS-029 S99-117. Asks the shell (App.vue) for a transient workflow hint; every page and composable says it this way. */
export function requestWorkflowHint(detail: WorkflowHintRequestDetail): void {
  document.dispatchEvent(new CustomEvent<WorkflowHintRequestDetail>(WORKFLOW_HINT_REQUEST_EVENT, { detail }))
}
