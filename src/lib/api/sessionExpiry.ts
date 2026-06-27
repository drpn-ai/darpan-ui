interface Nav {
  push: (to: unknown) => void
  build: (redirect: string) => unknown
}

/** Passive/clean view → bounce to login keeping the return path (spec §5). */
export function handleAuthExpiry(currentPath: string, nav: Nav): void {
  if (currentPath.startsWith('/login')) return
  nav.push(nav.build(currentPath))
}
