/// <reference types="vite/client" />

import 'vue-router'

declare global {
  interface ImportMetaEnv {
    readonly VITE_DARPAN_LINEAR_ROADMAP_URL?: string
    readonly VITE_DARPAN_LINEAR_REQUEST_URL?: string
    readonly VITE_DARPAN_LINEAR_EMBED_ENABLED?: string
    /** Optional build version stamped into error reports (see lib/observability/report.ts). */
    readonly VITE_APP_VERSION?: string
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
    surfaceMode?: 'static' | 'workflow'
    /** DAR-UI-074. A static page that uses the whole screen: the shell keeps its padding and drops its width cap. */
    wide?: boolean
    staticPageLabel?: string
    /** A query change keeps the page: the same instance (App's RouterView key) and the same scroll. */
    queryKeepsPage?: boolean
  }
}
