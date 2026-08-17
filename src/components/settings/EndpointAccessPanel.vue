<template>
  <div class="workflow-context-block" data-testid="endpoint-access-block">
    <span class="workflow-context-label">Available Endpoints</span>

    <InlineValidation v-if="error" tone="error" :message="error" data-testid="endpoint-access-error" />

    <p v-else-if="loaded && endpoints.length === 0" class="section-note" data-testid="endpoint-access-empty">
      No source endpoints are registered on this instance yet. Endpoints come from Darpan's reference
      data — load the component's seed data, then reopen this page.
    </p>

    <div v-else class="workflow-choice-grid">
      <label
        v-for="endpoint in endpoints"
        :key="endpoint.systemEnumId"
        :class="[
          'workflow-choice-option',
          'workflow-choice-option--filter',
          { 'workflow-choice-option--active': isChecked(endpoint.systemEnumId) },
        ]"
      >
        <input
          type="checkbox"
          :name="`endpoint-${endpoint.systemEnumId}`"
          :data-testid="`endpoint-${endpoint.systemEnumId}`"
          :checked="isChecked(endpoint.systemEnumId)"
          @change="toggle(endpoint.systemEnumId, ($event.target as HTMLInputElement).checked)"
        />
        <span class="workflow-choice-label">{{ endpoint.endpointLabel }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { SourceConfigEndpoint } from '../../lib/api/types'
import type { SharedConfigType } from '../../lib/sharedConfig'
import InlineValidation from '../ui/InlineValidation.vue'

const props = defineProps<{
  configType: SharedConfigType
  configId: string
  modelValue: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

// The registry supplies the catalog AND the current per-endpoint state. The panel never writes:
// the parent form owns the value and persists it on Save, because this is a hard security gate and
// must not flip on a stray click.
const endpoints = ref<SourceConfigEndpoint[]>([])
const loaded = ref(false)
const error = ref('')

// Set the moment the user ticks a box; cleared whenever a load reseeds for a new identity. Guards
// against a same-identity reload silently discarding an in-progress, unsaved toggle -- see load().
const dirty = ref(false)

let loadController: AbortController | null = null

function isChecked(systemEnumId: string): boolean {
  return props.modelValue.includes(systemEnumId)
}

function toggle(systemEnumId: string, checked: boolean): void {
  dirty.value = true
  const next = props.modelValue.filter((id) => id !== systemEnumId)
  if (checked) next.push(systemEnumId)
  // Keep the emitted order aligned with the registry so the payload is stable across renders.
  emit('update:modelValue', endpoints.value.map((e) => e.systemEnumId).filter((id) => next.includes(id)))
}

async function load(): Promise<void> {
  if (!props.configId) return

  loadController?.abort()
  const controller = new AbortController()
  loadController = controller

  error.value = ''
  try {
    const response = await settingsFacade.listSourceConfigEndpoints(
      { configTypeEnumId: props.configType, configId: props.configId },
      controller.signal,
    )
    if (controller.signal.aborted) return
    endpoints.value = response.endpoints ?? []
    loaded.value = true
    // Seed from server truth, but only while nothing has been edited since the last seed for this
    // identity. A configId/configType change resets `dirty` below and always reseeds -- the old
    // value belongs to a different record, and carrying it forward onto this one would itself be a
    // security bug (wrong endpoint permissions applied to the wrong config). Within the same
    // identity, a reload must never clobber a real in-progress toggle on a hard security gate.
    if (!dirty.value) {
      emit('update:modelValue', endpoints.value.filter((e) => e.isEnabled).map((e) => e.systemEnumId))
    }
  } catch (loadError) {
    if (controller.signal.aborted || isAbortError(loadError)) return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load endpoints.'
    loaded.value = true
  } finally {
    if (loadController === controller) loadController = null
  }
}

watch(
  () => [props.configType, props.configId],
  () => {
    dirty.value = false
    // Clear synchronously, before load() is awaited. Without this, the OLD identity's checkboxes
    // stay rendered (and clickable) for the whole in-flight window; a click during that window sets
    // `dirty` from data that belongs to a record other than the one now being loaded, which then
    // suppresses the new record's seed and leaves the old record's endpoint IDs bound to the new
    // config -- wrong endpoint permissions applied to the wrong config. With no endpoints rendered
    // there is nothing stale to click, so `dirty` can only be set from the identity now loading.
    endpoints.value = []
    loaded.value = false
    void load()
  },
  { immediate: true },
)

onBeforeUnmount(() => loadController?.abort())
</script>
