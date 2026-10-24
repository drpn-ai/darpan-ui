<template>
  <StaticPageFrame class="audit-page">
    <template #hero>
      <!-- DAR-UI-063. Play and the settings gear beside the name, where a long audit cannot push them out of sight. -->
      <div class="audit-hero-title">
        <h1>{{ report?.report.audit.name || 'Audit' }}</h1>
        <div class="action-row audit-hero-actions">
          <RouterLink
            :to="{ name: 'audit-run-start', params: { audit: auditCode }, query: carriedQuery }"
            class="app-icon-action app-icon-action--large"
            aria-label="Run audit"
            title="Run audit"
            data-testid="audit-run-button"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
            </svg>
          </RouterLink>
          <RouterLink
            :to="{ name: 'audit-settings', params: { audit: auditCode }, query: carriedQuery }"
            class="app-icon-action app-icon-action--large"
            aria-label="Audit settings"
            title="Audit settings"
            data-testid="audit-settings-button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path :d="settingsIconPath" />
            </svg>
          </RouterLink>
        </div>
      </div>
      <RunTypeBadge v-if="report" type="audit" :detail="report.report.period" />
      <p v-if="report" class="static-page-section-description" data-testid="audit-window">
        {{ shortRange(report.report.window.from, report.report.window.thru) }}<template v-if="readWindow"> · read {{ shortRange(readWindow.from, readWindow.thru) }}</template>
      </p>
    </template>

    <p v-if="loading" class="section-note">Loading audit...</p>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="audit-page-error" />

    <template v-if="report">
      <!-- DAR-UI-065. The counts are the filters: each pill keeps the statements it names. -->
      <div class="audit-toolbar">
        <div class="audit-filters" role="group" aria-label="Show">
          <button
            v-for="pill in pills"
            :key="pill.id"
            type="button"
            class="audit-filter"
            :class="{ 'audit-filter--on': pill.id === filter, 'audit-filter--empty': pill.id === 'notChecked' }"
            :aria-pressed="pill.id === filter ? 'true' : 'false'"
            :data-testid="`audit-filter-${pill.id}`"
            @click="chooseFilter(pill.id)"
          >
            <span class="audit-filter-count">{{ pill.count.toLocaleString('en-US') }}</span> <span>{{ pill.label }}</span>
          </button>
        </div>
        <p class="section-note audit-today" data-testid="audit-today">{{ todayLine }}</p>
        <!-- A header-row select keeps a fixed width, as the design system's run result screen holds it; on a
             phone it gives way rather than push the page past the screen. -->
        <div v-if="periods.length > 1" :style="{ width: 'min(13.75rem, 45vw)' }">
          <AppSelect
            :model-value="report.report.period"
            :options="periods.map((value) => ({ value, label: value }))"
            test-id="audit-period"
            @update:model-value="choosePeriod"
          />
        </div>
      </div>

      <AuditColumns
        :report="report"
        :category="selectedCategory"
        :statement="selectedStatement"
        :finding="findingId"
        :source="selectedSource"
        :filter="filter"
        :level="level"
        :finding-doc="finding"
        :finding-loading="findingLoading"
        :finding-error="findingError"
        @navigate="navigate"
      />
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import RunTypeBadge from '../../components/ui/RunTypeBadge.vue'
import AuditColumns from '../../components/audit/AuditColumns.vue'
import { auditFacade } from '../../lib/api/facade'
import { playIconPath, playIconTransform, settingsIconPath } from '../../lib/iconPaths'
import { WORKFLOW_HINT_REQUEST_EVENT, type WorkflowHintRequestDetail } from '../../lib/uiEvents'
import type { AuditFindingDocument, AuditReport } from '../../lib/api/auditTypes'
import { auditMorningQuery, periodOptions, shortRange } from '../../lib/auditReport'
import {
  AUDIT_FILTERS,
  HEALTH,
  defaultCategory,
  defaultSource,
  defaultStatement,
  filterCounts,
  isAuditFilter,
  sourceItems,
  type AuditFilter,
} from '../../lib/auditColumns'

// DAR-UI-058. The audit run's report for one morning, read from the same JSON GraphQL and the CLI serve
// (facade.AuditFacadeServices). The page adds no facts: every value is the document's. ?period, ?date and ?finding
// pick what it shows.
// DAR-UI-065. Drawn as drill-down columns; ?category, ?statement, ?source and ?show pick the columns. What the URL
// leaves out is picked by the rules in lib/auditColumns.

const route = useRoute()
const router = useRouter()

const report = ref<AuditReport | null>(null)
const loading = ref(false)
const pageError = ref('')
const finding = ref<AuditFindingDocument | null>(null)
const findingLoading = ref(false)
const findingError = ref('')

let abort = new AbortController()
onBeforeUnmount(() => abort.abort())

const auditCode = computed(() => String(route.params.audit ?? ''))
const findingId = computed(() => queryValue('finding'))
// The morning on show, handed to the run and settings pages so they return to it; an open finding is not.
const carriedQuery = computed(() => auditMorningQuery(route.query))

const periods = computed(() => periodOptions(report.value?.report.period, report.value?.report.date))
// DAR-UI-063. When every check this morning read the same days and they are not the period to date (a person played
// a range), say which: the window above is the period's, the findings are from those days.
const readWindow = computed(() => {
  const doc = report.value
  if (!doc) return null
  const windows = Object.values(doc.categories ?? {}).flatMap((category) =>
    Object.values(category.statements ?? {}).flatMap((statement) => statement.checks ?? []))
    .map((check) => check.window).filter((window): window is { from: string; thru: string } => Boolean(window))
  const distinct = [...new Set(windows.map((w) => `${w.from}|${w.thru}`))]
  if (distinct.length !== 1) return null
  const [from, thru] = distinct[0]!.split('|')
  return from === doc.report.window.from && thru === doc.report.window.thru ? null : { from: from!, thru: thru! }
})
function queryValue(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const filter = computed<AuditFilter>(() => {
  const value = queryValue('show')
  return isAuditFilter(value) ? value : 'all'
})
// A linked finding (?finding alone, as the CLI hands out) opens under its own category and statement.
const findingHome = computed(() => (findingId.value ? finding.value?.finding : null))
const selectedCategory = computed(() => {
  const doc = report.value
  if (!doc) return ''
  const asked = queryValue('category')
  if (asked === HEALTH || (asked && doc.categories?.[asked])) return asked
  const home = findingHome.value?.category.id
  if (home && doc.categories?.[home]) return home
  return defaultCategory(doc, filter.value)
})
const selectedStatement = computed(() => {
  const category = report.value?.categories?.[selectedCategory.value]
  if (!category) return ''
  const asked = queryValue('statement')
  if (asked && category.statements?.[asked]) return asked
  const home = findingHome.value?.statement.id
  if (home && category.statements?.[home]) return home
  return defaultStatement(category, filter.value)
})
const selectedSource = computed(() => {
  const doc = report.value
  if (!doc || selectedCategory.value !== HEALTH) return ''
  const asked = queryValue('source')
  return sourceItems(doc).some((item) => item.key === asked) ? asked : defaultSource(doc)
})
// The column a phone shows: the deepest one the URL names.
const level = computed(() => {
  if (findingId.value) return 4
  if (queryValue('statement') || (selectedCategory.value === HEALTH && queryValue('source'))) return 3
  return queryValue('category') ? 2 : 1
})

const FILTER_LABELS: Record<AuditFilter, string> = { open: 'open', pending: 'pending', notChecked: 'unchecked', all: 'all' }
const pills = computed(() => {
  const doc = report.value
  if (!doc) return []
  const counts = filterCounts(doc)
  return AUDIT_FILTERS.map((id) => ({ id, count: counts[id], label: FILTER_LABELS[id] }))
})
const todayLine = computed(() => {
  const summary = report.value?.summary
  if (!summary) return ''
  return [
    `${summary.newToday} new · ${summary.fixedToday} fixed today`,
    summary.oldestOpen ? `oldest ${summary.oldestOpen.statement}, ${summary.oldestOpen.ageDays}d` : '',
  ].filter(Boolean).join(' · ')
})

function errorOf(response: { errors?: string[] }, fallback: string): string {
  return response.errors?.[0] || fallback
}

async function loadReport(): Promise<void> {
  if (!auditCode.value) return
  abort.abort()
  abort = new AbortController()
  loading.value = true
  pageError.value = ''
  try {
    const response = await auditFacade.getAuditReport(
      { audit: auditCode.value, ...carriedQuery.value },
      abort.signal,
    )
    if (response.ok === false || !response.report) {
      report.value = null
      pageError.value = errorOf(response, 'The audit got lost on the way here. Send a search party.')
    } else {
      report.value = response.report
    }
  } catch {
    if (!abort.signal.aborted) pageError.value = 'The audit got lost on the way here. Send a search party.'
  } finally {
    loading.value = false
  }
}

async function loadFinding(): Promise<void> {
  finding.value = null
  findingError.value = ''
  if (!findingId.value) return
  findingLoading.value = true
  try {
    const response = await auditFacade.getAuditFinding({ findingId: findingId.value }, abort.signal)
    if (response.ok === false || !response.finding) findingError.value = errorOf(response, 'This finding is lost. Ironic, we know.')
    else finding.value = response.finding
  } catch {
    if (!abort.signal.aborted) findingError.value = 'This finding is lost. Ironic, we know.'
  } finally {
    findingLoading.value = false
  }
}

// Each pick is a step in the browser history, so Back walks up the columns.
function navigate(patch: Record<string, string | undefined>): void {
  void router.push({ query: { ...route.query, ...patch } })
}

// A new filter starts the columns over: the category and statement it lands on are the defaults for that filter.
function chooseFilter(next: AuditFilter): void {
  void router.replace({
    query: { ...route.query, show: next === 'all' ? undefined : next, category: undefined, statement: undefined, finding: undefined, source: undefined },
  })
}

function choosePeriod(period: string): void {
  void router.replace({ query: { ...route.query, period, finding: undefined } })
}

// DAR-UI-063. Arrived from play: the runs were submitted and finish in the background. Said once in the top pill,
// and consumed, so a reload does not say it again.
onMounted(() => {
  const state = window.history.state as Record<string, unknown> | null
  if (!state?.startedAudit) return
  window.history.replaceState({ ...state, startedAudit: false }, '')
  document.dispatchEvent(new CustomEvent<WorkflowHintRequestDetail>(WORKFLOW_HINT_REQUEST_EVENT, {
    detail: { message: 'Running. Findings arrive as each check finishes.', durationMs: 5000 },
  }))
})

// DAR-UI-068. One source per value, so a column pick (a new query object) does not count as a new morning.
watch([auditCode, () => route.query.date, () => route.query.period], () => void loadReport(), { immediate: true })
watch(findingId, () => void loadFinding(), { immediate: true })
</script>

<style scoped>
/* DAR-UI-065. Four columns need the workflow width; the hero and toolbar widen with them. */
.audit-page {
  --static-frame-width: var(--workflow-shell-width);
}

.audit-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.audit-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.audit-filter {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1-5);
  min-height: 2.75rem;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: var(--type-label-size);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.audit-filter--empty {
  border-style: dashed;
  border-color: var(--text-dim);
}

.audit-filter--on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.audit-filter-count {
  font-size: var(--type-tile-size);
}

.audit-today {
  margin-left: auto;
}

/* DAR-UI-063. The name with play and the settings gear on its right; they wrap under it on a phone. */
.audit-hero-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
</style>
