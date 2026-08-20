/**
 * DAR-BE-005 — the four API source config types that support cross-tenant sharing.
 * Mirrors SharedConfigAccessSupport.CONFIG_TYPE_REGISTRY on the backend; keep them in step.
 */
export const SHARED_CONFIG_TYPES = {
  hotwaxOms: 'SCFG_HOTWAX_OMS',
  shopifyAuth: 'SCFG_SHOPIFY_AUTH',
  netSuiteAuth: 'SCFG_NS_AUTH',
  netSuiteRestlet: 'SCFG_NS_RESTLET',
} as const

export type SharedConfigType = (typeof SHARED_CONFIG_TYPES)[keyof typeof SHARED_CONFIG_TYPES]
