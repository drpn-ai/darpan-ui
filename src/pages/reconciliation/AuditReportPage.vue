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
          <button
            v-if="report"
            type="button"
            class="app-icon-action app-icon-action--large"
            aria-label="Export report"
            title="Export report"
            data-testid="audit-export-report"
            @click="exportReport"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path :d="downloadIconPath" fill="currentColor" /></svg>
          </button>
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
      <p v-if="report" class="static-page-section-description" data-testid="audit-today">{{ todayLine }}</p>
    </template>

    <p v-if="loading" class="section-note">Loading audit...</p>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="audit-page-error" />
    <InlineValidation v-if="exportError" tone="error" :message="exportError" data-testid="audit-export-error" />
    <InlineValidation v-if="periodError" tone="error" :message="periodError" data-testid="audit-find-error" />

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
        <!-- DAR-UI-073. Search, cause and age narrow the whole board; the period's findings load on first use. -->
        <div class="audit-find" role="group" aria-label="Find" @focusin="void loadPeriodFindings()">
          <input
            v-model="searchText"
            type="search"
            class="audit-search"
            placeholder="Order or record id"
            aria-label="Search findings"
            data-testid="audit-search"
            @change="setFindingFilter('q', searchText.trim())"
          />
          <div class="audit-find-select">
            <AppSelect
              :model-value="findingFilters.cause" :options="causeSelectOptions" test-id="audit-cause"
              @update:model-value="(value: string) => setFindingFilter('cause', value)"
            />
          </div>
          <div class="audit-find-select audit-find-select--age">
            <AppSelect
              :model-value="findingFilters.age ? String(findingFilters.age) : ''" :options="AGE_OPTIONS" test-id="audit-age"
              @update:model-value="(value: string) => setFindingFilter('age', value)"
            />
          </div>
        </div>
        <!-- A header-row select keeps a fixed width, as the design system's run result screen holds it; on a
             phone it gives way rather than push the page past the screen. -->
        <div v-if="periods.length > 1" class="audit-period" :style="{ width: 'min(13.75rem, 45vw)' }">
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
        :more="more"
        :exporting="exporting"
        :narrowed="narrowed"
        :order-unit="orderUnit"
        :verifying="verifying"
        @navigate="navigate"
        @more="loadMore"
        @export="(what) => (what === 'finding' ? exportFinding() : void exportFindings())"
        @extract="(check, system) => void exportExtract(check, system)"
        @verify="verifyFinding"
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
import { auditFacade, reconciliationFacade } from '../../lib/api/facade'
import { ApiCallError } from '../../lib/api/client'
import { downloadIconPath, playIconPath, playIconTransform, settingsIconPath } from '../../lib/iconPaths'
import { downloadTextFile } from '../../lib/utils/download'
import { WORKFLOW_HINT_REQUEST_EVENT, type WorkflowHintRequestDetail } from '../../lib/uiEvents'
import type { AuditFindingDocument, AuditFindingListItem, AuditReport } from '../../lib/api/auditTypes'
import { auditMorningQuery, periodOptions, shortRange, systemLabel } from '../../lib/auditReport'
import {
  AUDIT_FILTERS,
  HEALTH,
  defaultCategory,
  defaultSource,
  defaultStatement,
  causeOptions,
  emptyFindingsMore,
  filterCounts,
  hasFindingFilters,
  matchesFindingFilters,
  orderKey,
  isAuditFilter,
  sourceItems,
  type AuditFilter,
  type FindingFilters,
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
const more = ref(emptyFindingsMore())
const exporting = ref(false)
const verifying = ref(false)
const exportError = ref('')

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

// DAR-UI-075. An order open in the detail: its row in the list (the report's, "more", or the filters' read). Its detail
// reads the stuck line's finding (else its first line's), whose fix and history are the order's.
const orderUnit = computed(() => {
  const id = findingId.value
  if (!id || !report.value) return null
  const listed = report.value.categories?.[selectedCategory.value]?.statements?.[selectedStatement.value]?.findings ?? []
  return [...listed, ...more.value.findings, ...(periodFindings.value?.items ?? [])]
    .find((item) => item.kind === 'order' && item.id === id) ?? null
})
// A line's finding is F-<n>; anything else names an order, read once the statement's orders are in.
const isLineId = (id: string) => /^F-\d+$/.test(id)
const findingTarget = computed(() => {
  if (!findingId.value || !report.value) return ''
  const unit = orderUnit.value
  if (unit) return unit.stuck?.[0] ?? unit.lines?.[0]?.id ?? ''
  return isLineId(findingId.value) ? findingId.value : ''
})

async function loadFinding(): Promise<void> {
  finding.value = null
  findingError.value = ''
  if (!findingTarget.value) return
  findingLoading.value = true
  try {
    const response = await auditFacade.getAuditFinding({ findingId: findingTarget.value }, abort.signal)
    if (response.ok === false || !response.finding) findingError.value = errorOf(response, 'This finding is lost. Ironic, we know.')
    else finding.value = response.finding
  } catch {
    if (!abort.signal.aborted) findingError.value = 'This finding is lost. Ironic, we know.'
  } finally {
    findingLoading.value = false
  }
}

// DAR-BE-123. Resolve: the finding's check runs again for its record alone, in the background; the
// finding is read again until its lastChecked moves, then the top pill says whether it closed.
const VERIFY_POLL_MS = 3000
const VERIFY_POLL_TRIES = 60
async function verifyFinding(): Promise<void> {
  // An order's finding is its stuck line's (F-n), never the order id in the URL.
  const id = findingTarget.value
  if (!id || verifying.value) return
  const before = finding.value?.finding.status.lastChecked ?? null
  verifying.value = true
  findingError.value = ''
  try {
    const started = await auditFacade.verifyAuditFinding({ findingId: id })
    if (!started.submitted) {
      findingError.value = 'The finding dodged the check. Try again.'
      return
    }
    for (let tries = 0; tries < VERIFY_POLL_TRIES && findingTarget.value === id; tries++) {
      await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_MS))
      const response = await auditFacade.getAuditFinding({ findingId: id })
      const doc = response.finding
      if (findingTarget.value !== id || !doc || doc.finding.status.lastChecked === before) continue
      finding.value = doc
      const closed = doc.finding.status.state === 'fixed'
      say(closed ? 'Resolved. The finding is closed.' : 'Still open. The cause above is from this check.')
      if (closed) void loadReport()
      return
    }
    if (findingTarget.value === id) say('Still checking. Reopen the finding in a minute.')
  } catch (error) {
    if (findingTarget.value === id) findingError.value = error instanceof ApiCallError ? error.message : 'The finding dodged the check. Try again.'
  } finally {
    verifying.value = false
  }
}

function say(message: string): void {
  document.dispatchEvent(new CustomEvent<WorkflowHintRequestDetail>(WORKFLOW_HINT_REQUEST_EVENT, {
    detail: { message, durationMs: 5000 },
  }))
}

// DAR-UI-070. The report lists 50 findings a statement; "N more" asks for the rest a page at a time.
async function loadMore(): Promise<void> {
  const statement = selectedStatement.value
  if (!report.value || !statement || more.value.loading) return
  more.value = { ...more.value, loading: true, error: '' }
  try {
    // DAR-UI-075. The rest as the report lists them, one per order, in one read.
    const response = await auditFacade.getAuditFindingsByOrder(
      { audit: auditCode.value, statement, period: report.value.report.period, ...pillState.value },
      abort.signal,
    )
    if (statement !== selectedStatement.value) return
    more.value = response.ok === false
      ? { ...more.value, error: errorOf(response, 'The findings could not be found. Yes, really.') }
      : { ...more.value, findings: response.findings ?? [], hasNextPage: false }
  } catch {
    if (!abort.signal.aborted) more.value = { ...more.value, error: 'The findings could not be found. Yes, really.' }
  } finally {
    more.value = { ...more.value, loading: false }
  }
}

// DAR-UI-073. The picked pill's state, sent with every findings page, so "more" and the export list what the board counts.
const pillState = computed<{ state?: 'open' | 'pending' }>(() =>
  filter.value === 'open' || filter.value === 'pending' ? { state: filter.value } : {})

// DAR-UI-073. The toolbar's filters: ?q (an order or record id), ?cause, ?age (at least N days). The report lists 50
// findings a statement and no cause, so a filter reads every open and pending finding of the period, once per morning,
// period and pill, and every column counts and lists what the filters leave.
const AGE_OPTIONS = [
  { value: '', label: 'Any age' },
  { value: '1', label: '1 day+' },
  { value: '7', label: '7 days+' },
  { value: '30', label: '30 days+' },
]
const findingFilters = computed<FindingFilters>(() => ({
  q: queryValue('q'),
  cause: queryValue('cause'),
  age: Number(queryValue('age')) || 0,
}))
const searchText = ref(queryValue('q'))
watch(() => route.query.q, () => (searchText.value = queryValue('q')))
const periodFindings = ref<{ key: string; items: AuditFindingListItem[] } | null>(null)
const periodError = ref('')
const periodKey = computed(() =>
  report.value ? `${auditCode.value}|${report.value.report.date}|${report.value.report.period}|${filter.value}` : '')
const narrowed = computed<AuditFindingListItem[] | null>(() => {
  if (!hasFindingFilters(findingFilters.value) || periodFindings.value?.key !== periodKey.value) return null
  return periodFindings.value.items.filter((item) => matchesFindingFilters(item, findingFilters.value))
})
const causeSelectOptions = computed(() => {
  const causes = causeOptions(periodFindings.value?.items ?? [])
  if (findingFilters.value.cause && !causes.includes(findingFilters.value.cause)) causes.push(findingFilters.value.cause)
  return [{ value: '', label: 'Any cause' }, ...causes.map((cause) => ({ value: cause, label: cause }))]
})
let periodLoading = ''

function setFindingFilter(key: keyof FindingFilters, value: string): void {
  void router.replace({ query: { ...route.query, [key]: value || undefined, finding: undefined } })
}

async function loadPeriodFindings(): Promise<void> {
  const key = periodKey.value
  if (!report.value || !key || periodFindings.value?.key === key || periodLoading === key) return
  const period = report.value.report.period
  periodLoading = key
  periodError.value = ''
  try {
    const response = await auditFacade.getAuditFindingsByOrder({ audit: auditCode.value, period, ...pillState.value }, abort.signal)
    if (response.ok === false) throw new Error(errorOf(response, 'The findings could not be found. Yes, really.'))
    const items: AuditFindingListItem[] = response.findings ?? []
    if (key === periodKey.value) periodFindings.value = { key, items }
  } catch (error) {
    if (!abort.signal.aborted) periodError.value = error instanceof Error ? error.message : 'The findings could not be found. Yes, really.'
  } finally {
    if (periodLoading === key) periodLoading = ''
  }
}

watch([() => hasFindingFilters(findingFilters.value), periodKey], ([on]) => { if (on) void loadPeriodFindings() }, { immediate: true })

// DAR-UI-072. JSON exports: the morning's report and the open finding as the page holds them; a statement's findings
// read every page (the report lists 50), each named with its order.
function saveJson(name: string, value: unknown): void {
  downloadTextFile(name, JSON.stringify(value, null, 2), 'application/json')
}

function exportReport(): void {
  if (report.value) saveJson(`${auditCode.value}-${report.value.report.date}.json`, report.value)
}

function exportFinding(): void {
  if (!finding.value) return
  // DAR-UI-075. An order: its lines as listed, with the stuck line's whole finding.
  if (orderUnit.value) saveJson(`${orderUnit.value.id}.json`, { ...orderUnit.value, stuckLine: finding.value })
  else saveJson(`${finding.value.finding.id}.json`, finding.value)
}

async function exportFindings(): Promise<void> {
  const statement = selectedStatement.value
  if (!report.value || !statement || exporting.value) return
  const period = report.value.report.period
  exporting.value = true
  exportError.value = ''
  try {
    const response = await auditFacade.getAuditFindingsByOrder({ audit: auditCode.value, statement, period, ...pillState.value }, abort.signal)
    if (response.ok === false) throw new Error(errorOf(response, 'The findings refused to leave the building. Nothing exported.'))
    const findings = response.findings ?? []
    saveJson(`${auditCode.value}-${period}-${statement}-findings.json`,
      { audit: auditCode.value, period, statement, findings: findings.map((item) => ({ ...item, order: item.order ?? orderKey(item) })) })
  } catch (error) {
    if (!abort.signal.aborted) exportError.value = error instanceof Error ? error.message : 'The findings refused to leave the building. Nothing exported.'
  } finally {
    exporting.value = false
  }
}

// What one system's read wrote for a check that morning: the automation run's own file, read as the run result page does.
async function exportExtract(check: string, system: string): Promise<void> {
  if (!report.value || exporting.value) return
  const { date, period } = report.value.report
  exporting.value = true
  exportError.value = ''
  try {
    const response = await auditFacade.getAuditCheckExtracts({ audit: auditCode.value, check, date, period }, abort.signal)
    if (response.ok === false) throw new Error(errorOf(response, 'The extract refused to leave the building. Nothing exported.'))
    const extract = (response.extracts ?? []).find((item) => item.system === system)
    if (!extract) throw new Error(`No ${systemLabel(system)} extract was kept for this run.`)
    const output = await reconciliationFacade.getGeneratedOutput({
      fileName: extract.filePath,
      format: extract.filePath.endsWith('.csv') ? 'csv' : 'json',
    })
    if (!output.outputFile?.contentText) throw new Error(errorOf(output, 'The extract refused to leave the building. Nothing exported.'))
    downloadTextFile(`${auditCode.value}-${date}-${check}-${system}.${extract.filePath.endsWith('.csv') ? 'csv' : 'json'}`,
      output.outputFile.contentText, output.outputFile.contentType || 'application/json')
  } catch (error) {
    if (!abort.signal.aborted) exportError.value = error instanceof Error ? error.message : 'The extract refused to leave the building. Nothing exported.'
  } finally {
    exporting.value = false
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
  say('Running. Findings arrive as each check finishes.')
})

// DAR-UI-068. One source per value, so a column pick (a new query object) does not count as a new morning.
watch([auditCode, () => route.query.date, () => route.query.period], () => void loadReport(), { immediate: true })
watch(findingTarget, () => void loadFinding(), { immediate: true })
watch([report, selectedStatement, filter], () => (more.value = emptyFindingsMore()))
// DAR-UI-075. An order the report does not list (past its 50: a reload, a link) is found in the statement's orders.
watch([findingId, report, selectedStatement], async () => {
  const id = findingId.value
  if (!id || !report.value || isLineId(id) || orderUnit.value) return
  if (more.value.hasNextPage !== false) await loadMore()
  if (findingId.value === id && !orderUnit.value && !more.value.error) findingError.value = `Finding ${id} has gone missing. We checked under every row.`
}, { immediate: true })
</script>

<style scoped>
/* DAR-UI-065. Four columns need the room. DAR-UI-074: the whole screen (the route is wide, so the shell keeps only its
   padding); the hero and toolbar widen with them. */
.audit-page {
  --static-frame-width: 100%;
}

.audit-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

/* DAR-UI-073. Search, cause and age beside the pills; the search box takes AppSelect's trigger look so the three read as
   one row, and the row wraps on a phone. */
.audit-find {
  /* One block: it moves to the next line whole rather than shrinking and splitting itself. */
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
}

/* The period leads the row: "2026-10 · 393 open … · search · cause · age", the day's note at the end. */
.audit-period {
  order: -1;
}

@media (max-width: 760px) {
  .audit-find {
    flex: 1 1 100%;
  }
}

.audit-search {
  width: min(13rem, 100%);
  min-height: 2.55rem;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
}

.audit-find-select {
  width: min(12.5rem, 45vw);
}

.audit-find-select--age {
  width: min(9rem, 40vw);
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

/* DAR-UI-063. The name with play and the settings gear on its right; they wrap under it on a phone. */
.audit-hero-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
</style>
