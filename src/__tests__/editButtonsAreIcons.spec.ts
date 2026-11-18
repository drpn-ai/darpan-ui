import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * DAR-UI-129. Edit buttons are icons, everywhere.
 *
 * A control that edits, changes or renames something is the pencil `app-icon-action`
 * (`editIconPath`) with its words in `aria-label` / `title`; an "add" on the same control
 * is the plus icon. It is never a text button reading "Edit", "Change", "Rename",
 * "Change rules →" and the like (docs/ui/page-surface-playbook.md, "Shared controls").
 *
 * The sweep reads each component's <template> and looks at the visible text of every
 * <button>, <RouterLink> and <a>: static text, or a `{{ cond ? 'X' : 'Y' }}` ternary of
 * string literals. Attributes are not text, so a WorkflowStepForm `primary-label` ("Change"
 * as the password step's submit) and an `aria-label` never trip it.
 */

// Genuine exceptions only, each with its reason. Keep it empty if at all possible.
const ALLOWED: ReadonlyArray<string> = []

const EDIT_WORD = /^(Edit|Change|Rename|Modify)(\s.*)?$/

// Attribute values may hold `>` (`v-if="a > b"`), so quoted strings are consumed whole.
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`
const ELEMENT = new RegExp(`<(button|RouterLink|router-link|a)\\b${ATTRS}>([\\s\\S]*?)</\\1>`, 'g')
const TAG = new RegExp(`<${ATTRS}>`, 'g')
const MUSTACHE = /\{\{([\s\S]*?)\}\}/g
const LITERAL_TERNARY = /^[^?]+\?\s*(['"`])([^'"`]*)\1\s*:\s*(['"`])([^'"`]*)\3$/

/** Every string a reader might see as the element's label. */
function visibleTexts(inner: string): string[] {
  const withoutTags = inner.replace(TAG, ' ')
  const texts: string[] = []
  for (const match of withoutTags.matchAll(MUSTACHE)) {
    const ternary = (match[1] ?? '').trim().match(LITERAL_TERNARY)
    if (ternary) texts.push(ternary[2] ?? '', ternary[4] ?? '')
  }
  texts.push(withoutTags.replace(MUSTACHE, ' '))
  return texts.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function templateOf(source: string): { body: string; offset: number } | null {
  const start = source.indexOf('<template')
  const end = source.lastIndexOf('</template>')
  if (start < 0 || end < start) return null
  return { body: source.slice(start, end), offset: start }
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function findTextEditButtons(file: string, source: string): string[] {
  const template = templateOf(source)
  if (!template) return []
  const hits: string[] = []
  for (const match of template.body.matchAll(ELEMENT)) {
    const offending = visibleTexts(match[2] ?? '').find((text) => EDIT_WORD.test(text))
    if (!offending) continue
    hits.push(`${file}:${lineAt(source, template.offset + (match.index ?? 0))} <${match[1]}> "${offending}"`)
  }
  return hits
}

describe('edit buttons are icons', () => {
  it('flags text edit buttons and leaves icon buttons and attributes alone', () => {
    const sample = `<template>
  <button type="button" @click="a > b && go()">Change</button>
  <RouterLink :to="x">Change rules →</RouterLink>
  <button type="button">{{ saved ? 'Change' : 'Add' }}</button>
  <button class="app-icon-action" aria-label="Change timezone" title="Change timezone"><svg><path :d="editIconPath" /></svg></button>
  <WorkflowStepForm primary-label="Change" />
  <a href="/x">Changelog</a>
  <button type="button">Save</button>
</template>`
    expect(findTextEditButtons('Sample.vue', sample)).toEqual([
      'Sample.vue:2 <button> "Change"',
      'Sample.vue:3 <RouterLink> "Change rules →"',
      'Sample.vue:4 <button> "Change"',
    ])
  })

  it('has no text edit, change or rename button in any component', () => {
    const files = glob(['src/**/*.vue'], { ignore: ['**/__tests__/**'] })
    expect(files.length, 'nothing was swept — the glob is wrong').toBeGreaterThan(30)

    const offenders = files
      .flatMap((file) => findTextEditButtons(file, readFileSync(file, 'utf-8')))
      .filter((hit) => !ALLOWED.some((allowed) => hit.startsWith(allowed)))

    expect(offenders, `text edit buttons (use the pencil app-icon-action):\n${offenders.join('\n')}`).toEqual([])
  })
})
