import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'
import { MASCOT_ACTIONS, lookupAction } from '../mascotActions'
import { resolveExplainTarget } from '../mascotTargets'

function render(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

describe('explaining a control', () => {
  it('answers an icon button through the name a screen reader would announce', () => {
    const host = render('<button type="button" aria-label="Run ruleset"><svg></svg></button>')

    expect(resolveExplainTarget(host.querySelector('svg'))?.term).toBe('run ruleset')
  })

  it('answers a text button by what it says', () => {
    const host = render('<button type="button">Stop run</button>')

    expect(resolveExplainTarget(host.querySelector('button'))?.term).toBe('stop run')
  })

  it('names a list tile by its title, not by the tenant data beside it', () => {
    // "Timezone Asia/Kolkata" is a name plus a value. Taking the whole text would make
    // every tile unique to its own data and so permanently unexplainable.
    const host = render(`
      <button type="button" class="static-page-list-tile">
        <span class="static-page-tile-title static-page-list-tile__title">Timezone</span>
        <span class="tenant-settings-list-status">Asia/Kolkata</span>
      </button>
    `)

    expect(resolveExplainTarget(host.querySelector('button'))?.term).toBe('timezone')
  })

  it('lets a label inside a button keep its own answer', () => {
    // The rule-set manager's System card is a button wrapping a label. The value's own
    // explanation is the better answer there, and the button must not swallow it.
    const host = render(`
      <button type="button" class="ruleset-manager-basic-card">
        <span class="static-page-summary-label">System</span>
        <span>Shopify</span>
      </button>
    `)

    expect(resolveExplainTarget(host.querySelector('.static-page-summary-label'))?.term).toBe('systemLabel')
  })

  it('answers a control whose name carries live data', () => {
    const download = render('<button type="button" aria-label="Download orders-1.csv"></button>')
    const chip = render('<button type="button" aria-label="Remove GORJANA_US"></button>')

    // The varying half is this tenant's own record, so the answer deliberately ignores it.
    expect(resolveExplainTarget(download.querySelector('button'))?.term).toBe('download orders-1.csv')
    expect(lookupAction('download orders-1.csv')?.title).toBe('Download')
    expect(resolveExplainTarget(chip.querySelector('button'))?.term).toBe('remove gorjana_us')
    expect(lookupAction('remove gorjana_us')?.title).toBe('Remove')
  })

  it('answers an icon action that navigates, which is an anchor and not a button', () => {
    // The play beside the gear on a run history: same size, same row, same job to the
    // person using it — and a RouterLink, so matching on the tag left it dead.
    const play = render('<a class="app-icon-action" aria-label="Open run" title="Open run"><svg></svg></a>')
    const tile = render('<a class="static-page-tile"><span class="static-page-tile-title">Daily Order Reconciliation</span></a>')

    expect(resolveExplainTarget(play.querySelector('svg'))?.term).toBe('open run')
    // A link with no name of its own is named by this tenant's data, so it stays silent.
    expect(resolveExplainTarget(tile.querySelector('.static-page-tile-title'))).toBeNull()
  })

  it('stays silent on a button nobody has written an answer for', () => {
    const host = render('<button type="button">Frobnicate</button>')

    expect(resolveExplainTarget(host.querySelector('button'))).toBeNull()
  })
})

describe('action entries', () => {
  const RENDERED_LIMIT = 200

  it('keeps every entry to something a person will actually read', () => {
    const overruns = Object.entries(MASCOT_ACTIONS)
      .map(([name, entry]) => ({ name, length: `${entry.title} — ${entry.body}`.length }))
      .filter((row) => row.length > RENDERED_LIMIT)

    expect(overruns, `too long for a corner bubble: ${JSON.stringify(overruns)}`).toEqual([])
  })

  it('starts every body lowercase, since the title leads the sentence', () => {
    for (const [name, entry] of Object.entries(MASCOT_ACTIONS)) {
      const first = entry.body.trimStart().charAt(0)
      expect(first === first.toLowerCase(), `${name}: "${entry.body.slice(0, 24)}…"`).toBe(true)
    }
  })

  it('never opens by conjugating its own title', () => {
    // The rule that makes an entry worth having. "Stop run — stops the run" costs a hover
    // and teaches nothing. Narrow on purpose: it catches the one restatement that is
    // mechanically detectable — a body whose first word is the title's first word in
    // another tense — and leaves the rest to review, rather than guessing at meaning.
    const stem = (word: string) => word.toLowerCase().replace(/[^a-z]/g, '').slice(0, 4)
    const echoes = Object.entries(MASCOT_ACTIONS).filter(([, entry]) => {
      const titleWord = stem(entry.title.split(/\s+/)[0] ?? '')
      const bodyWord = stem(entry.body.trimStart().split(/\s+/)[0] ?? '')
      return titleWord.length >= 3 && titleWord === bodyWord
    })

    expect(echoes.map(([name]) => name)).toEqual([])
  })

})

/**
 * "All buttons should have hints" — enforced rather than asserted.
 *
 * Sweeps every component in the app, reads each button's name the way the runtime does,
 * and fails on any that resolves to nothing. A new button without an entry cannot reach
 * a user silently: it breaks this test first.
 */
describe('every button in the app has an answer', () => {
  /**
   * Controls whose name is not in the template at all, with the reason each is allowed to
   * be. Two honest kinds: a name supplied by whoever renders the component, and a name
   * that IS this tenant's data — an option, a tenant, a date — where silence is the
   * correct answer rather than a gap. A new computed-name button fails this test until
   * somebody decides which kind it is.
   */
  const COMPUTED_NAMES: Readonly<Record<string, string>> = {
    'components/ui/AppCancelAction.vue': "label prop, default 'Cancel' — the entry answers it",
    'components/ui/AppSaveAction.vue': "label prop, default 'Save'; callers pass Save rule / Save exclusion / Save user settings",
    'components/ui/AppToggleSwitch.vue': 'label prop; the automation running/paused pair is entered',
    'components/ui/JsonCollapseNode.vue': 'toggleLabel builds "Expand <name> object" — the expand/collapse pattern answers it',
    'components/ui/AppSelect.vue': 'the trigger shows the selected value and each option IS a value, not vocabulary',
    'components/ui/EmptyState.vue': 'the caller supplies action.label; the caller is where the entry belongs',
    'components/ui/ErrorState.vue': 'the caller supplies action.label; the caller is where the entry belongs',
    'components/shell/CommandPalette.vue': 'rows are named by the command list, and are navigation rather than an action on data',
    'components/shell/MascotDock.vue': 'the mascot itself: hovering it shows its own label, not an explanation of it',
    'components/workflow/WorkflowSelect.vue': 'ariaLabel is supplied per caller; its chip button is covered by the remove pattern',
    'components/workflow/WorkflowStepForm.vue': 'primaryLabel is the step\'s own verb, supplied by each workflow',
    'components/workflow/WorkflowShortcutChoiceCards.vue': 'a choice card is named by the choice, which is data',
    'pages/reconciliation/ReconciliationRunResultPage.vue': 'the rule-selector option is a rule name and the diff bucket is answered through its own label span',
    'pages/reconciliation/ReconciliationDiffPage.vue': 'a calendar cell is a date',
    'pages/settings/UserSettingsPage.vue': 'a tenant tile is named by the tenant',
    'pages/settings/TenantSettingsPage.vue': 'the AI tile is named by the selected provider',
  }

  /**
   * Not only <button>. Several icon actions are RouterLinks because they navigate — the
   * play beside the gear on a run history is an anchor, and scoping this sweep to the
   * literal tag left it a dead hover next to a working one. A link is included only when
   * it carries an explicit name; a link named by its own content is named by data.
   */
  const CONTROL_TAGS = ['button', 'RouterLink', 'a ']

  function buttonTags(source: string): { tag: string, inner: string }[] {
    const found: { tag: string, inner: string }[] = []
    for (const openTag of CONTROL_TAGS) {
    for (let i = 0; ;) {
      const start = source.indexOf(`<${openTag}`, i)
      if (start === -1) break
      let j = start + openTag.length + 1
      let quote: string | null = null
      while (j < source.length) {
        const char = source[j] as string
        if (quote) { if (char === quote) quote = null }
        else if (char === '"' || char === "'") quote = char
        else if (char === '>') break
        j += 1
      }
      const closeTag = openTag.trim() === 'button' ? '</button>' : `</${openTag.trim()}>`
      const close = source.indexOf(closeTag, j)
      const tag = source.slice(start, j + 1)
      const named = /(?<![\w:-])(aria-label|title)="[^"]+"/.test(tag) || /:(aria-label|title)="[^"]+"/.test(tag)
      // A link with no name of its own is named by what it contains, which is data.
      if (openTag === 'button' || named) {
        found.push({ tag, inner: close === -1 ? '' : source.slice(j + 1, close) })
      }
      i = j + 1
    }
    }
    return found
  }

  /** A template literal is a real name with a hole in it; probe it with the hole filled. */
  function probeTemplates(expression: string): { probes: string[], rest: string } {
    const probes: string[] = []
    const rest = expression.replace(/`([^`]*)`/g, (_all, body: string) => {
      probes.push(body.replace(/\$\{[^}]*\}/g, 'x').trim())
      return ''
    })
    return { probes, rest }
  }

  function namesFor(tag: string, inner: string): string[] {
    for (const attribute of ['aria-label', 'title']) {
      const literal = tag.match(new RegExp(`(?<![\\w:-])${attribute}="([^"]*)"`))
      if (literal?.[1]?.trim()) return [literal[1].trim()]
      const bound = tag.match(new RegExp(`(?<![\\w-]):${attribute}="([^"]*)"`))
      if (bound?.[1]) {
        const { probes, rest } = probeTemplates(bound[1])
        const quoted = Array.from(rest.matchAll(/'([^']+)'/g)).map((match) => match[1] as string)
        return [...probes, ...quoted].filter(Boolean)
      }
    }
    // Mirrors controlName(): a list tile is named by its title span, not by the data beside it.
    const tile = inner.match(/class="[^"]*static-page-tile-title[^"]*"[^>]*>([^<]+)</)
    if (tile) {
      // controlName() reads this span and nothing else, so if its text is pure
      // interpolation the runtime name is this tenant's data — and silence is right.
      const tileText = (tile[1] ?? '').replace(/\{\{[\s\S]*?\}\}/g, '').replace(/\s+/g, ' ').trim()
      return tileText ? [tileText] : []
    }

    const names: string[] = []
    const plain = inner.replace(/\{\{([\s\S]*?)\}\}/g, (_all, expression: string) => {
      const { probes, rest } = probeTemplates(expression)
      names.push(...probes, ...Array.from(rest.matchAll(/'([^']+)'/g)).map((match) => match[1] as string))
      return ''
    })
    const text = plain.replace(/<[^>]*>/g, '').replace(/&times;/g, '×').replace(/\s+/g, ' ').trim()
    if (text) names.push(text)
    return names.filter(Boolean)
  }

  function normalize(name: string): string {
    return name.replace(/\s+/g, ' ').trim().replace(/[:：]$/, '').toLowerCase()
  }

  it('resolves every button name written in a template', () => {
    const files = glob('src/**/*.vue', { ignore: ['**/__tests__/**', '**/.claude/**'] })
    expect(files.length, 'no components were swept — the glob is wrong').toBeGreaterThan(30)

    const unanswered: string[] = []
    for (const file of files) {
      const relative = file.split('src/')[1] as string
      // The template only: <script> and <style> both mention "<button>" in prose, and a
      // comment is not a control.
      const source = readFileSync(file, 'utf-8').match(/<template>([\s\S]*)<\/template>/)?.[1] ?? ''
      for (const { tag, inner } of buttonTags(source)) {
        const names = namesFor(tag, inner)
        if (names.length === 0) {
          if (!COMPUTED_NAMES[relative]) unanswered.push(`${relative}: a button whose name is computed and undocumented`)
          continue
        }
        for (const name of names) {
          if (!lookupAction(normalize(name))) unanswered.push(`${relative}: "${name}"`)
        }
      }
    }

    expect(unanswered, `buttons with no answer:\n${unanswered.join('\n')}`).toEqual([])
  })
})
