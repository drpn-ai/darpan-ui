<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Automations</h1>
    </template>

    <StaticPageSection title="Automation Runs">
      <LoadingState v-if="loading" noun="automations" />
      <InlineValidation v-else-if="error" tone="error" :message="error" />

      <EmptyState
        v-else-if="!hasAutomations"
        title="No automations"
      />

      <div
        v-else
        class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed"
        data-testid="saved-automations"
      >
        <RouterLink
          v-for="automation in automations"
          :key="automation.automationId"
          :to="buildAutomationDashboardRoute(automation)"
          class="static-page-tile static-page-record-tile"
          data-testid="automation-tile"
          @click="setAutomationsOrigin"
        >
          <span class="static-page-tile-title">{{ automation.automationName }}</span>
        </RouterLink>
      </div>

      <RouterLink
        v-if="showInlineCreateAction"
        :to="createRoute"
        class="static-page-action-tile static-page-action-tile--inline"
        data-testid="automation-create-action"
        @click="setAutomationsOrigin"
      >
        Create Automation
      </RouterLink>
    </StaticPageSection>

    <RouterLink
      v-if="showFooterCreateAction"
      :to="createRoute"
      class="static-page-action-tile static-page-create-action"
      data-testid="automation-create-action"
      @click="setAutomationsOrigin"
    >
      Create Automation
    </RouterLink>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { cachedRead } from '../../lib/api/readCache'
import { automations as automationsQuery } from '../../lib/api/queries'
import type { AutomationRecord } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

const route = useRoute()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()
const automations = ref<AutomationRecord[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const hasAutomations = computed(() => automations.value.length > 0)
const showInlineCreateAction = computed(() => canEditTenantSettings.value && !hasAutomations.value && !loading.value && !error.value)
const showFooterCreateAction = computed(() => canEditTenantSettings.value && hasAutomations.value)
const createRoute = computed<RouteLocationRaw>(() => ({
  name: 'reconciliation-automation-create',
}))

function setAutomationsOrigin(): void {
  draftStore.setWorkflowOrigin('Automations', route.fullPath || '/reconciliation/automations')
}

function buildAutomationDashboardRoute(automation: AutomationRecord): RouteLocationRaw {
  return {
    name: 'reconciliation-automation-dashboard',
    params: { automationId: automation.automationId },
  }
}

const pageAbortController = new AbortController()

onBeforeUnmount(() => {
  pageAbortController.abort()
})

async function loadAutomations(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    await cachedRead(
      automationsQuery.key,
      () => automationsQuery.fetch(pageAbortController.signal),
      (response) => {
        automations.value = response.automations ?? []
        loading.value = false
      },
    )
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    automations.value = []
    error.value = loadError instanceof ApiCallError ? loadError.message : 'The automations are on autopilot. Somewhere else.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAutomations()
})
</script>
