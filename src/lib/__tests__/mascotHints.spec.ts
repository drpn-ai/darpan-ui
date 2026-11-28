import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { MASCOT_HINTS, hintsFor } from '../mascotHints'
import { routeComponents as realRouteComponents, sourceFor } from '../mascotRouteAnchors'

function render(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

// S99-108: two run-result lines said what the page does not show.
describe('run result lines', () => {
  const textOf = (route: string, id: string) => MASCOT_HINTS[route]?.find((hint) => hint.id === id)?.text ?? ''

  it('does not blame a step for a failed run: a run whose rules did not evaluate fails no step', () => {
    for (const route of ['reconciliation-run-result', 'reconciliation-run-live']) {
      expect(textOf(route, 'run-result-live-failed'), route).toMatch(/run failed/)
      expect(textOf(route, 'run-result-live-failed'), route).not.toMatch(/step/i)
    }
  })

  it('says All counts the missing records with the rest, never that they are counted apart', () => {
    const text = textOf('reconciliation-run-result', 'differences-missing-records-counted')
    expect(text).toMatch(/^All counts/)
    expect(text).toMatch(/missing/)
    expect(text).not.toMatch(/separately/)
  })
})

describe('hint ids', () => {
  it('hintIdsAreUniqueAndStable', () => {
    for (const [route, hints] of Object.entries(MASCOT_HINTS)) {
      const ids = hints.map((hint) => hint.id)
      for (const id of ids) expect(id, `${route}: ${id}`).toMatch(/^[a-z0-9-]{2,40}$/)
      expect(new Set(ids).size, `${route} has a duplicate hint id`).toBe(ids.length)
    }
  })
})

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
  const routeComponents = () => Object.fromEntries(Object.entries(realRouteComponents()).map(([k, v]) => [k, v.component]))

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

  it('follows a same-folder composable (./useX), not only ../../composables ones', () => {
    // DAR-OPS-029 U11: the import pattern needed a character between '.' and '/use', so a page's './useX' was never
    // read (the connection wizards' wizard-next anchor sits behind './useConnectionWorkflow').
    const entry = routeComponents()['settings-shopify-auth']
    expect(entry).toBeTruthy()
    expect(sourceFor(entry as string)).toContain('export function useConnectionDiagnostics')
  })
})

/**
 * The route-component guard above is a SUBSTRING check, and that is a real hole for one
 * testid in particular. `wizard-next` is bound at runtime from useWorkflowStepMachine
 * (`primaryTestId`), but the literal also appears in WorkflowStepForm.vue as a CSS class
 * — so the guard passes on the class even if the binding is renamed and the six settings
 * create hints gated on it go silently dead. Nothing else would notice.
 *
 * This renders the control instead of reading for it, and pins both halves of the split:
 * a mid-wizard step offers the create line, a save step offers the edit line and NOT the
 * create one. That is what makes two routes over one component honest.
 */
describe('the settings wizard gates its hints on a control that really renders', () => {
  function mountStep(primaryTestId: string, primaryActionVariant: 'default' | 'save') {
    return mount(WorkflowStepForm, {
      props: { question: 'Host', primaryTestId, primaryActionVariant, showPrimaryAction: true, primaryLabel: 'OK' },
      attachTo: document.body,
    })
  }

  it('offers the mid-wizard line only while a step before the last is on screen', () => {
    const step = mountStep('wizard-next', 'default')

    expect(step.find('[data-testid="wizard-next"]').exists(), 'wizard-next is not a real testid any more').toBe(true)
    expect(hintsFor('settings-oms-create', document).length).toBeGreaterThan(0)

    step.unmount()
  })

  it('switches to the edit line on a save step, and drops the create one', () => {
    const step = mountStep('save-oms-rest-source', 'save')

    expect(hintsFor('settings-oms-create', document)).toEqual([])
    expect(hintsFor('settings-oms-edit', document).length).toBeGreaterThan(0)

    step.unmount()
  })
})
