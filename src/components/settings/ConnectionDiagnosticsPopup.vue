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
          <!-- The answer first; the checks below are the evidence for it. -->
          <p class="connection-diagnostics-verdict" data-testid="connection-diagnostics-verdict">
            {{ headline }}
          </p>
          <p class="connection-diagnostics-summary" data-testid="connection-diagnostics-summary">
            {{ summary }}
          </p>

          <ul class="connection-diagnostics-rail" data-testid="connection-diagnostics-checks">
            <li
              v-for="check in checks"
              :key="check.key"
              class="connection-diagnostics-step"
              data-testid="connection-diagnostics-check"
              :data-check-key="check.key"
              :data-check-status="check.status"
            >
              <span class="connection-diagnostics-node" aria-hidden="true">{{ glyphFor(check.status) }}</span>
              <div class="connection-diagnostics-step-body">
                <span class="connection-diagnostics-label">{{ check.label }}</span>
                <!-- The glyph is decorative and the palette is monochrome, so the status has to
                     reach a screen reader as words. -->
                <span class="sr-only">{{ statusLabel(check.status) }}</span>
                <p v-if="check.detail" class="connection-diagnostics-detail">{{ check.detail }}</p>
              </div>
            </li>

            <li
              v-if="running"
              class="connection-diagnostics-step connection-diagnostics-step--running"
              data-testid="connection-diagnostics-running"
            >
              <span class="connection-diagnostics-node" aria-hidden="true">·</span>
              <div class="connection-diagnostics-step-body">
                <span class="connection-diagnostics-label">Checking...</span>
              </div>
            </li>
          </ul>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import type { ConnectionCheck, ConnectionCheckStatus } from '../../lib/api/types'

const props = defineProps<{
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
// operator reads, so it waits to be closed.
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

const headline = computed(() => {
  if (props.running) return 'Running diagnostics...'
  return props.connectionOk ? 'Connection is valid.' : 'Connection is not usable.'
})

function plural(count: number): string {
  return count === 1 ? 'check' : 'checks'
}

/**
 * Deliberately gives no total while the run is in flight. Checks arrive stage by stage and the
 * server does not announce how many are coming, so "2 of 4" would mean hardcoding a per-connector
 * stage count here — the exact connector knowledge this component is built to avoid.
 */
const summary = computed(() => {
  const counted = props.checks.length
  if (props.running) {
    return counted === 0 ? 'Starting...' : `${counted} ${plural(counted)} complete`
  }

  const passed = props.checks.filter((check) => check.status === 'PASS').length
  const skipped = props.checks.filter((check) => check.status === 'SKIP').length
  const firstFailed = props.checks.find((check) => check.status === 'FAIL')

  if (!firstFailed) return `${passed} ${plural(passed)} passed`

  // Name what broke: it is the one thing the operator has to act on.
  const tallies = [`${passed} passed`]
  if (skipped > 0) tallies.push(`${skipped} skipped`)
  return `${firstFailed.label} failed · ${tallies.join(', ')}`
})

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
</script>

<style scoped>
.connection-diagnostics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.connection-diagnostics-verdict {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 400;
}

.connection-diagnostics-summary {
  margin: 0 0 var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.76rem;
}

/*
 * A rail rather than a stack of cards: the checks arrive in sequence, and a connecting line says
 * "sequence" where separate tiles say "collection". The line is drawn once on the list, not per
 * step, so it cannot fragment as rows stream in.
 */
.connection-diagnostics-rail {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0 0 0 26px;
}

.connection-diagnostics-rail::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 9px;
  bottom: 12px;
  width: 1px;
  background: var(--border);
}

.connection-diagnostics-step {
  position: relative;
  padding-bottom: var(--space-3);
  font-size: 0.84rem;
}

.connection-diagnostics-step:last-child {
  padding-bottom: 0;
}

.connection-diagnostics-node {
  position: absolute;
  left: -26px;
  top: -1px;
  width: 19px;
  height: 19px;
  line-height: 17px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  /* Opaque, so the node sits on the rail rather than the rail crossing through it. */
  background: var(--surface);
  font-size: 0.72rem;
  color: var(--text-soft);
}

.connection-diagnostics-step[data-check-status='FAIL'] .connection-diagnostics-node {
  border-color: var(--text-soft);
  color: var(--text);
}

.connection-diagnostics-step--running {
  color: var(--text-muted);
}

.connection-diagnostics-step--running .connection-diagnostics-node {
  border-style: dashed;
  color: var(--text-muted);
}

.connection-diagnostics-step-body {
  min-width: 0;
}

.connection-diagnostics-detail {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}
</style>
