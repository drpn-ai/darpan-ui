<template>
  <div ref="root" class="workflow-context-block" data-testid="shared-with-block">
    <span class="workflow-context-label">Shared with</span>

    <InlineValidation v-if="error" tone="error" :message="error" data-testid="shared-with-error" />

    <div v-if="sharing" class="workflow-choice-grid" data-testid="shared-with-list">
      <span class="shared-with-chip shared-with-chip--owner" data-testid="shared-with-owner">
        {{ ownerLabel }}
        <span class="shared-with-chip-note">owner</span>
      </span>

      <template v-for="entry in chipEntries" :key="entry.tenantUserGroupId">
        <span
          v-if="entry.removed"
          class="shared-with-chip shared-with-chip--undo"
          data-testid="shared-with-undo-slot"
        >
          {{ entry.label }} removed
          <button
            type="button"
            class="shared-with-chip-action shared-with-chip-action--undo"
            data-testid="shared-with-undo"
            :disabled="granting"
            @click="undoRemove(entry.tenantUserGroupId)"
            @focus="pauseUndoTimer(entry.tenantUserGroupId)"
            @blur="resumeUndoTimer(entry.tenantUserGroupId)"
          >
            undo
          </button>
        </span>

        <span v-else class="shared-with-chip" data-testid="shared-with-peer">
          {{ entry.label }}
          <button
            v-if="canManageThisConfig"
            type="button"
            class="shared-with-chip-action"
            data-testid="shared-with-remove"
            :aria-label="`Remove ${entry.label}`"
            :disabled="revokingTenantId === entry.tenantUserGroupId"
            @click="removePeer(entry.tenantUserGroupId, entry.label)"
          >
            &times;
          </button>
        </span>
      </template>

      <template v-if="canManageThisConfig && availableTenantOptions.length > 0">
        <AppSelect
          v-if="picking"
          :model-value="''"
          :options="availableTenantOptions"
          placeholder="Select a tenant"
          :disabled="granting"
          test-id="shared-with-tenant-select"
          @update:model-value="grantAccess"
        />
        <button
          v-else
          type="button"
          class="shared-with-chip shared-with-chip--add"
          data-testid="shared-with-add-chip"
          @click="openPicker"
        >
          + Add tenant
        </button>
      </template>
    </div>

    <p class="sr-only" aria-live="polite" data-testid="shared-with-live">{{ liveMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { ConfigSharing, ConfigSharingMember } from '../../lib/api/types'
import type { SharedConfigType } from '../../lib/sharedConfig'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import InlineValidation from '../ui/InlineValidation.vue'

const props = defineProps<{
  configType: SharedConfigType
  configId: string
}>()

const emit = defineEmits<{ changed: [] }>()

const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

/** How long a revoked tenant stays recoverable. Revoke has already committed by then; see undoRemove. */
const UNDO_WINDOW_MS = 8000

type RemovedSlot = { tenantUserGroupId: string; label: string; index: number }
type ChipEntry = { tenantUserGroupId: string; label: string; removed: boolean }

const root = ref<HTMLElement | null>(null)
const sharing = ref<ConfigSharing | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const liveMessage = ref('')
const picking = ref(false)
const granting = ref(false)
const revokingTenantId = ref<string | null>(null)
const removedSlots = ref<RemovedSlot[]>([])

let loadController: AbortController | null = null
let mutationController: AbortController | null = null

// One entry per live undo slot. Kept outside `removedSlots` because a timer handle is not render
// state, and putting it in a ref would make every tick a reactive write.
const undoTimers = new Map<string, { handle: ReturnType<typeof setTimeout>; remaining: number; startedAt: number }>()

// Double gate, deliberately: `sharing.canManage` is the backend's own two-sided tenant-admin
// check for THIS config, but `canManageConfigSharing` is whether the signed-in user is a tenant
// admin of the ACTIVE tenant at all. A DARPAN_COMPANY_EDITOR must never see grant/revoke controls
// just because the backend would have allowed the active tenant to manage this particular row.
const canManageThisConfig = computed(
  () => permissionsStore.canManageConfigSharing && sharing.value?.canManage === true,
)

const peers = computed<ConfigSharingMember[]>(() => sharing.value?.memberTenantLabels ?? [])
const ownerLabel = computed(
  () => sharing.value?.ownerTenantLabel || sharing.value?.ownerTenantUserGroupId || 'Owning tenant',
)

// A revoked tenant is gone from `peers` the moment the reload settles, so its undo slot is spliced
// back in at the index it occupied. Without the index the slot would jump to the end of the row and
// the "in place" part of the gesture would be lost.
const chipEntries = computed<ChipEntry[]>(() => {
  const entries: ChipEntry[] = peers.value.map((peer) => ({
    tenantUserGroupId: peer.tenantUserGroupId,
    label: peer.label || peer.tenantUserGroupId,
    removed: false,
  }))

  for (const slot of removedSlots.value) {
    entries.splice(Math.min(slot.index, entries.length), 0, {
      tenantUserGroupId: slot.tenantUserGroupId,
      label: slot.label,
      removed: true,
    })
  }

  return entries
})

const availableTenantOptions = computed<AppSelectOption[]>(() => {
  const taken = new Set<string>()
  if (sharing.value?.ownerTenantUserGroupId) taken.add(sharing.value.ownerTenantUserGroupId)
  for (const peer of peers.value) taken.add(peer.tenantUserGroupId)
  for (const slot of removedSlots.value) taken.add(slot.tenantUserGroupId)

  return (authStore.sessionInfo?.availableTenants ?? [])
    .filter((tenant) => !taken.has(tenant.userGroupId))
    .map((tenant) => ({ value: tenant.userGroupId, label: tenant.label || tenant.userGroupId }))
})

function clearUndoTimer(tenantUserGroupId: string): void {
  const timer = undoTimers.get(tenantUserGroupId)
  if (!timer) return
  clearTimeout(timer.handle)
  undoTimers.delete(tenantUserGroupId)
}

function dropSlot(tenantUserGroupId: string): void {
  clearUndoTimer(tenantUserGroupId)
  removedSlots.value = removedSlots.value.filter((slot) => slot.tenantUserGroupId !== tenantUserGroupId)
}

function startUndoTimer(tenantUserGroupId: string, remaining: number): void {
  clearUndoTimer(tenantUserGroupId)
  undoTimers.set(tenantUserGroupId, {
    handle: setTimeout(() => dropSlot(tenantUserGroupId), remaining),
    remaining,
    startedAt: Date.now(),
  })
}

// Focus pauses the countdown: a keyboard user tabbing toward the undo control must not watch it
// disappear out from under them mid-traversal.
function pauseUndoTimer(tenantUserGroupId: string): void {
  const timer = undoTimers.get(tenantUserGroupId)
  if (!timer) return
  clearTimeout(timer.handle)
  timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
}

function resumeUndoTimer(tenantUserGroupId: string): void {
  const timer = undoTimers.get(tenantUserGroupId)
  if (!timer) return
  startUndoTimer(tenantUserGroupId, timer.remaining)
}

async function openPicker(): Promise<void> {
  picking.value = true
  await nextTick()
  const trigger = root.value?.querySelector<HTMLElement>('[data-testid="shared-with-tenant-select"]')
  trigger?.click()
}

async function load(): Promise<void> {
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller

  loading.value = true
  error.value = null
  try {
    const response = await settingsFacade.listConfigTenantAccess({
      configTypeEnumId: props.configType,
      configId: props.configId,
    }, controller.signal)
    if (controller.signal.aborted) return
    sharing.value = response.sharing ?? null
    if (!response.ok) {
      error.value = response.errors?.[0] ?? 'Failed to load sharing state.'
    }
  } catch (loadError) {
    if (controller.signal.aborted || isAbortError(loadError)) return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load sharing state.'
  } finally {
    if (!controller.signal.aborted) loading.value = false
    if (loadController === controller) loadController = null
  }
}

async function grantAccess(targetTenantUserGroupId: string): Promise<void> {
  if (!targetTenantUserGroupId || granting.value) return

  mutationController?.abort()
  const controller = new AbortController()
  mutationController = controller

  granting.value = true
  error.value = null
  try {
    const response = await settingsFacade.grantConfigTenantAccess({
      configTypeEnumId: props.configType,
      configId: props.configId,
      targetTenantUserGroupId,
    }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok || (response.errors?.length ?? 0) > 0) {
      error.value = response.errors?.[0] ?? 'Failed to share configuration.'
      return
    }
    picking.value = false
    await load()
    emit('changed')
  } catch (grantError) {
    if (controller.signal.aborted || isAbortError(grantError)) return
    error.value = grantError instanceof ApiCallError ? grantError.message : 'Failed to share configuration.'
  } finally {
    if (!controller.signal.aborted) granting.value = false
    if (mutationController === controller) mutationController = null
  }
}

async function removePeer(tenantUserGroupId: string, label: string): Promise<void> {
  if (revokingTenantId.value) return

  // Captured before the reload below drops this peer out of `peers`.
  const index = chipEntries.value.findIndex((entry) => entry.tenantUserGroupId === tenantUserGroupId)

  mutationController?.abort()
  const controller = new AbortController()
  mutationController = controller

  revokingTenantId.value = tenantUserGroupId
  error.value = null
  try {
    const response = await settingsFacade.revokeConfigTenantAccess({
      configTypeEnumId: props.configType,
      configId: props.configId,
      targetTenantUserGroupId: tenantUserGroupId,
    }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok || (response.errors?.length ?? 0) > 0) {
      error.value = response.errors?.[0] ?? 'Failed to remove tenant access.'
      return
    }

    removedSlots.value = [
      ...removedSlots.value,
      { tenantUserGroupId, label, index: index < 0 ? peers.value.length : index },
    ]
    startUndoTimer(tenantUserGroupId, UNDO_WINDOW_MS)
    liveMessage.value = `${label} removed. Undo available.`

    await load()
    emit('changed')
  } catch (revokeError) {
    if (controller.signal.aborted || isAbortError(revokeError)) return
    error.value = revokeError instanceof ApiCallError ? revokeError.message : 'Failed to remove tenant access.'
  } finally {
    if (!controller.signal.aborted) revokingTenantId.value = null
    if (mutationController === controller) mutationController = null
  }
}

// Not a rollback. ConfigTenantAccess is append-only (the entity's own comment: "Revoke never
// deletes a row -- the history of who could reach a credential must survive the revoke"), so the
// revoke stands thruDated and this writes a fresh grant row. The audit trail keeps both.
async function undoRemove(tenantUserGroupId: string): Promise<void> {
  const slot = removedSlots.value.find((entry) => entry.tenantUserGroupId === tenantUserGroupId)
  if (!slot || granting.value) return

  pauseUndoTimer(tenantUserGroupId)

  mutationController?.abort()
  const controller = new AbortController()
  mutationController = controller

  granting.value = true
  error.value = null
  try {
    const response = await settingsFacade.grantConfigTenantAccess({
      configTypeEnumId: props.configType,
      configId: props.configId,
      targetTenantUserGroupId: tenantUserGroupId,
    }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok || (response.errors?.length ?? 0) > 0) {
      // Slot deliberately survives a failed undo so the gesture can be retried.
      error.value = response.errors?.[0] ?? 'Failed to restore tenant access.'
      resumeUndoTimer(tenantUserGroupId)
      return
    }

    dropSlot(tenantUserGroupId)
    liveMessage.value = `${slot.label} restored.`
    await load()
    emit('changed')
  } catch (undoError) {
    if (controller.signal.aborted || isAbortError(undoError)) return
    error.value = undoError instanceof ApiCallError ? undoError.message : 'Failed to restore tenant access.'
    resumeUndoTimer(tenantUserGroupId)
  } finally {
    if (!controller.signal.aborted) granting.value = false
    if (mutationController === controller) mutationController = null
  }
}

function resetSlots(): void {
  for (const slot of removedSlots.value) clearUndoTimer(slot.tenantUserGroupId)
  removedSlots.value = []
}

void load()

onBeforeUnmount(() => {
  loadController?.abort()
  mutationController?.abort()
  resetSlots()
})

watch(() => [props.configType, props.configId], () => {
  resetSlots()
  picking.value = false
  liveMessage.value = ''
  void load()
})
</script>
