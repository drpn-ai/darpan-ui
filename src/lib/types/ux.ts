export type CommandGroup = 'Navigate' | 'Data'

export interface CommandAction {
  id: string
  label: string
  description: string
  group: CommandGroup
  /** Route to navigate to. Acting in place (sign out, theme) is a slash command, not an action. */
  to: string
  aliases: string[]
  requiresQuery?: boolean
}
