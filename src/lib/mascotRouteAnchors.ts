/**
 * The routes the app has and the `data-testid` anchors each route's own components render.
 *
 * Read from source, not from the running app: the mascot seed generator (`mascotSeed.ts`) and
 * `mascotHints.spec.ts` both need to know which control a hint may be gated on, and a test run
 * has no browser to ask. NEVER imported by app code; it uses node fs and exists for Vitest only.
 *
 * An anchor is a static `data-testid="…"` in the route's page or in a `.vue` / `use*.ts` file the
 * page imports directly, plus a kebab literal where a test id is set by prop or composable
 * (`:primary-test-id="… : 'wizard-next'"`, `primaryTestId: … 'wizard-next'`), because that is how the wizards bind theirs.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ROUTER = 'src/router/index.ts'

/** Route name to `{ path, component }`, read from the router's route records. */
export function routeComponents(): Record<string, { path: string; component: string }> {
  const source = readFileSync(ROUTER, 'utf-8')
  const map: Record<string, { path: string; component: string }> = {}
  for (const block of source.split(/\n {2}\{\n/)) {
    const name = block.match(/name: '([^']+)'/)?.[1]
    const path = block.match(/path: '([^']+)'/)?.[1]
    const component = block.match(/component: \(\) => import\('([^']+)'\)/)?.[1]
    if (name && path && component) map[name] = { path, component: resolve(dirname(ROUTER), component) }
  }
  return map
}

/** The page plus the components and composables it imports directly. */
export function sourceFor(entry: string): string {
  const page = readFileSync(entry, 'utf-8')
  const imports = Array.from(page.matchAll(/from '(\.[^']*(?:\.vue|\/use[A-Za-z]+))'/g)).flatMap((match) => {
    if (!match[1]) return []
    const path = resolve(dirname(entry), match[1])
    return [path.endsWith('.vue') ? path : `${path}.ts`]
  })
  const texts = imports.flatMap((path) => {
    try { return [readFileSync(path, 'utf-8')] } catch { return [] }
  })
  return [page, ...texts].join('\n')
}

export function anchorsIn(source: string): string[] {
  const found = new Set<string>()
  for (const m of source.matchAll(/(?<![:\w-])(?:data-testid|[a-z-]*test-id)="([^"{}$]+)"/g)) if (m[1]) found.add(m[1])
  // A kebab literal only where a test id is being set: `fooTestId: cond ? 'a-b' : 'c-d'`, `const fooTestId = cond ? 'a-b' : 'c-d'`, or a bound `:foo-test-id="…"` / `:data-testid="…"`.
  // Any other quoted word on a line that merely mentions a test id is not an anchor.
  for (const m of source.matchAll(/[A-Za-z]*[Tt]estId\s*[:=]([^,}\n]*)|:(?:data-testid|[a-z-]*test-id)\s*=\s*"([^"]*)"/g)) {
    for (const literal of (m[1] ?? m[2] ?? '').matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/g)) if (literal[1]) found.add(literal[1])
  }
  return [...found].sort()
}

export function routeAnchors(): Record<string, { path: string; anchors: string[] }> {
  const result: Record<string, { path: string; anchors: string[] }> = {}
  for (const [name, { path, component }] of Object.entries(routeComponents())) {
    result[name] = { path, anchors: anchorsIn(sourceFor(component)) }
  }
  return result
}
