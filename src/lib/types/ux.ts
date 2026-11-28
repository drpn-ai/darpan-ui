import type { RouteLocationRaw } from 'vue-router'

export type CommandGroup = 'Navigate' | 'Data'

export interface CommandAction {
  id: string
  label: string
  description: string
  group: CommandGroup
  /**
   * Route to navigate to: a path, or a named route (DAR-OPS-029 S99-126: the router builds and encodes it). Acting in place
   * (sign out, theme) is a slash command, not an action.
   */
  to: RouteLocationRaw
  aliases: string[]
  requiresQuery?: boolean
}
