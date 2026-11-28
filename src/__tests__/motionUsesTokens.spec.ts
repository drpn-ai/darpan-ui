import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * DAR-UI-136. Every transition and animation runs on the motion tokens.
 *
 * Durations come from `--motion-*` and curves from `--ease-*` (src/style.css), never a literal
 * `160ms ease`: `ease` is not `--ease-out`, and a literal drifts the day a token is retuned
 * (docs/ui/page-surface-playbook.md, "Motion"). The sweep reads every `transition`, `animation`,
 * `*-duration` and `*-timing-function` declaration in src/**\/*.{css,vue}, drops each `var(...)`,
 * and flags a time literal, an easing keyword or a `cubic-bezier(` left in what remains.
 * `none` is always fine.
 */

// The mascot is the one thing allowed to move on its own terms (playbook: "only the mascot bounces").
const EXEMPT_FILES: ReadonlyArray<string> = ['src/components/shell/DarpanMascot.vue']

// Genuine exceptions only, each with its reason: [file, declaration value, why].
const ALLOWED: ReadonlyArray<readonly [string, string, string]> = [
  ['src/style.css', 'opacity 500ms linear', 'mascot bubble release; equals RELEASE_MS in useMascotDwell.ts'],
  ['src/style.css', '0.01ms !important', 'the prefers-reduced-motion collapse itself'],
  ['src/components/ui/LoadingState.vue', 'loading-state-hop 1s ease-in-out infinite', 'progress loop, not a state change'],
]

const DECLARATION = /(?<![\w-])(transition|animation)(-duration|-timing-function)?\s*:\s*([^;}]+)/g
const VAR_CALL = /var\([^()]*(?:\([^()]*\)[^()]*)*\)/g
const LITERAL = /(?:^|[\s,(])(\d*\.?\d+m?s)\b|\b(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)\b|cubic-bezier\(/

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function findLiteralMotion(file: string, source: string): string[] {
  const hits: string[] = []
  for (const match of source.matchAll(DECLARATION)) {
    const value = (match[3] ?? '').replace(/\s+/g, ' ').trim()
    if (!LITERAL.test(value.replace(VAR_CALL, ' '))) continue
    if (ALLOWED.some(([allowedFile, allowedValue]) => file === allowedFile && value.includes(allowedValue))) continue
    hits.push(`${file}:${lineAt(source, match.index ?? 0)} ${match[1]}${match[2] ?? ''}: ${value}`)
  }
  return hits
}

describe('motion uses tokens', () => {
  it('flags literal durations and curves and leaves tokens alone', () => {
    const sample = `.a { transition: border-color 160ms ease, background 160ms ease; }
.b { transition: opacity var(--motion-base) var(--ease-out); }
.c { transition: transform var(--motion-base) var(--ease-in-out), color var(--motion-fast) var(--ease-out); }
.d { animation: fade-up 0.2s var(--ease-out); }
.e { transition-timing-function: cubic-bezier(0.2, 0, 0, 1); }
.f { transition: none; }
.g { --transition-width: 10ms; }
.h { transition-duration: var(--motion-exit); }`
    expect(findLiteralMotion('Sample.css', sample)).toEqual([
      'Sample.css:1 transition: border-color 160ms ease, background 160ms ease',
      'Sample.css:4 animation: fade-up 0.2s var(--ease-out)',
      'Sample.css:5 transition-timing-function: cubic-bezier(0.2, 0, 0, 1)',
    ])
  })

  it('has no literal duration or easing outside the motion tokens', () => {
    const files = glob(['src/**/*.vue', 'src/**/*.css'], { ignore: ['**/__tests__/**', ...EXEMPT_FILES] })
    expect(files.length, 'nothing was swept — the glob is wrong').toBeGreaterThan(30)

    const offenders = files.flatMap((file) => findLiteralMotion(file, readFileSync(file, 'utf-8')))

    expect(offenders, `literal motion (use var(--motion-*) and var(--ease-*)):\n${offenders.join('\n')}`).toEqual([])
  })
})
