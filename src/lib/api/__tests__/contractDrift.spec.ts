import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Contract-drift guard (MACH P0, API management). The backend generates
// docs/api-contract/methods.txt from the facade service XML — the single source of
// truth for the remote API. A copy is committed here (src/lib/api/contract/methods.txt,
// refresh with `npm run sync-contract`) so this spec can fail the UI build whenever
// facade.ts references a method the contract does not define.
const contractPath = resolve(__dirname, '../contract/methods.txt')
const facadePath = resolve(__dirname, '../facade.ts')

const contractMethods = new Set(
  readFileSync(contractPath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

const facadeSource = readFileSync(facadePath, 'utf-8')
const facadeMethods = [
  ...new Set(facadeSource.match(/facade\.[A-Za-z]+FacadeServices\.[a-zA-Z]+#[A-Za-z0-9]+/g) ?? []),
]

describe('API contract drift', () => {
  it('has a non-trivial committed contract and facade method map', () => {
    expect(contractMethods.size).toBeGreaterThanOrEqual(60)
    expect(facadeMethods.length).toBeGreaterThanOrEqual(55)
  })

  it('only calls methods the backend contract defines', () => {
    const unknown = facadeMethods.filter((method) => !contractMethods.has(method))
    expect(
      unknown,
      `facade.ts references methods missing from the backend contract. Either the method name ` +
        `is wrong, or the backend contract changed — refresh the committed copy with ` +
        `\`npm run sync-contract\` (regenerate first via ` +
        `./gradlew :runtime:component:darpan:generateApiContract in darpan-backend).`,
    ).toEqual([])
  })
})
