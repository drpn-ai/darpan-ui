<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Schema Library</h1>
    </template>

    <StaticPageSection title="Saved Schemas">
      <LoadingState v-if="loading" noun="schemas" />
      <InlineValidation v-else-if="error" tone="error" :message="error" />

      <EmptyState
        v-else-if="schemaCards.length === 0"
        title="No schemas saved yet"
        description="Create your first schema"
      />

      <div v-else class="static-page-tile-grid">
        <RouterLink
          v-for="schema in visibleSchemaCards"
          :key="schema.jsonSchemaId"
          :to="{
            name: 'schemas-editor',
            params: { jsonSchemaId: schema.jsonSchemaId },
          }"
          class="static-page-tile static-page-list-tile"
          data-testid="schema-library-tile"
        >
          <span class="static-page-tile-title static-page-list-tile__title">{{ resolveSchemaCardTitle(schema) }}</span>
          <span class="static-page-list-tile__meta">
            {{ schema.systemLabel || schema.systemEnumId || 'System pending' }}
          </span>
        </RouterLink>

        <button
          v-if="hasMoreSchemas"
          type="button"
          class="static-page-control-tile"
          data-testid="schema-library-more"
          @click="showAllSchemas = true"
        >
          More...
        </button>
      </div>

      <RouterLink
        v-if="canEditTenantSettings && schemaCards.length === 0 && !loading && !error"
        :to="createSchemaRoute"
        class="static-page-action-tile static-page-action-tile--inline"
        data-testid="schema-library-empty-create"
      >
        Create New Schema
      </RouterLink>
    </StaticPageSection>

    <RouterLink
      v-if="canEditTenantSettings && schemaCards.length > 0"
      :to="createSchemaRoute"
      class="static-page-action-tile"
      data-testid="schema-library-create"
    >
      Create New Schema
    </RouterLink>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade } from '../../lib/api/facade'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import type { JsonSchemaSummary } from '../../lib/api/types'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'

const route = useRoute()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()

const loading = ref(false)
const error = ref<string | null>(null)
const schemaCards = ref<JsonSchemaSummary[]>([])
const showAllSchemas = ref(false)
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)

const visibleSchemaCards = computed(() => (showAllSchemas.value ? schemaCards.value : schemaCards.value.slice(0, 5)))
const hasMoreSchemas = computed(() => schemaCards.value.length > 5 && !showAllSchemas.value)
const createSchemaRoute = computed(() => ({
  path: '/schemas/create',
}))

function resolveSchemaCardTitle(schema: JsonSchemaSummary): string {
  return resolveRecordLabel({
    description: schema.description,
    primary: schema.schemaName,
    fallbackId: schema.jsonSchemaId,
  })
}

const pageAbortController = new AbortController()

onBeforeUnmount(() => {
  pageAbortController.abort()
})

async function loadSchemas(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const response = await jsonSchemaFacade.list({
      pageIndex: 0,
      pageSize: 12,
      query: '',
    }, pageAbortController.signal)
    schemaCards.value = response.schemas ?? []
    showAllSchemas.value = false
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'The schemas are off scheming somewhere.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  draftStore.setWorkflowOrigin('Schema Library', route.fullPath || '/schemas/library')
  void loadSchemas()
})
</script>
