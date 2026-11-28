import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * S99-105: a caught error is shown through errorMessage / serviceErrors (lib/api/client.ts): every sentence of a
 * service refusal, else the caller's own line. `x instanceof Error ? x.message : String(x)` showed a script error's
 * raw text ("Cannot read properties of undefined") to the person.
 */
const RAW = /instanceof Error \? [\w.]+\.message : String\(/

/** Where the raw text is the point, each with the reason. */
const RAW_IS_RIGHT: Readonly<Record<string, string>> = {
  'src/lib/queryRead.ts': 'a JSON.parse failure on text the person typed: the parser\'s words say where the JSON breaks',
}

describe('errors are never shown raw', () => {
  it('turns no caught error into its raw text outside the allowed places', () => {
    const files = glob(['src/**/*.ts', 'src/**/*.vue'], { ignore: ['**/__tests__/**', '**/.claude/**'] })
    expect(files.length, 'nothing was swept — the glob is wrong').toBeGreaterThan(80)
    const offenders = files.filter((file) => !RAW_IS_RIGHT[file] && RAW.test(readFileSync(file, 'utf-8')))
    expect(offenders, `use errorMessage(error, fallback) from lib/api/client in: ${offenders.join(', ')}`).toEqual([])
  })

  it('still finds the allowed places, so the list cannot go stale', () => {
    for (const file of Object.keys(RAW_IS_RIGHT)) expect(RAW.test(readFileSync(file, 'utf-8')), file).toBe(true)
  })
})
