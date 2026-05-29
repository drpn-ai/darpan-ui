import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { buildAuthRedirect, useAuthStore } from '../stores/auth'
import { usePermissionsStore } from '../stores/permissions'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'hub',
    component: () => import('../pages/HomePage.vue'),
    meta: { requiresAuth: true, surfaceMode: 'static', staticPageLabel: 'Dashboard' },
  },
  {
    path: '/roadmap/reconciliation',
    name: 'roadmap-reconciliation',
    component: () => import('../pages/ReconciliationPlaceholderPage.vue'),
    meta: { requiresAuth: true, section: 'roadmap', staticPageLabel: 'Reconciliation Roadmap' },
  },
  {
    path: '/reconciliation/diff',
    name: 'reconciliation-diff',
    component: () => import('../pages/reconciliation/ReconciliationDiffPage.vue'),
    meta: { requiresAuth: true, requiresReconciliationRun: true, reconciliationRunRedirectName: 'settings-runs', tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'workflow' },
  },
  {
    path: '/reconciliation/run-result/:savedRunId/:outputFileName',
    name: 'reconciliation-run-result',
    component: () => import('../pages/reconciliation/ReconciliationRunResultPage.vue'),
    meta: { requiresAuth: true, tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'static', staticPageLabel: 'Run Result' },
  },
  {
    path: '/reconciliation/automation/create',
    name: 'reconciliation-automation-create',
    component: () => import('../pages/reconciliation/ReconciliationAutomationWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'reconciliation-automations', tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'workflow' },
  },
  {
    path: '/reconciliation/create',
    name: 'reconciliation-create',
    component: () => import('../pages/reconciliation/ReconciliationCreateFlowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-runs', tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'workflow' },
  },
  {
    path: '/reconciliation/ruleset-manager',
    name: 'reconciliation-ruleset-manager',
    component: () => import('../pages/reconciliation/ReconciliationRuleSetManagerPage.vue'),
    meta: { requiresAuth: true, section: 'reconciliation', surfaceMode: 'static', staticPageLabel: 'Ruleset Manager' },
  },
  {
    path: '/reconciliation/automations',
    name: 'reconciliation-automations',
    component: () => import('../pages/reconciliation/ReconciliationAutomationsPage.vue'),
    meta: { requiresAuth: true, section: 'reconciliation', surfaceMode: 'static', staticPageLabel: 'Automations' },
  },
  {
    path: '/reconciliation/automations/create',
    redirect: { name: 'reconciliation-automation-create' },
  },
  {
    path: '/reconciliation/automations/edit/:automationId',
    name: 'reconciliation-automation-edit',
    component: () => import('../pages/reconciliation/ReconciliationAutomationWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'reconciliation-automations', tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'workflow' },
  },
  {
    path: '/reconciliation/automations/:automationId',
    name: 'reconciliation-automation-dashboard',
    component: () => import('../pages/reconciliation/ReconciliationAutomationDashboardPage.vue'),
    meta: { requiresAuth: true, section: 'reconciliation', surfaceMode: 'static', staticPageLabel: 'Automation' },
  },
  {
    path: '/reconciliation/automations/:automationId/history',
    redirect: (to) => ({
      name: 'reconciliation-automation-dashboard',
      params: { automationId: to.params.automationId },
      query: to.query,
    }),
  },
  {
    path: '/reconciliation/ruleset-manager/rules',
    name: 'reconciliation-ruleset-editor',
    component: () => import('../pages/reconciliation/ReconciliationRuleSetEditorPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-runs', tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'workflow' },
  },
  {
    path: '/reconciliation/run-history/:savedRunId',
    name: 'reconciliation-run-history',
    component: () => import('../pages/reconciliation/ReconciliationRunHistoryPage.vue'),
    meta: { requiresAuth: true, tenantSwitchRedirectName: 'hub', section: 'reconciliation', surfaceMode: 'static', staticPageLabel: 'Run History' },
  },
  {
    path: '/connections',
    redirect: { name: 'settings-tenant' },
  },
  {
    path: '/connections/llm',
    name: 'connections-llm',
    redirect: { name: 'settings-tenant' },
  },
  {
    path: '/connections/sftp',
    name: 'connections-sftp',
    redirect: (to) => {
      if (String(to.query.focus ?? '') === 'create') {
        return { name: 'settings-sftp-create' }
      }
      return { name: 'settings-sftp' }
    },
  },
  {
    path: '/connections/notifications',
    name: 'connections-notifications',
    redirect: { name: 'settings-tenant', query: { workflow: 'notifications' } },
  },
  {
    path: '/connections/netsuite/auth',
    name: 'connections-netsuite-auth',
    redirect: { name: 'settings-netsuite' },
  },
  {
    path: '/connections/netsuite/endpoints',
    name: 'connections-netsuite-endpoints',
    redirect: { name: 'settings-netsuite' },
  },
  {
    path: '/connections/netsuite',
    name: 'connections-netsuite',
    redirect: { name: 'settings-netsuite' },
  },
  {
    path: '/connections/shopify',
    name: 'connections-shopify',
    redirect: { name: 'settings-shopify' },
  },
  {
    path: '/connections/hotwax',
    name: 'connections-hotwax',
    redirect: { name: 'settings-oms' },
  },
  {
    path: '/connections/oms',
    name: 'connections-oms',
    redirect: { name: 'settings-oms' },
  },
  {
    path: '/connections/runs',
    name: 'connections-runs',
    redirect: { name: 'settings-runs' },
  },
  {
    path: '/settings/tenant',
    name: 'settings-tenant',
    component: () => import('../pages/settings/TenantSettingsPage.vue'),
    meta: { requiresAuth: true, section: 'connections', surfaceMode: 'static', staticPageLabel: 'Tenant Settings' },
  },
  {
    path: '/settings/ai',
    name: 'settings-ai',
    redirect: { name: 'settings-tenant' },
  },
  {
    path: '/settings/ai/create',
    name: 'settings-ai-create',
    redirect: { name: 'settings-tenant', query: { workflow: 'ai-create' } },
  },
  {
    path: '/settings/ai/edit/:llmProvider',
    name: 'settings-ai-edit',
    redirect: (to) => ({
      name: 'settings-tenant',
      query: {
        workflow: 'ai-edit',
        llmProvider: String(to.params.llmProvider ?? ''),
      },
    }),
  },
  {
    path: '/settings/netsuite',
    name: 'settings-netsuite',
    component: () => import('../pages/settings/NetSuiteSettingsPage.vue'),
    meta: { requiresAuth: true, section: 'connections', surfaceMode: 'static', staticPageLabel: 'NetSuite' },
  },
  {
    path: '/settings/shopify',
    name: 'settings-shopify',
    component: () => import('../pages/settings/ShopifySettingsPage.vue'),
    meta: { requiresAuth: true, section: 'connections', surfaceMode: 'static', staticPageLabel: 'Shopify' },
  },
  {
    path: '/settings/shopify/auth/:shopifyAuthConfigId',
    name: 'settings-shopify-auth',
    component: () => import('../pages/settings/ShopifyAuthDashboardPage.vue'),
    props: true,
    meta: { requiresAuth: true, tenantSwitchRedirectName: 'settings-shopify', section: 'connections', surfaceMode: 'static', staticPageLabel: 'Shopify' },
  },
  {
    path: '/settings/shopify/create',
    name: 'settings-shopify-create',
    component: () => import('../pages/settings/ShopifyAuthWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-shopify', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/shopify/edit/:shopifyAuthConfigId',
    name: 'settings-shopify-edit',
    component: () => import('../pages/settings/ShopifyAuthWorkflowPage.vue'),
    props: true,
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-shopify', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/oms',
    name: 'settings-oms-legacy',
    redirect: { name: 'settings-oms' },
  },
  {
    path: '/settings/oms/auth/:omsRestSourceConfigId',
    name: 'settings-oms-auth-legacy',
    redirect: (to) => ({
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: to.params.omsRestSourceConfigId },
      query: to.query,
      hash: to.hash,
    }),
  },
  {
    path: '/settings/oms/create',
    name: 'settings-oms-create-legacy',
    redirect: (to) => ({
      name: 'settings-oms-create',
      query: to.query,
      hash: to.hash,
    }),
  },
  {
    path: '/settings/oms/edit/:omsRestSourceConfigId',
    name: 'settings-oms-edit-legacy',
    redirect: (to) => ({
      name: 'settings-oms-edit',
      params: { omsRestSourceConfigId: to.params.omsRestSourceConfigId },
      query: to.query,
      hash: to.hash,
    }),
  },
  {
    path: '/settings/hotwax',
    name: 'settings-oms',
    component: () => import('../pages/settings/OmsRestSettingsPage.vue'),
    meta: { requiresAuth: true, section: 'connections', surfaceMode: 'static', staticPageLabel: 'HotWax' },
  },
  {
    path: '/settings/hotwax/auth/:omsRestSourceConfigId',
    name: 'settings-oms-auth',
    component: () => import('../pages/settings/OmsRestSourceDashboardPage.vue'),
    props: true,
    meta: { requiresAuth: true, tenantSwitchRedirectName: 'settings-oms', section: 'connections', surfaceMode: 'static', staticPageLabel: 'HotWax' },
  },
  {
    path: '/settings/hotwax/create',
    name: 'settings-oms-create',
    component: () => import('../pages/settings/OmsRestSourceWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-oms', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/hotwax/edit/:omsRestSourceConfigId',
    name: 'settings-oms-edit',
    component: () => import('../pages/settings/OmsRestSourceWorkflowPage.vue'),
    props: true,
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-oms', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/runs',
    name: 'settings-runs',
    component: () => import('../pages/settings/RunsSettingsPage.vue'),
    meta: { requiresAuth: true, section: 'connections', surfaceMode: 'static', staticPageLabel: 'Run Editor' },
  },
  {
    path: '/settings/user',
    name: 'settings-user',
    component: () => import('../pages/settings/UserSettingsPage.vue'),
    meta: { requiresAuth: true, surfaceMode: 'static', staticPageLabel: 'User Settings' },
  },
  {
    path: '/settings/runs/edit/:reconciliationMappingId',
    name: 'settings-runs-edit',
    component: () => import('../pages/settings/RunsSettingsWorkflowPage.vue'),
    props: true,
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-runs', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/sftp',
    name: 'settings-sftp',
    component: () => import('../pages/settings/SftpServersPage.vue'),
    meta: { requiresAuth: true, section: 'connections', surfaceMode: 'static', staticPageLabel: 'SFTP Servers' },
  },
  {
    path: '/settings/notifications',
    name: 'settings-notifications',
    redirect: { name: 'settings-tenant', query: { workflow: 'notifications' } },
  },
  {
    path: '/settings/sftp/create',
    name: 'settings-sftp-create',
    component: () => import('../pages/settings/SftpServerWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-sftp', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/sftp/edit/:sftpServerId',
    name: 'settings-sftp-edit',
    component: () => import('../pages/settings/SftpServerWorkflowPage.vue'),
    props: true,
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-sftp', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/netsuite/auth/create',
    name: 'settings-netsuite-auth-create',
    component: () => import('../pages/settings/NetSuiteAuthWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-netsuite', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/netsuite/auth/edit/:nsAuthConfigId',
    name: 'settings-netsuite-auth-edit',
    component: () => import('../pages/settings/NetSuiteAuthWorkflowPage.vue'),
    props: true,
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-netsuite', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/netsuite/endpoints/create',
    name: 'settings-netsuite-endpoints-create',
    component: () => import('../pages/settings/NetSuiteEndpointWorkflowPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-netsuite', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/settings/netsuite/endpoints/edit/:nsRestletConfigId',
    name: 'settings-netsuite-endpoints-edit',
    component: () => import('../pages/settings/NetSuiteEndpointWorkflowPage.vue'),
    props: true,
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'settings-netsuite', tenantSwitchRedirectName: 'hub', section: 'connections', surfaceMode: 'workflow' },
  },
  {
    path: '/schemas',
    redirect: { name: 'schemas-library' },
  },
  {
    path: '/schemas/library',
    name: 'schemas-library',
    component: () => import('../pages/jsonschema/JsonSchemaBrowsePage.vue'),
    meta: { requiresAuth: true, section: 'schemas', surfaceMode: 'static', staticPageLabel: 'Schema Library' },
  },
  {
    path: '/schemas/create',
    name: 'schemas-create',
    component: () => import('../pages/jsonschema/JsonSchemaWizardPage.vue'),
    meta: { requiresAuth: true, requiresTenantEdit: true, tenantEditRedirectName: 'schemas-library', tenantSwitchRedirectName: 'hub', section: 'schemas', surfaceMode: 'workflow' },
  },
  {
    path: '/schemas/infer',
    redirect: { name: 'schemas-create' },
  },
  {
    path: '/schemas/editor/:jsonSchemaId?',
    name: 'schemas-editor',
    component: () => import('../pages/jsonschema/JsonSchemaEditorPage.vue'),
    props: true,
    meta: { requiresAuth: true, tenantSwitchRedirectName: 'hub', section: 'schemas', surfaceMode: 'static', staticPageLabel: 'Schema Editor' },
  },
  {
    path: '/schemas/edit/:jsonSchemaId',
    redirect: (to) => ({
      name: 'schemas-editor',
      params: {
        jsonSchemaId: to.params.jsonSchemaId,
      },
    }),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'hub' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (to.meta.public === true) return true
  if (to.meta.requiresAuth !== true) return true

  const authStore = useAuthStore()
  const authenticated = await authStore.ensureAuthenticated(true)
  if (authenticated) {
    const permissions = usePermissionsStore()
    if (to.meta.requiresGlobalSettings === true && !permissions.canManageGlobalSettings) {
      return { name: 'hub' }
    }

    // AI provider settings workflow is a global-admin surface; gate it on the destination route
    // because the source routes (settings-ai-create / settings-ai-edit) are redirect-only and Vue
    // Router skips beforeEnter on redirect routes. Without this check, the only gate was an
    // in-page string check in TenantSettingsPage, which a redirect chain bypasses for a moment.
    if (
      to.name === 'settings-tenant' &&
      typeof to.query.workflow === 'string' &&
      (to.query.workflow === 'ai-create' || to.query.workflow === 'ai-edit') &&
      !permissions.canManageGlobalSettings
    ) {
      return { name: 'settings-tenant' }
    }

    if (to.meta.requiresReconciliationRun === true && !permissions.canRunActiveTenantReconciliation) {
      return { name: to.meta.reconciliationRunRedirectName ?? 'hub' }
    }

    if (to.meta.requiresTenantEdit === true && !permissions.canEditTenantSettings) {
      return { name: to.meta.tenantEditRedirectName ?? 'hub' }
    }

    return true
  }
  return buildAuthRedirect(to.fullPath)
})

export default router
