import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import { setApiCacheReset } from './lib/api/facade'
import { clearAllPendingReconciliationRuns } from './lib/reconciliationPendingRuns'
import { useReferenceDataStore } from './stores/referenceData'
import { useRunResultsStore } from './stores/runResults'
import { useReconciliationDraftStore } from './stores/reconciliationDraft'
import './style.css'

const RECONCILIATION_DRAFT_SESSION_KEY = 'darpan.reconciliationDraftStore'
const RECENT_COMMANDS_STORAGE_KEY = 'darpan-ui-recent-commands'

initTheme()

const pinia = createPinia()

// Wire the API cache-reset coordinator. `clearApiResponseCache()` (called by
// auth.ts on login / logout / tenant switch) will now reset every prefetch
// cache via this hook, plus clear the cross-tenant-leaking draft store and
// any per-user localStorage that survives logout.
setApiCacheReset(() => {
  useReferenceDataStore(pinia).reset()
  useRunResultsStore(pinia).reset()
  useReconciliationDraftStore(pinia).resetAll() // setup-style store: explicit reset; clears its sessionStorage too
  clearAllPendingReconciliationRuns() // cross-tenant residue: run names/system labels in localStorage
  try {
    // resetAll already removes the draft sessionStorage key; clear it again defensively in case
    // the store has not been instantiated yet (no-op if absent).
    window.sessionStorage.removeItem(RECONCILIATION_DRAFT_SESSION_KEY)
    window.localStorage.removeItem(RECENT_COMMANDS_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in some embedded contexts; the in-memory resets above
    // are what actually close the cross-tenant data path.
  }
})

createApp(App)
  .use(pinia)
  .use(router)
  .mount('#app')
