import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLASH_COMMANDS,
  parseSlashInput,
  resolveSlashResults,
  type SlashCommandContext,
} from '../slashCommands'

const context: SlashCommandContext = {
  availableTenants: [
    { userGroupId: 'ACME_RETAIL', label: 'Acme Retail' },
    { userGroupId: 'GORJANA', label: 'Gorjana' },
    { userGroupId: 'KG_CANADA' },
  ],
  activeTenantUserGroupId: 'GORJANA',
}

const noTenantContext: SlashCommandContext = {
  availableTenants: [],
  activeTenantUserGroupId: null,
}

function resolve(query: string, ctx: SlashCommandContext = context) {
  return resolveSlashResults(query, DEFAULT_SLASH_COMMANDS, ctx)
}

describe('parseSlashInput', () => {
  it('returns null for a query that does not open with a slash', () => {
    expect(parseSlashInput('switch tenant')).toBeNull()
  })

  it('reads a bare slash as an empty name still being typed', () => {
    expect(parseSlashInput('/')).toEqual({ name: '', argument: null })
  })

  it('keeps a name with no trailing space in name mode', () => {
    expect(parseSlashInput('/switch-ten')).toEqual({ name: 'switch-ten', argument: null })
  })

  it('switches to argument mode on the first space, even with nothing after it', () => {
    expect(parseSlashInput('/switch-tenant ')).toEqual({ name: 'switch-tenant', argument: '' })
  })

  it('keeps everything after the first space as the argument', () => {
    expect(parseSlashInput('/switch-tenant acme retail')).toEqual({
      name: 'switch-tenant',
      argument: 'acme retail',
    })
  })
})

describe('resolveSlashResults command mode', () => {
  it('reports a plain search query as not a slash query', () => {
    const resolution = resolve('open ai settings')

    expect(resolution.isSlashQuery).toBe(false)
    expect(resolution.rows).toEqual([])
  })

  it('lists every command for a bare slash', () => {
    const resolution = resolve('/')

    expect(resolution.isSlashQuery).toBe(true)
    expect(resolution.rows.map((row) => row.label)).toEqual(['/switch-tenant'])
    expect(resolution.rows[0]?.kind).toBe('command')
  })

  it('narrows the command list by a partial name', () => {
    expect(resolve('/swi').rows.map((row) => row.label)).toEqual(['/switch-tenant'])
  })

  it('matches a command by alias', () => {
    expect(resolve('/tenant').rows.map((row) => row.label)).toEqual(['/switch-tenant'])
  })

  it('explains an unknown command name instead of listing nothing', () => {
    const resolution = resolve('/deploy')

    expect(resolution.rows).toEqual([])
    expect(resolution.notice).toBe('No command matches "/deploy".')
  })

  it('gives command rows no value so they complete the input rather than run', () => {
    expect(resolve('/swi').rows[0]?.value).toBeNull()
  })
})

describe('resolveSlashResults /switch-tenant argument mode', () => {
  it('lists the tenants this account can switch to once a space is typed', () => {
    const resolution = resolve('/switch-tenant ')

    expect(resolution.rows.map((row) => row.label)).toEqual(['Acme Retail', 'KG_CANADA'])
    expect(resolution.notice).toBeNull()
  })

  it('carries the tenant userGroupId as the row value', () => {
    const resolution = resolve('/switch-tenant acme')

    expect(resolution.rows).toHaveLength(1)
    expect(resolution.rows[0]?.kind).toBe('option')
    expect(resolution.rows[0]?.value).toBe('ACME_RETAIL')
  })

  it('matches a tenant by userGroupId when it carries no label', () => {
    expect(resolve('/switch-tenant kg_can').rows.map((row) => row.value)).toEqual(['KG_CANADA'])
  })

  it('leaves out the tenant already in use and says so when it is the only match', () => {
    const resolution = resolve('/switch-tenant gorjana')

    expect(resolution.rows).toEqual([])
    expect(resolution.notice).toBe('Already on Gorjana.')
  })

  it('says nothing matched when the argument matches no tenant', () => {
    const resolution = resolve('/switch-tenant zzz')

    expect(resolution.rows).toEqual([])
    expect(resolution.notice).toBe('No company matches "zzz".')
  })

  it('explains missing membership rather than showing an empty list', () => {
    const resolution = resolve('/switch-tenant ', noTenantContext)

    expect(resolution.rows).toEqual([])
    expect(resolution.notice).toBe('This account is not a member of any company yet.')
  })
})
