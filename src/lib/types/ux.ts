export type CommandGroup = 'Navigate' | 'Data'

export interface CommandAction {
  id: string
  label: string
  description: string
  group: CommandGroup
  /** Route to navigate to. Omitted for actions that do something in place. */
  to?: string
  /**
   * Runs instead of navigating. Added so the launcher could carry signing out and
   * switching theme; both became slash commands instead (/logout, /light, /dark), so
   * nothing declares this today. Kept because `to` is optional only while it exists —
   * dropping it would make every action a navigation again.
   */
  run?: () => void | Promise<void>
  aliases: string[]
  requiresQuery?: boolean
}
