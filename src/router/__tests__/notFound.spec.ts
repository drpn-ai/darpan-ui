import { describe, it, expect } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from '../index'
import NotFoundPage from '../../pages/NotFoundPage.vue'

describe('router 404', () => {
  it('matches an unknown path to the not-found route', () => {
    const testRouter = createRouter({ history: createMemoryHistory(), routes })
    const match = testRouter.resolve('/totally/unknown/path')
    expect(match.name).toBe('not-found')
    expect(match.matched[0]?.components?.default).toBe(NotFoundPage)
  })
})
