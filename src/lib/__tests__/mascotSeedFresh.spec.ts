import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mascotSeedMark, mascotSeedXml } from '../mascotSeed'

/**
 * DAR-BE-313: the committed seed (darpan/data/AppContentSeedData.xml) must be what the bundle generates now. A stale
 * seed means the database is told the old words are the defaults. Runs when the darpan checkout sits beside this one
 * (the wrapper layout) and is skipped, with a reason, otherwise; `npm run mascot:seed:check` sets MASCOT_SEED_REQUIRE=1
 * so the release preflight fails instead of skipping.
 */
const SEED = 'darpan-backend/runtime/component/darpan/data/AppContentSeedData.xml'

function findSeed(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 4; i++) {
    const candidate = join(dir, SEED)
    if (existsSync(candidate)) return candidate
    dir = dirname(dir)
  }
  return null
}

const seedPath = findSeed()
const required = process.env['MASCOT_SEED_REQUIRE'] === '1'
const REGENERATE = 'Regenerate: MASCOT_SEED_OUT=<darpan>/data/AppContentSeedData.xml npx vitest run src/lib/__tests__/mascotSeed.spec.ts (npm run mascot:seed), then commit it in the darpan repo.'

describe('committed mascot seed', () => {
  it.skipIf(!seedPath && !required)('matches what the bundle generates', () => {
    if (!seedPath) throw new Error(`MASCOT_SEED_REQUIRE=1 but ${SEED} was not found above ${process.cwd()}`)
    const committed = readFileSync(seedPath, 'utf8')
    const committedMark = /seedId="CURRENT" seedMark="([0-9a-f]+)"/.exec(committed)?.[1]
    expect(committedMark, `stale mascot seed. ${REGENERATE}`).toBe(mascotSeedMark())
    expect(committed, `the seed mark matches but the file differs. ${REGENERATE}`).toBe(mascotSeedXml())
  })

  it.runIf(!seedPath && !required)('is skipped when no darpan checkout sits beside this one', () => {
    console.info(`mascotSeedFresh: ${SEED} not found above ${process.cwd()}; staleness not checked here.`)
    expect(seedPath).toBeNull()
  })
})
