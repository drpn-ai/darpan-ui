/**
 * The key App.vue gives its RouterView. A change remounts the page: switching company reloads every page's data.
 *
 * The sign-in page is the exception (DAR-BE-264). Its two-factor steps finish AFTER the session exists: the code step
 * announces "signed in" once the store holds the new key, and a forced setup still has to show the recovery codes. A
 * key that followed the session there remounted the page mid-flow, Vue dropped the unmounted step's event, and the
 * person was left on a blank sign-in form while already signed in.
 */
export interface RouterViewKeyRoute {
  name?: string | symbol | null | undefined
  path: string
  fullPath: string
  meta?: { queryKeepsPage?: unknown } | Record<string, unknown>
}

export interface RouterViewKeySession {
  activeTenantUserGroupId?: string | null
  scopeType?: string | null
}

export function routerViewKeyFor(route: RouterViewKeyRoute, sessionInfo: RouterViewKeySession | null | undefined): string {
  const page = route.meta?.queryKeepsPage ? route.path : route.fullPath
  if (route.name === 'login') return page
  return `${page}::${sessionInfo?.activeTenantUserGroupId ?? sessionInfo?.scopeType ?? 'anonymous'}`
}
