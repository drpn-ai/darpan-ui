import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'
import router, { routes } from '../index'

describe('router release scope', () => {
  const expectedRoutes = [
    { name: 'cli-login', path: '/cli-login', surfaceMode: 'static', staticPageLabel: 'Approve CLI' },
    { name: 'settings-tenant', path: '/settings/tenant', surfaceMode: 'static', staticPageLabel: 'Tenant Settings' },
    { name: 'settings-ai', path: '/settings/ai', redirect: true },
    { name: 'connections-llm', path: '/connections/llm', redirect: true },
    { name: 'settings-ai-create', path: '/settings/ai/create', redirect: true },
    { name: 'settings-ai-edit', path: '/settings/ai/edit/:llmProvider', redirect: true },
    { name: 'settings-sftp', path: '/settings/sftp', surfaceMode: 'static' },
    { name: 'settings-notifications', path: '/settings/notifications', surfaceMode: 'static', staticPageLabel: 'Notifications' },
    { name: 'settings', path: '/settings', redirect: true },
    { name: 'connections-notifications', path: '/connections/notifications', redirect: true },
    { name: 'settings-sftp-create', path: '/settings/sftp/create', surfaceMode: 'workflow' },
    { name: 'settings-sftp-edit', path: '/settings/sftp/edit/:sftpServerId', surfaceMode: 'workflow' },
    { name: 'settings-netsuite', path: '/settings/netsuite', surfaceMode: 'static', staticPageLabel: 'NetSuite' },
    { name: 'settings-shopify', path: '/settings/shopify', surfaceMode: 'static', staticPageLabel: 'Shopify' },
    { name: 'settings-shopify-auth', path: '/settings/shopify/auth/:shopifyAuthConfigId', surfaceMode: 'static', staticPageLabel: 'Shopify' },
    { name: 'settings-shopify-create', path: '/settings/shopify/create', surfaceMode: 'workflow' },
    { name: 'settings-shopify-edit', path: '/settings/shopify/edit/:shopifyAuthConfigId', surfaceMode: 'workflow' },
    { name: 'connections-hotwax', path: '/connections/hotwax', redirect: true },
    { name: 'settings-oms-legacy', path: '/settings/oms', redirect: true },
    { name: 'settings-oms-auth-legacy', path: '/settings/oms/auth/:omsRestSourceConfigId', redirect: true },
    { name: 'settings-oms-create-legacy', path: '/settings/oms/create', redirect: true },
    { name: 'settings-oms-edit-legacy', path: '/settings/oms/edit/:omsRestSourceConfigId', redirect: true },
    { name: 'settings-oms', path: '/settings/hotwax', surfaceMode: 'static', staticPageLabel: 'HotWax' },
    { name: 'settings-oms-auth', path: '/settings/hotwax/auth/:omsRestSourceConfigId', surfaceMode: 'static', staticPageLabel: 'HotWax' },
    { name: 'settings-oms-create', path: '/settings/hotwax/create', surfaceMode: 'workflow' },
    { name: 'settings-oms-edit', path: '/settings/hotwax/edit/:omsRestSourceConfigId', surfaceMode: 'workflow' },
    { name: 'settings-runs', path: '/settings/runs', surfaceMode: 'static', staticPageLabel: 'Run Editor' },
    { name: 'connections-runs', path: '/connections/runs', redirect: true },
    { name: 'settings-runs-edit', path: '/settings/runs/edit/:reconciliationMappingId', surfaceMode: 'workflow' },
    { name: 'connections-netsuite', path: '/connections/netsuite', redirect: true },
    { name: 'settings-netsuite-auth-create', path: '/settings/netsuite/auth/create', surfaceMode: 'workflow' },
    { name: 'settings-netsuite-auth-edit', path: '/settings/netsuite/auth/edit/:nsAuthConfigId', surfaceMode: 'workflow' },
    { name: 'settings-netsuite-endpoints-create', path: '/settings/netsuite/endpoints/create', surfaceMode: 'workflow' },
    { name: 'settings-netsuite-endpoints-edit', path: '/settings/netsuite/endpoints/edit/:nsRestletConfigId', surfaceMode: 'workflow' },
    { name: 'reconciliation-automation-create', path: '/reconciliation/automation/create', surfaceMode: 'workflow' },
    { name: 'reconciliation-create', path: '/reconciliation/create', surfaceMode: 'workflow' },
    { name: 'reconciliation-ruleset-manager', path: '/reconciliation/ruleset-manager', surfaceMode: 'static', staticPageLabel: 'Ruleset Manager' },
    { name: 'reconciliation-ruleset-editor', path: '/reconciliation/ruleset-manager/rules', surfaceMode: 'workflow' },
    { name: 'reconciliation-automation-dashboard', path: '/reconciliation/automations/:automationId', surfaceMode: 'static', staticPageLabel: 'Automation' },
    { name: 'reconciliation-diff', path: '/reconciliation/diff', surfaceMode: 'workflow' },
    { name: 'reconciliation-run-result', path: '/reconciliation/run-result/:savedRunId/:outputFileName', surfaceMode: 'static' },
    { name: 'reconciliation-run-live', path: '/reconciliation/run-live/:savedRunId/:runResultId', surfaceMode: 'static', staticPageLabel: 'Run Progress' },
    { name: 'reconciliation-run-history', path: '/reconciliation/run-history/:savedRunId', surfaceMode: 'static' },
    { name: 'hub', path: '/', surfaceMode: 'static' },
    { name: 'audit-report', path: '/audits/:audit', surfaceMode: 'static', staticPageLabel: 'Audit' },
    { name: 'audit-run-start', path: '/audits/:audit/run', surfaceMode: 'workflow' },
    { name: 'audit-settings', path: '/audits/:audit/settings', surfaceMode: 'static', staticPageLabel: 'Audit settings' },
    // DAR-UI-138. Queries are top level; the names stay (the mascot hints are keyed on them).
    { name: 'settings-tenant-scripts', path: '/queries', surfaceMode: 'static', staticPageLabel: 'Queries' },
    { name: 'settings-tenant-script-new', path: '/queries/new', surfaceMode: 'static', staticPageLabel: 'Query' },
    { name: 'settings-tenant-script', path: '/queries/:tenantScriptId', surfaceMode: 'static', staticPageLabel: 'Query' },
    { name: 'settings-tenant-scripts-legacy', path: '/settings/tenant/scripts', redirect: true },
    { name: 'settings-tenant-script-new-legacy', path: '/settings/tenant/scripts/new', redirect: true },
    { name: 'settings-tenant-script-legacy', path: '/settings/tenant/scripts/:tenantScriptId', redirect: true },
  ]

  it.each(expectedRoutes)('registers $name at $path', ({ name, path, surfaceMode, staticPageLabel, redirect }) => {
    const route = router.getRoutes().find((record) => record.name === name)

    expect(route?.path).toBe(path)
    if (surfaceMode) expect(route?.meta.surfaceMode).toBe(surfaceMode)
    if (staticPageLabel) expect(route?.meta.staticPageLabel).toBe(staticPageLabel)
    if (redirect) expect(route?.redirect).toBeTruthy()
  })

  // DAR-UI-123. The Slack OAuth callback returns to /settings?slack=...; it lands on Notifications with its result.
  it('lands the Slack callback on Notifications and a bare /settings on Tenant Settings', () => {
    const redirect = router.getRoutes().find((record) => record.name === 'settings')?.redirect as (to: RouteLocationNormalized) => unknown
    expect(redirect(router.resolve('/settings?slack=connected&team=Acme') as RouteLocationNormalized)).toEqual({
      name: 'settings-notifications',
      query: { slack: 'connected', team: 'Acme' },
    })
    expect(redirect(router.resolve('/settings') as RouteLocationNormalized)).toEqual({ name: 'settings-tenant' })
    expect(router.getRoutes().find((record) => record.name === 'connections-notifications')?.redirect).toEqual({ name: 'settings-notifications' })
  })

  // DAR-UI-138. /queries/new is a new query, not one with the id "new".
  it('resolves /queries/new before the query id route', () => {
    expect(router.resolve('/queries/new').name).toBe('settings-tenant-script-new')
    const one = router.resolve('/queries/100')
    expect(one.name).toBe('settings-tenant-script')
    expect(one.params.tenantScriptId).toBe('100')
  })

  // DAR-UI-138. Old Tenant Settings links land on the same query under /queries, with their query string.
  it.each([
    ['/settings/tenant/scripts?tab=runs#top', '/queries?tab=runs#top', 'settings-tenant-scripts'],
    ['/settings/tenant/scripts/new?from=chat', '/queries/new?from=chat', 'settings-tenant-script-new'],
    ['/settings/tenant/scripts/100?run=7', '/queries/100?run=7', 'settings-tenant-script'],
  ])('redirects %s to %s', async (from, to, name) => {
    const testRouter = createRouter({ history: createMemoryHistory(), routes })
    await testRouter.push(from)
    expect(testRouter.currentRoute.value.fullPath).toBe(to)
    expect(testRouter.currentRoute.value.name).toBe(name)
    expect(testRouter.currentRoute.value.redirectedFrom?.fullPath).toBe(from)
  })

  // DAR-UI-074. The audit board takes the whole screen; its settings and run pages keep the static width.
  it('marks only the audit board wide', () => {
    expect(router.resolve('/audits/month-close').meta.wide).toBe(true)
    expect(router.resolve('/audits/month-close/settings').meta.wide).toBeUndefined()
  })

  // DAR-UI-063. The audit's play and settings change things, so they need edit access, as a lifecycle's do.
  it.each(['audit-run-start', 'audit-settings'])('%s resolves past the audit page and needs tenant edit access', (name) => {
    const suffix = name === 'audit-run-start' ? 'run' : 'settings'
    const resolved = router.resolve(`/audits/month-close/${suffix}`)
    expect(resolved.name).toBe(name)
    expect(resolved.params.audit).toBe('month-close')
    expect(resolved.meta.requiresTenantEdit).toBe(true)
    expect(resolved.meta.tenantEditRedirectName).toBe('settings-runs')
  })

  // DAR-UI-068. Each column pick on the audit page changes only the query; the page stays where it was.
  it('keeps the scroll on a query-only change of the audit page, and goes to the top otherwise', () => {
    const scroll = router.options.scrollBehavior!
    const at = (path: string) => router.resolve(path) as unknown as RouteLocationNormalized
    const from = at('/audits/month-close?category=returns')
    expect(scroll(at('/audits/month-close?category=returns&statement=R8'), from, null)).toBe(false)
    expect(scroll(at('/audits/other'), from, null)).toEqual({ top: 0 })
    expect(scroll(from, at('/'), null)).toEqual({ top: 0 })
    expect(scroll(at('/reconciliation/diff?step=2'), at('/reconciliation/diff'), null)).toEqual({ top: 0 })
  })

  it.each([
    'reconciliation-results',
    'roadmap-reconciliation-create-ruleset',
    'connections-read-db',
  ])('does not register removed route %s', (name) => {
    const route = router.getRoutes().find((record) => record.name === name)

    expect(route).toBeUndefined()
  })
})
