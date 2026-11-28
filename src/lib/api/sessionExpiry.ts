interface Nav {
  push: (to: unknown) => void
  build: (redirect: string) => unknown
}

/** A session that ended sends the page to sign-in, keeping where it was as the redirect; the sign-in page stays put. */
export function handleAuthExpiry(currentPath: string, nav: Nav): void {
  if (currentPath.startsWith('/login')) return
  nav.push(nav.build(currentPath))
}
