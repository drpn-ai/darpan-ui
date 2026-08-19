import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const facadeSource = readFileSync(resolve(__dirname, '../facade.ts'), 'utf-8')
const contractMethods = new Set(
  readFileSync(resolve(__dirname, '../contract/methods.txt'), 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

describe('CSV header inference facade wiring', () => {
  it('the backend contract defines the CSV inference method', () => {
    expect(contractMethods.has('facade.JsonSchemaFacadeServices.infer#JsonSchemaFromCsvText')).toBe(true)
  })

  it('facade.ts exposes inferFromCsvText against that method', () => {
    expect(facadeSource).toContain("inferFromCsvText: 'facade.JsonSchemaFacadeServices.infer#JsonSchemaFromCsvText'")
    expect(facadeSource).toContain('inferFromCsvText(payload: InferJsonSchemaFromCsvTextPayload')
  })
})
