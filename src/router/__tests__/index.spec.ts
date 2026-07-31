import { describe, expect, it } from 'vitest'
import router from '../index'

describe('router release scope', () => {
  const expectedRoutes = [
    { name: 'settings-tenant', path: '/settings/tenant', surfaceMode: 'static', staticPageLabel: 'Tenant Settings' },
    { name: 'settings-ai', path: '/settings/ai', redirect: true },
    { name: 'connections-llm', path: '/connections/llm', redirect: true },
    { name: 'settings-ai-create', path: '/settings/ai/create', redirect: true },
    { name: 'settings-ai-edit', path: '/settings/ai/edit/:llmProvider', redirect: true },
    { name: 'settings-sftp', path: '/settings/sftp', surfaceMode: 'static' },
    { name: 'settings-notifications', path: '/settings/notifications', redirect: true },
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
  ]

  it.each(expectedRoutes)('registers $name at $path', ({ name, path, surfaceMode, staticPageLabel, redirect }) => {
    const route = router.getRoutes().find((record) => record.name === name)

    expect(route?.path).toBe(path)
    if (surfaceMode) expect(route?.meta.surfaceMode).toBe(surfaceMode)
    if (staticPageLabel) expect(route?.meta.staticPageLabel).toBe(staticPageLabel)
    if (redirect) expect(route?.redirect).toBeTruthy()
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
