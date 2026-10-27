<template>
  <StaticPageSection :title="title">
    <AppListPager
      :page-index="pageIndex"
      :page-count="pageCount"
      :aria-label="pagerAriaLabel"
      :previous-test-id="previousTestId"
      :next-test-id="nextTestId"
      @update:page-index="emit('update:pageIndex', $event)"
    />

    <LoadingState v-if="loading" :noun="loadingNoun" />
    <InlineValidation v-else-if="error" tone="error" :message="error" />
    <EmptyState v-else-if="tiles.length === 0" :title="emptyTitle" />

    <div
      v-else
      class="static-page-tile-grid static-page-record-grid static-page-record-grid--fixed"
      :data-testid="listTestId"
    >
      <RouterLink
        v-for="tile in tiles"
        :key="tile.key"
        :to="tile.to"
        class="static-page-tile static-page-record-tile"
        :data-testid="tileTestId"
        @click="tile.onClick?.()"
      >
        <span class="static-page-tile-title">{{ tile.label }}</span>
      </RouterLink>
    </div>

    <RouterLink
      v-if="showEmptyCreateAction"
      :to="createRouteTarget"
      class="static-page-action-tile static-page-action-tile--inline"
      :data-testid="emptyCreateTestId"
    >
      {{ createLabel }}
    </RouterLink>
  </StaticPageSection>

  <RouterLink
    v-if="showCreateAction"
    :to="createRouteTarget"
    class="static-page-action-tile static-page-create-action"
    :data-testid="createTestId"
  >
    {{ createLabel }}
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import AppListPager from '../../components/ui/AppListPager.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'

interface SettingsRecordTile {
  key: string
  label: string
  to: RouteLocationRaw
  onClick?: () => void
}

const props = withDefaults(defineProps<{
  title: string
  tiles: SettingsRecordTile[]
  pageIndex: number
  pageCount: number
  pagerAriaLabel: string
  previousTestId: string
  nextTestId: string
  loading: boolean
  loadingNoun: string
  error: string | null
  emptyTitle: string
  listTestId: string
  tileTestId: string
  canCreate?: boolean
  createRoute?: RouteLocationRaw | null
  createLabel?: string
  createTestId?: string
  emptyCreateTestId?: string
}>(), {
  canCreate: false,
  createRoute: null,
  createLabel: 'Create',
  createTestId: 'settings-create-action',
  emptyCreateTestId: 'settings-empty-create-action',
})

const emit = defineEmits<{
  'update:pageIndex': [pageIndex: number]
}>()

const hasCreateRoute = computed(() => Boolean(props.createRoute))
const createRouteTarget = computed<RouteLocationRaw>(() => props.createRoute ?? '#')
const showEmptyCreateAction = computed(
  () => props.canCreate && hasCreateRoute.value && props.tiles.length === 0 && !props.loading && !props.error,
)
const showCreateAction = computed(() => props.canCreate && hasCreateRoute.value && props.tiles.length > 0)
</script>
