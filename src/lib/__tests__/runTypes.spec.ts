import { describe, expect, it } from 'vitest'
import { MASCOT_GLOSSARY } from '../mascotGlossary'
import { RUN_TYPES, RUN_TYPE_ORDER, questionCountLabel } from '../runTypes'

describe('run types', () => {
  it('names the two kinds of run Sync and Lifecycle, in that order', () => {
    expect(RUN_TYPE_ORDER).toEqual(['sync', 'lifecycle'])
    expect(RUN_TYPE_ORDER.map((id) => RUN_TYPES[id].label)).toEqual(['Sync', 'Lifecycle'])
  })

  it('gives each type its own icon, so a monochrome tile can still be told apart', () => {
    const paths = RUN_TYPE_ORDER.map((id) => RUN_TYPES[id].iconPath)
    paths.forEach((path) => expect(path.length).toBeGreaterThan(0))
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('points each type at the existing create flow for it', () => {
    expect(RUN_TYPES.sync.createRoute).toEqual({ name: 'reconciliation-create' })
    expect(RUN_TYPES.lifecycle.createRoute).toEqual({ name: 'reconciliation-run-flowchart-create' })
  })

  it('has a mascot explanation for every type', () => {
    RUN_TYPE_ORDER.forEach((id) => expect(MASCOT_GLOSSARY[RUN_TYPES[id].glossaryTerm], id).toBeTruthy())
  })

  // A run's days are chosen when it starts, so a lifecycle is labelled by its questions alone.
  it('labels a lifecycle run by its questions', () => {
    expect(questionCountLabel(1)).toBe('1 question')
    expect(questionCountLabel(4)).toBe('4 questions')
  })
})
