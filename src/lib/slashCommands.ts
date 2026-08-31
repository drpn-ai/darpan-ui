import type { SessionTenantOption } from './api/types'

export interface SlashCommandContext {
  availableTenants: SessionTenantOption[]
  activeTenantUserGroupId: string | null
}

export interface SlashCommandRow {
  id: string
  label: string
  description: string
  value: string
}

export interface SlashCommandResolution {
  rows: SlashCommandRow[]
  notice: string | null
}

interface SlashCommandBase {
  name: string
  aliases: string[]
  description: string
}

/** Needs an argument before it can do anything: `/switch-tenant {company}`. */
export interface SlashArgumentCommand extends SlashCommandBase {
  argumentLabel: string
  resolve: (argumentQuery: string, context: SlashCommandContext) => SlashCommandResolution
}

/**
 * Complete the moment it is named: `/logout`. Kept as a separate shape rather than an optional
 * `argumentLabel` so the resolver never has to assert that `resolve` exists.
 */
export interface SlashActionCommand extends SlashCommandBase {
  argumentLabel?: undefined
  resolve?: undefined
}

export type SlashCommand = SlashArgumentCommand | SlashActionCommand

export interface SlashResultRow {
  id: string
  label: string
  description: string
  /**
   * 'command' still needs its argument, so choosing it completes the input. 'option' is a chosen
   * argument. 'run' is a whole instruction on its own — the command name IS the argument — so
   * choosing it runs immediately.
   */
  kind: 'command' | 'option' | 'run'
  commandName: string
  value: string | null
}

export interface SlashResolution {
  isSlashQuery: boolean
  rows: SlashResultRow[]
  notice: string | null
}

export interface ParsedSlashInput {
  name: string
  argument: string | null
}

export const SLASH_PREFIX = '/'

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function compact(value: string): string {
  return normalize(value).replace(/\s+/g, '')
}

function matchesText(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalize(needle)
  if (!normalizedNeedle) return true
  return normalize(haystack).includes(normalizedNeedle) || compact(haystack).includes(compact(needle))
}

/**
 * Splits `/name argument` at the FIRST space. The space is the mode switch: without one the user is
 * still choosing a command (`argument: null`), with one they are filling in its argument — which is
 * why a trailing space yields `''` and not `null`.
 */
export function parseSlashInput(query: string): ParsedSlashInput | null {
  const trimmedStart = query.replace(/^\s+/, '')
  if (!trimmedStart.startsWith(SLASH_PREFIX)) return null

  const body = trimmedStart.slice(SLASH_PREFIX.length)
  const spaceIndex = body.indexOf(' ')
  if (spaceIndex < 0) return { name: body, argument: null }

  return { name: body.slice(0, spaceIndex), argument: body.slice(spaceIndex + 1).trimStart() }
}

function findCommand(commands: SlashCommand[], name: string): SlashCommand | null {
  const normalizedName = normalize(name)
  return (
    commands.find(
      (command) =>
        normalize(command.name) === normalizedName ||
        command.aliases.some((alias) => normalize(alias) === normalizedName),
    ) ?? null
  )
}

function takesArgument(command: SlashCommand): command is SlashArgumentCommand {
  return typeof command.argumentLabel === 'string'
}

/**
 * A hit on the command's own name outranks one that only reached it through an alias. Without this
 * `/d` led with `/light` — matched on its 'day' alias — so Enter set the theme already in effect.
 * Equal ranks keep declaration order, which Array.prototype.sort preserves.
 */
function matchRank(command: SlashCommand, typedName: string): number {
  return matchesText(command.name, typedName) ? 0 : 1
}

function toCommandRow(command: SlashCommand): SlashResultRow {
  // A usage line that spells out an argument the command does not take would be a lie, so the
  // action shape carries its description alone.
  if (!takesArgument(command)) {
    return {
      id: `slash-command-${command.name}`,
      label: `${SLASH_PREFIX}${command.name}`,
      description: command.description,
      kind: 'run',
      commandName: command.name,
      value: null,
    }
  }

  return {
    id: `slash-command-${command.name}`,
    label: `${SLASH_PREFIX}${command.name}`,
    description: `${command.description} Usage: ${SLASH_PREFIX}${command.name} {${command.argumentLabel}}`,
    kind: 'command',
    commandName: command.name,
    value: null,
  }
}

export function resolveSlashResults(
  query: string,
  commands: SlashCommand[],
  context: SlashCommandContext,
): SlashResolution {
  const parsed = parseSlashInput(query)
  if (!parsed) return { isSlashQuery: false, rows: [], notice: null }

  const matchedCommand = findCommand(commands, parsed.name)

  if (parsed.argument === null) {
    const rows = commands
      .filter(
        (command) =>
          matchesText(command.name, parsed.name) ||
          command.aliases.some((alias) => matchesText(alias, parsed.name)),
      )
      .sort((left, right) => matchRank(left, parsed.name) - matchRank(right, parsed.name))
      .map(toCommandRow)

    return {
      isSlashQuery: true,
      rows,
      notice: rows.length > 0 ? null : `No command matches "${SLASH_PREFIX}${parsed.name}".`,
    }
  }

  if (!matchedCommand) {
    return {
      isSlashQuery: true,
      rows: [],
      notice: `No command matches "${SLASH_PREFIX}${parsed.name}".`,
    }
  }

  // `/logout ` — a trailing space is argument mode, but this command has no argument to fill in.
  // Offering the run row keeps a stray keystroke from reading as a dead end.
  if (!takesArgument(matchedCommand)) {
    return { isSlashQuery: true, rows: [toCommandRow(matchedCommand)], notice: null }
  }

  const resolution = matchedCommand.resolve(parsed.argument, context)
  return {
    isSlashQuery: true,
    rows: resolution.rows.map((row) => ({
      id: row.id,
      label: row.label,
      description: row.description,
      kind: 'option',
      commandName: matchedCommand.name,
      value: row.value,
    })),
    notice: resolution.rows.length > 0 ? null : resolution.notice,
  }
}

function tenantLabel(tenant: SessionTenantOption): string {
  return tenant.label?.toString().trim() || tenant.userGroupId
}

export const switchTenantCommand: SlashCommand = {
  name: 'switch-tenant',
  aliases: ['tenant', 'company', 'switch company'],
  description: 'Change the active company for your account.',
  argumentLabel: 'company',
  resolve(argumentQuery, context) {
    if (context.availableTenants.length === 0) {
      return { rows: [], notice: 'This account is not a member of any company yet.' }
    }

    const matched = context.availableTenants.filter(
      (tenant) => matchesText(tenantLabel(tenant), argumentQuery) || matchesText(tenant.userGroupId, argumentQuery),
    )
    // The active company is filtered out rather than shown disabled: switching to it is a no-op, and
    // a row that does nothing on Enter is worse than an explanation.
    const activeMatch = matched.find((tenant) => tenant.userGroupId === context.activeTenantUserGroupId) ?? null
    const rows = matched
      .filter((tenant) => tenant.userGroupId !== context.activeTenantUserGroupId)
      .map((tenant) => ({
        id: `slash-switch-tenant-${tenant.userGroupId}`,
        label: tenantLabel(tenant),
        description: tenant.label?.toString().trim() ? tenant.userGroupId : '',
        value: tenant.userGroupId,
      }))

    if (rows.length > 0) return { rows, notice: null }
    if (activeMatch) return { rows, notice: `Already on ${tenantLabel(activeMatch)}.` }

    const typed = argumentQuery.trim()
    return { rows, notice: typed ? `No company matches "${typed}".` : 'No company is available to switch to.' }
  },
}

/**
 * The three commands the floating user menu used to carry. They are absolute rather than a toggle:
 * `/light` says which theme you want, where the old button only said "the other one".
 */
export const lightThemeCommand: SlashActionCommand = {
  name: 'light',
  aliases: ['light mode', 'day', 'bright'],
  description: 'Show the app in light mode on this browser.',
}

export const darkThemeCommand: SlashActionCommand = {
  name: 'dark',
  aliases: ['dark mode', 'night'],
  description: 'Show the app in dark mode on this browser.',
}

export const logoutCommand: SlashActionCommand = {
  name: 'logout',
  aliases: ['log out', 'sign out', 'signout', 'exit'],
  description: 'End this session and return to sign in.',
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  switchTenantCommand,
  lightThemeCommand,
  darkThemeCommand,
  logoutCommand,
]
