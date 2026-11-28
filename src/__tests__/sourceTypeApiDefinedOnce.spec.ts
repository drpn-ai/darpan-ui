import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * DAR-OPS-029 S99-113. The API source type is one constant, SOURCE_TYPE_API in lib/reconciliationRuleSetDraft.ts: five
 * files each spelled 'AUT_SRC_API' themselves (one as AUTOMATION_SOURCE_TYPE_API), so a change to it had five places to
 * miss. Tests may spell the enum id in fixtures; app code imports the constant.
 */
const OWNER = 'src/lib/reconciliationRuleSetDraft.ts'

describe('the API source type is defined once', () => {
  it('no app file outside its owner spells AUT_SRC_API', () => {
    const files = glob(['src/**/*.{ts,vue}'], { ignore: ['**/__tests__/**', '**/*.spec.ts', 'src/lib/api/generated/**'] })
    const offenders = files.filter((file) => file !== OWNER && readFileSync(file, 'utf8').includes("'AUT_SRC_API'"))
    expect(offenders).toEqual([])
    expect(readFileSync(OWNER, 'utf8')).toContain("export const SOURCE_TYPE_API = 'AUT_SRC_API'")
  })
})
