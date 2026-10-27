<template>
  <StaticPageSection title="Endpoints">
    <LoadingState v-if="loadState === 'loading'" noun="endpoints" />
    <InlineValidation v-else-if="loadState === 'error'" tone="error" :message="error ?? ''" />
    <div
      v-else
      class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed"
      :data-testid="listTestId"
    >
      <article
        v-for="endpoint in endpoints"
        :key="endpoint.systemEnumId"
        class="static-page-tile static-page-list-tile static-page-record-tile"
        :data-testid="tileTestId"
      >
        <span class="static-page-list-tile__title">{{ endpoint.endpointLabel }}</span>
      </article>
      <EmptyState v-if="endpoints.length === 0" title="No available endpoints" />
    </div>
  </StaticPageSection>
</template>

<script setup lang="ts">
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import type { SourceConfigEndpoint } from '../../lib/api/types'

/** The read-only endpoint tiles on a connector dashboard; state comes from useSourceConfigEndpoints. */
defineProps<{
  loadState: 'loading' | 'ready' | 'error'
  error: string | null
  endpoints: SourceConfigEndpoint[]
  listTestId: string
  tileTestId: string
}>()
</script>
