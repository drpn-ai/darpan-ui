export type CommandGroup = 'Navigate' | 'Data'

export interface CommandAction {
  id: string
  label: string
  description: string
  group: CommandGroup
  /** Route to navigate to. Omitted for actions that do something in place. */
  to?: string
  /**
   * Runs instead of navigating. Added so the launcher can carry the things that used
   * to live only in the floating user menu — signing out and switching theme — now
   * that the mascot is the only object in the corner.
   */
  run?: () => void | Promise<void>
  aliases: string[]
  requiresQuery?: boolean
}
