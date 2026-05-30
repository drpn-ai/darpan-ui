/// <reference types="vite/client" />

import 'vue-router'

declare global {
  interface ImportMetaEnv {
    readonly VITE_DARPAN_LINEAR_ROADMAP_URL?: string
    readonly VITE_DARPAN_LINEAR_REQUEST_URL?: string
    readonly VITE_DARPAN_LINEAR_EMBED_ENABLED?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiresAuth?: boolean
    requiresReconciliationRun?: boolean
    requiresTenantEdit?: boolean
    reconciliationRunRedirectName?: RouteRecordName
    tenantEditRedirectName?: RouteRecordName
    tenantSwitchRedirectName?: RouteRecordName
    surfaceMode?: 'static' | 'workflow'
    staticPageLabel?: string
    section?: 'roadmap' | 'reconciliation' | 'connections' | 'schemas'
  }
}
