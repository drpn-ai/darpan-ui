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

/**
 * Copy for the confirmation shown before saving a config other tenants also use.
 * `memberCount` counts the owning tenant plus every peer, so it is never below 1.
 */
export function sharedEditWarning(memberCount: number): string | null {
  if (memberCount <= 1) return null
  return `This configuration is used by ${memberCount} tenants. Changes apply to all of them.`
}

/** Suffix appended to a settings tile for a config shared in from another tenant. */
export function sharedTileSuffix(isShared: boolean, ownerTenantLabel?: string | null): string {
  if (!isShared) return ''
  return ownerTenantLabel ? ` — shared from ${ownerTenantLabel}` : ' — shared'
}
