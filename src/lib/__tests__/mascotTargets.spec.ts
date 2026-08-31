import { describe, expect, it } from 'vitest'
import { resolveExplainTarget } from '../mascotTargets'
import { formatDateTime } from '../utils/date'

function render(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

/**
 * A bare <td> inside a <div> is dropped by the HTML parser, so querySelector finds
 * nothing and every assertion about it passes for the wrong reason. Cells must be
 * rendered inside a real table.
 */
function renderCell(inner: string): HTMLElement {
  const host = render(`<table><tbody><tr><td>${inner}</td></tr></tbody></table>`)
  return host.querySelector('td') as HTMLElement
}

describe('resolveExplainTarget', () => {
  it('recognises a label by its text, with no markup of its own', () => {
    const host = render('<dl><dt class="micro-label">Schedule</dt><dd>Daily</dd></dl>')

    const target = resolveExplainTarget(host.querySelector('dt'))

    expect(target?.term).toBe('automationSchedule')
  })

  it('reads a table header through the span it renders into', () => {
    const host = render('<table><thead><tr><th><span>Differences</span></th></tr></thead></table>')

    // The pointer lands on the span, not the th — resolution has to walk up.
    const target = resolveExplainTarget(host.querySelector('th span'))

    expect(target?.term).toBe('differenceCount')
    expect(target?.el.tagName).toBe('TH')
  })

  it('ignores case, trailing colons and stray whitespace', () => {
    const host = render('<dt class="micro-label">  RULE SET :  </dt>')

    expect(resolveExplainTarget(host.querySelector('dt'))?.term).toBe('ruleSet')
  })

  it('stays silent on a label it has no phrase for', () => {
    // Silence is the right answer for an unknown heading. Guessing would produce a
    // confident wrong explanation, which is worse than no explanation.
    const host = render('<dt class="micro-label">Automation ID</dt>')

    expect(resolveExplainTarget(host.querySelector('dt'))).toBeNull()
  })

  it('recognises a timestamp in the exact shape the app renders', () => {
    const rendered = formatDateTime('2026-05-02T06:00:00.000Z', { locale: 'en-US', timeZone: 'Asia/Kolkata' })
    const cell = renderCell(rendered)

    const target = resolveExplainTarget(cell)

    expect(target?.term).toBe('timestamp')
    expect(target?.detail).toBeTruthy()
  })

  it('resolves the zone at the displayed instant rather than at "now"', () => {
    // Parsed back from the rendered text, so a summer and a winter timestamp answer
    // with different codes instead of both reporting whatever today happens to be.
    const summer = renderCell(formatDateTime('2026-08-02T06:00:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }))
    const winter = renderCell(formatDateTime('2026-01-02T06:00:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }))

    expect(resolveExplainTarget(summer)?.detail).toBeTruthy()
    expect(resolveExplainTarget(winter)?.detail).toBeTruthy()
  })

  it('does not mistake an id or a bare number for a timestamp', () => {
    for (const text of ['#SM-40318', '4,182', '2026', 'May 2', 'fulfilled']) {
      const cell = renderCell(text)
      expect(cell, `cell for ${text} must exist or the assertion is vacuous`).toBeTruthy()
      expect(resolveExplainTarget(cell), text).toBeNull()
    }
  })

  it('answers nothing for an element that is neither a label nor a value', () => {
    const host = render('<p>Some prose about differences.</p>')

    expect(resolveExplainTarget(host.querySelector('p'))).toBeNull()
  })
})
