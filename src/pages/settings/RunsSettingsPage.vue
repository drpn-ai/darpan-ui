<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Run Editor</h1>
    </template>

    <SettingsRecordListSection
      title="Saved Runs"
      :tiles="recordTiles"
      :page-index="pageIndex"
      :page-count="pageCount"
      pager-aria-label="Saved run pages"
      previous-test-id="runs-page-previous"
      next-test-id="runs-page-next"
      :loading="loading"
      loading-message="Loading runs..."
      :error="error"
      empty-title="No runs"
      list-test-id="saved-runs"
      tile-test-id="run-tile"
      @update:page-index="goToPage"
    />
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import { buildRuleSetDraft, buildSavedRunEditorRoute, savedRunName } from '../../lib/savedRunEditorRoute'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import SettingsRecordListSection from './SettingsRecordListSection.vue'
import { useSettingsPagedList } from './useSettingsPagedList'
import { SETTINGS_LIST_KEYS } from '../../lib/api/queries'

const route = useRoute()
const draftStore = useReconciliationDraftStore()
const {
  rows,
  pageIndex,
  pageCount,
  loading,
  error,
  load,
  goToPage,
  dispose,
} = useSettingsPagedList({
  loadPage: (request) => reconciliationFacade.listSavedRuns({ ...request, query: '' }),
  selectRecords: (response) => response.savedRuns ?? [],
  fallbackErrorMessage: 'The runs are out for a jog.',
  cacheKey: SETTINGS_LIST_KEYS.runs,
})

onBeforeUnmount(() => {
  dispose()
})
const recordTiles = computed(() => rows.value.map((row) => {
  const ruleSetDraft = row.runType === 'ruleset' ? buildRuleSetDraft(row) : null
  return {
    key: row.savedRunId,
    label: savedRunName(row),
    to: buildSavedRunEditorRoute(row),
    onClick: ruleSetDraft ? () => { draftStore.setRuleSetDraft(ruleSetDraft, 'ruleset-manager') } : undefined,
  }
}))

onMounted(() => {
  draftStore.setWorkflowOrigin('Run Editor', route.fullPath || '/settings/runs')
  void load()
})
</script>
