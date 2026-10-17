import { beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { invalidateReadCache } from '../lib/api/readCache'

beforeEach(() => {
  setActivePinia(createPinia())
  // DAR-UI-051: the read cache is module state; one spec's data must never be drawn in the next.
  invalidateReadCache()
})
