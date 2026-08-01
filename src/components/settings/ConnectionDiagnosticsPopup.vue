<template>
  <div
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="connection-diagnostics-title"
    data-testid="connection-diagnostics-popup"
    @click.self="requestClose"
  >
    <section class="popup-workflow-modal workflow-panel connection-diagnostics-popup">
      <header class="workflow-panel-header connection-diagnostics-header">
        <h2 id="connection-diagnostics-title">Diagnostics</h2>
        <button
          type="button"
          class="app-icon-action connection-diagnostics-close"
          data-testid="connection-diagnostics-close"
          aria-label="Close diagnostics"
          @click="requestClose"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="closeIconPath" fill="currentColor" />
          </svg>
        </button>
      </header>

      <div aria-live="polite" data-testid="connection-diagnostics-body">
        <InlineValidation v-if="error" tone="error" :message="error" />

        <p
          v-else-if="!available"
          class="section-note"
          data-testid="connection-diagnostics-unavailable"
        >
          Diagnostics are not available for this connector.
        </p>

        <template v-else>
          <ul class="connection-diagnostics-list" data-testid="connection-diagnostics-checks">
            <li
              v-for="check in checks"
              :key="check.key"
              class="connection-diagnostics-row"
              data-testid="connection-diagnostics-check"
              :data-check-key="check.key"
              :data-check-status="check.status"
            >
              <div class="connection-diagnostics-main">
                <span class="connection-diagnostics-glyph" aria-hidden="true">{{ glyphFor(check.status) }}</span>
                <span class="connection-diagnostics-label">{{ check.label }}</span>
                <span v-if="check.durationMillis != null" class="connection-diagnostics-duration">
                  {{ check.durationMillis }}ms
                </span>
                <StatusBadge :label="statusLabel(check.status)" :tone="toneFor(check.status)" />
              </div>
              <p v-if="check.detail" class="connection-diagnostics-detail">{{ check.detail }}</p>
            </li>

            <li
              v-if="running"
              class="connection-diagnostics-row connection-diagnostics-row--running"
              data-testid="connection-diagnostics-running"
            >
              <div class="connection-diagnostics-main">
                <span class="connection-diagnostics-glyph" aria-hidden="true">·</span>
                <span class="connection-diagnostics-label">Running diagnostics...</span>
              </div>
            </li>
          </ul>

          <p
            v-if="!running"
            class="connection-diagnostics-verdict"
            data-testid="connection-diagnostics-verdict"
          >
            {{ connectionOk ? 'Connection is valid.' : 'Connection is not usable.' }}
          </p>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import type { ConnectionCheck, ConnectionCheckStatus } from '../../lib/api/types'

defineProps<{
  running: boolean
  available: boolean
  connectionOk: boolean
  checks: ConnectionCheck[]
  error: string | null
}>()

const emit = defineEmits<{ (event: 'close'): void }>()

const closeIconPath =
  'M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 1 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z'

// The popup never dismisses itself, on any outcome. A passing result is still something an
// operator reads — timings, the shop domain, whether orders came back — so it waits to be closed.
function requestClose(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
  }
}

window.addEventListener('keydown', onKeydown)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// The glyph and the badge label both carry the meaning, so a viewer who cannot separate the
// tones still reads the result.
function glyphFor(status: ConnectionCheckStatus): string {
  if (status === 'PASS') return '✓'
  if (status === 'FAIL') return '✗'
  return '–'
}

function statusLabel(status: ConnectionCheckStatus): string {
  if (status === 'PASS') return 'Passed'
  if (status === 'FAIL') return 'Failed'
  return 'Skipped'
}

function toneFor(status: ConnectionCheckStatus): 'success' | 'danger' | 'neutral' {
  if (status === 'PASS') return 'success'
  if (status === 'FAIL') return 'danger'
  return 'neutral'
}
</script>

<style scoped>
.connection-diagnostics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.connection-diagnostics-list {
  list-style: none;
  margin: var(--space-3) 0 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

/*
 * Two stacked lines rather than one grid. An earlier single-grid version placed the detail with
 * `grid-column: 2 / -1`, which pushed the badge and duration into a new implicit row at column 1 —
 * they escaped the card's padding and collided. Keeping the detail out of the main line's
 * formatting context removes that class of bug entirely.
 */
.connection-diagnostics-row {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.84rem;
}

.connection-diagnostics-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.connection-diagnostics-glyph {
  flex: 0 0 1.25rem;
  text-align: center;
  color: var(--text-soft);
}

.connection-diagnostics-label {
  flex: 1 1 auto;
  min-width: 0;
}

/* Indented to sit under the label, clear of the glyph column. */
.connection-diagnostics-detail {
  margin: 0 0 0 calc(1.25rem + var(--space-2));
  color: var(--text-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.connection-diagnostics-duration {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

/* Pending, not a result: dashed and muted so it never reads as an outcome. */
.connection-diagnostics-row--running {
  border-style: dashed;
  color: var(--text-muted);
}

.connection-diagnostics-verdict {
  margin: var(--space-3) 0 0;
  font-size: 0.84rem;
  font-weight: 400;
}
</style>
