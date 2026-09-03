import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MASCOT_HINTS, hintsFor } from '../mascotHints'

function render(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

describe('hintsFor', () => {
  it('offers a hint only while the control it names is on the page', () => {
    // The whole point of the precondition: a route cannot know whether a conditional
    // control rendered, and a hint for a control that is not there is worse than silence.
    const withCancel = render('<button data-testid="run-result-cancel">Cancel run</button>')
    const withoutCancel = render('<div></div>')

    const offered = hintsFor('reconciliation-run-live', withCancel)
    const withheld = hintsFor('reconciliation-run-live', withoutCancel)

    expect(offered.some((text) => text.includes('Cancel run'))).toBe(true)
    expect(withheld.some((text) => text.includes('Cancel run'))).toBe(false)
  })

  it('always offers a hint that names no control', () => {
    const bare = render('<div></div>')

    expect(hintsFor('reconciliation-run-result', bare).length).toBeGreaterThan(0)
  })

  it('keeps the authored order, so the most likely answer is offered first', () => {
    const host = render(`
      <p data-testid="run-result-live-failed">failed</p>
      <button data-testid="run-result-download">Download</button>
    `)

    const texts = hintsFor('reconciliation-run-result', host)

    expect(texts.indexOf(texts.find((t) => t.includes('step failed')) as string)).toBeLessThan(
      texts.indexOf(texts.find((t) => t.includes('Download')) as string),
    )
  })

  it('stays silent on a route nobody has written hints for', () => {
    expect(hintsFor('settings-sftp-create', document)).toEqual([])
    expect(hintsFor(null, document)).toEqual([])
  })

  it('covers the live run route, which renders the same page under another name', () => {
    // DAR-UI-028 left this empty because every affordance a live run has is conditional.
    // The precondition is what makes it writable at all.
    expect(MASCOT_HINTS['reconciliation-run-live']?.length ?? 0).toBeGreaterThan(0)
  })
})

/**
 * Makes the file's opening promise — "every line describes a gesture that actually
 * exists — checked against the component, not imagined" — mechanical instead of
 * aspirational. A hint naming a control somebody has since deleted fails here rather
 * than reaching a user.
 */
describe('every hint names a control that exists', () => {
  const ROUTER = 'src/router/index.ts'

  function routeComponents(): Record<string, string> {
    const source = readFileSync(ROUTER, 'utf-8')
    const map: Record<string, string> = {}
    for (const block of source.split(/\n {2}\{\n/)) {
      const name = block.match(/name: '([^']+)'/)?.[1]
      const component = block.match(/component: \(\) => import\('([^']+)'\)/)?.[1]
      if (name && component) map[name] = resolve(dirname(ROUTER), component)
    }
    return map
  }

  /** The page plus the components it imports directly — a board or a table frame owns
      plenty of the controls a page's hints talk about. */
  function sourceFor(entry: string): string {
    const page = readFileSync(entry, 'utf-8')
    const imports = Array.from(page.matchAll(/from '([^']+\.vue)'/g))
      .flatMap((match) => (match[1] ? [resolve(dirname(entry), match[1])] : []))
    return [page, ...imports.map((path) => readFileSync(path, 'utf-8'))].join('\n')
  }

  it('finds every "when" testid in the route it belongs to', () => {
    const components = routeComponents()
    const missing: string[] = []

    for (const [routeName, hints] of Object.entries(MASCOT_HINTS)) {
      const entry = components[routeName]
      for (const hint of hints) {
        if (!hint.when) continue
        const testId = hint.when.match(/\[data-testid="([^"]+)"\]/)?.[1]
        expect(testId, `${routeName}: "when" must be a data-testid selector, got ${hint.when}`).toBeTruthy()
        if (!entry) { missing.push(`${routeName}: no component for this route`); continue }
        if (!sourceFor(entry).includes(testId as string)) missing.push(`${routeName}: ${testId}`)
      }
    }

    expect(missing, `hints naming controls that are not in the route's own components: ${missing.join(', ')}`).toEqual([])
  })

  it('is actually reading the components, not passing on an empty sweep', () => {
    // Guards the guard: a broken path resolution above would make the test above pass
    // by checking nothing at all.
    const entry = routeComponents()['reconciliation-run-result']
    expect(entry).toBeTruthy()

    const source = sourceFor(entry as string)
    expect(source).toContain('run-result-cancel')
    expect(source).not.toContain('a-testid-nobody-wrote')
  })
})
