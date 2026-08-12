<template>
  <StaticPageSection title="Shared with">
    <p v-if="loading && !sharing" class="section-note">Loading sharing state...</p>
    <InlineValidation v-if="error" tone="error" :message="error" data-testid="shared-with-error" />

    <ul v-if="sharing" class="shared-with-list" data-testid="shared-with-list">
      <li class="shared-with-row shared-with-row--owner" data-testid="shared-with-owner">
        <span class="shared-with-tenant-label">{{ ownerLabel }}</span>
        <span class="shared-with-role-note">Owner — cannot be removed</span>
      </li>

      <li
        v-for="peer in peers"
        :key="peer.tenantUserGroupId"
        class="shared-with-row"
        data-testid="shared-with-peer"
      >
        <span class="shared-with-tenant-label">{{ peer.label || peer.tenantUserGroupId }}</span>

        <template v-if="canManageThisConfig">
          <span v-if="pendingRemoveTenantId === peer.tenantUserGroupId" class="shared-with-confirm-row">
            <span class="shared-with-role-note">Remove this tenant's access?</span>
            <button
              type="button"
              data-testid="shared-with-confirm-remove"
              :disabled="revokingTenantId === peer.tenantUserGroupId"
              @click="confirmRemove(peer.tenantUserGroupId)"
            >
              Confirm
            </button>
            <button
              type="button"
              data-testid="shared-with-cancel-remove"
              :disabled="revokingTenantId === peer.tenantUserGroupId"
              @click="cancelRemove"
            >
              Cancel
            </button>
          </span>
          <button
            v-else
            type="button"
            data-testid="shared-with-remove"
            @click="requestRemove(peer.tenantUserGroupId)"
          >
            Remove
          </button>
        </template>
      </li>
    </ul>

    <p v-if="sharing && peers.length === 0" class="section-note" data-testid="shared-with-empty">
      Not shared with other tenants.
    </p>

    <div v-if="canManageThisConfig" class="shared-with-add-row">
      <AppSelect
        v-model="selectedTenantId"
        :options="availableTenantOptions"
        placeholder="Select a tenant"
        :disabled="granting || availableTenantOptions.length === 0"
        test-id="shared-with-tenant-select"
      />
      <button
        type="button"
        data-testid="shared-with-add"
        :disabled="!selectedTenantId || granting"
        @click="grantAccess"
      >
        Share
      </button>
    </div>
  </StaticPageSection>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { ConfigSharing, ConfigSharingMember } from '../../lib/api/types'
import type { SharedConfigType } from '../../lib/sharedConfig'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import StaticPageSection from '../ui/StaticPageSection.vue'

const props = defineProps<{
  configType: SharedConfigType
  configId: string
}>()

// `update:sharing` fires whenever a load settles (mount, prop change, or the reload after a
// successful mutation) with whatever sharing.value now is -- including null on failure. This is
// the single fetch of ConfigTenantAccess for this config; a caller that needs memberCount (the
// four workflow pages' affects-N-tenants save gate) listens to this instead of fetching its own
// copy, both to avoid a duplicate round-trip and, more importantly, so the caller can tell "not
// yet known" (nothing emitted yet) apart from "known unshared" (emitted with memberCount 1) and
// keep its own save action disabled until this settles. See DAR-BE-005 Task 12 review: two
// independent fetches raced, and a page whose own fetch resolved second could go interactive
// with editWarning still null even though the config was genuinely shared.
const emit = defineEmits<{ changed: []; 'update:sharing': [value: ConfigSharing | null] }>()

const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

const sharing = ref<ConfigSharing | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const selectedTenantId = ref('')
const granting = ref(false)
const pendingRemoveTenantId = ref<string | null>(null)
const revokingTenantId = ref<string | null>(null)

let loadController: AbortController | null = null
let mutationController: AbortController | null = null

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

const availableTenantOptions = computed<AppSelectOption[]>(() => {
  const taken = new Set<string>()
  if (sharing.value?.ownerTenantUserGroupId) taken.add(sharing.value.ownerTenantUserGroupId)
  for (const peer of peers.value) taken.add(peer.tenantUserGroupId)

  return (authStore.sessionInfo?.availableTenants ?? [])
    .filter((tenant) => !taken.has(tenant.userGroupId))
    .map((tenant) => ({ value: tenant.userGroupId, label: tenant.label || tenant.userGroupId }))
})

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
    if (!controller.signal.aborted) {
      loading.value = false
      // Emitted here, not only on the success path above, so a caller gating on "has this
      // settled yet" unblocks even when the fetch failed -- sharing.value is whatever it was
      // before (null on first load), which is the same fail-open fallback this component already
      // uses for its own rendering.
      emit('update:sharing', sharing.value)
    }
    if (loadController === controller) loadController = null
  }
}

async function grantAccess(): Promise<void> {
  if (!selectedTenantId.value || granting.value) return

  mutationController?.abort()
  const controller = new AbortController()
  mutationController = controller

  granting.value = true
  error.value = null
  try {
    const response = await settingsFacade.grantConfigTenantAccess({
      configTypeEnumId: props.configType,
      configId: props.configId,
      targetTenantUserGroupId: selectedTenantId.value,
    }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok || (response.errors?.length ?? 0) > 0) {
      error.value = response.errors?.[0] ?? 'Failed to share configuration.'
      return
    }
    selectedTenantId.value = ''
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

function requestRemove(tenantUserGroupId: string): void {
  error.value = null
  pendingRemoveTenantId.value = tenantUserGroupId
}

function cancelRemove(): void {
  pendingRemoveTenantId.value = null
}

async function confirmRemove(tenantUserGroupId: string): Promise<void> {
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
    pendingRemoveTenantId.value = null
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

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  loadController?.abort()
  mutationController?.abort()
})

watch(() => [props.configType, props.configId], () => {
  pendingRemoveTenantId.value = null
  void load()
})
</script>

<style scoped>
.shared-with-list {
  display: grid;
  gap: var(--space-1-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.shared-with-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.shared-with-row--owner {
  border-style: dashed;
}

.shared-with-tenant-label {
  overflow-wrap: anywhere;
}

.shared-with-role-note {
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.shared-with-confirm-row {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
}

.shared-with-add-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.shared-with-add-row .app-select {
  flex: 1;
}
</style>
