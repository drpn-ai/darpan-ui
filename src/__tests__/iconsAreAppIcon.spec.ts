import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * DAR-UI-158. No page draws an icon: it names one, <AppIcon name="settings" />, and src/lib/icons.ts holds the drawing.
 *
 * A hand-written <svg> around an icon's path is how the Pulses page drew the gear filled in a 20-unit box with no hub,
 * a blob on prod (2026-11-27), while five other pages drew it right. So an <svg> element may appear only in AppIcon and
 * in the drawings below, which are not icons; and no TypeScript module may carry an svg as a string for v-html.
 */
const NOT_ICONS: Readonly<Record<string, { count: number, reason: string }>> = {
  'src/components/ui/AppIcon.vue': { count: 1, reason: 'the one place an icon is drawn' },
  'src/components/shell/DarpanMascot.vue': { count: 1, reason: 'the mascot is a character, not an icon' },
  'src/components/pulse/PulseOldestChart.vue': { count: 1, reason: 'a chart' },
  'src/components/pulse/PulseWaitingChart.vue': { count: 1, reason: 'a chart' },
  'src/components/reconciliation/RunFlowchartBoard.vue': { count: 1, reason: "the flowchart's edges" },
  'src/components/reconciliation/RuleSetBoard.vue': { count: 1, reason: "the rules board's lines" },
  'src/components/ui/AppSelect.vue': { count: 1, reason: 'the select chevron, a 12x8 polyline the design system calls not an icon' },
  'src/components/workflow/WorkflowSelect.vue': { count: 1, reason: 'the select chevron, as AppSelect' },
}

const SVG_ELEMENT = /<svg\b/g
const SVG_STRING = /['"`]<svg\b/

describe('icons are AppIcon', () => {
  const components = glob('src/**/*.vue', { ignore: ['**/__tests__/**'] })
  const modules = glob('src/**/*.ts', { ignore: ['**/__tests__/**', '**/*.spec.ts', '**/*.d.ts', 'src/lib/api/generated/**'] })

  it('sweeps the whole app', () => {
    expect(components.length, 'no components were swept: the glob is wrong').toBeGreaterThan(100)
    expect(modules.length, 'no modules were swept: the glob is wrong').toBeGreaterThan(100)
  })

  it('draws an <svg> only in AppIcon and in drawings that are not icons', () => {
    const offenders = components.flatMap((file) => {
      const count = readFileSync(file, 'utf8').match(SVG_ELEMENT)?.length ?? 0
      const allowed = NOT_ICONS[file]?.count ?? 0
      return count > allowed ? [`${file}: ${count} <svg>, ${allowed} allowed`] : []
    })
    expect(offenders, 'name the icon with <AppIcon name="…" /> and add its drawing to src/lib/icons.ts').toEqual([])
  })

  it('keeps every exception real', () => {
    const stale = Object.entries(NOT_ICONS).flatMap(([file, { count }]) => {
      const found = components.includes(file) ? readFileSync(file, 'utf8').match(SVG_ELEMENT)?.length ?? 0 : 0
      return found === count ? [] : [`${file}: ${found} <svg>, the exception says ${count}`]
    })
    expect(stale).toEqual([])
  })

  it('carries no svg as a string', () => {
    expect(modules.filter((file) => SVG_STRING.test(readFileSync(file, 'utf8')))).toEqual([])
  })
})
