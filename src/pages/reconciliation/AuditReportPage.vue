<template>
  <StaticPageFrame>
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
        {{ report.report.window.from }} to {{ report.report.window.thru }}<template v-if="readWindow"> · read {{ readWindow.from }} to {{ readWindow.thru }}</template>
      </p>
    </template>

    <p v-if="loading" class="section-note">Loading audit...</p>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="audit-page-error" />

    <template v-if="report">
      <StaticPageSection title="Health">
        <div class="static-page-summary-grid">
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Status</span>
            <span data-testid="audit-health"><StatusBadge :label="health.label" :tone="health.tone" /></span>
          </article>
          <article v-for="source in sources" :key="source.system" class="static-page-summary-card">
            <span class="static-page-summary-label">{{ source.system }}</span>
            <span :data-testid="`audit-source-${source.system}`">
              <StatusBadge :label="source.badge.label" :tone="source.badge.tone" />
              {{ source.records }}
            </span>
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Checks</span>
            <span data-testid="audit-checks">{{ checksLine }}</span>
          </article>
        </div>
        <p v-if="!report.health.complete" class="section-note" data-testid="audit-health-summary">{{ report.health.summary }}</p>
      </StaticPageSection>

      <StaticPageSection>
        <template #header>
          <div class="static-page-section-header-row">
            <h2 class="static-page-section-heading">Findings</h2>
            <!-- A header-row select keeps a fixed width, as the design system's run result screen holds it; on a
                 phone it gives way to the heading rather than push the page past the screen. -->
            <div v-if="periods.length > 1" :style="{ width: 'min(13.75rem, 45vw)' }">
              <AppSelect
                :model-value="report.report.period"
                :options="periods.map((value) => ({ value, label: value }))"
                test-id="audit-period"
                @update:model-value="choosePeriod"
              />
            </div>
          </div>
        </template>
        <div class="static-page-summary-grid">
          <article v-for="count in counts" :key="count.label" class="static-page-summary-card">
            <span class="static-page-summary-label">{{ count.label }}</span>
            <span :data-testid="`audit-count-${count.key}`">{{ count.value }}</span>
          </article>
          <article v-if="report.summary.oldestOpen" class="static-page-summary-card">
            <span class="static-page-summary-label">Oldest Open</span>
            <span data-testid="audit-oldest-open">
              {{ report.summary.oldestOpen.statement }} · {{ ageLabel(report.summary.oldestOpen.ageDays) }}
            </span>
          </article>
        </div>
      </StaticPageSection>

      <StaticPageSection v-for="category in categories" :key="category.id" :title="category.label">
        <AppTableFrame
          :columns="statementColumns"
          :rows="category.rows"
          row-key="id"
          :row-test-id="`audit-statement-row-${category.id}`"
          :row-action-label="(row) => `Show ${row.id}`"
          :expanded-row-keys="expandedStatements"
          @row-action="({ row }) => toggleStatement(String(row.id))"
        >
          <template #cell-status="{ row }">
            <StatusBadge :label="asStatement(row).badge.label" :tone="asStatement(row).badge.tone" />
          </template>
          <template #row-detail="{ row }">
            <!-- The section body's grid, so an opened statement reads like a small section. -->
            <div class="static-page-section-body" :data-testid="`audit-statement-detail-${row.id}`">
              <div>
                <!-- A statement's reason repeats its checks' own; it says something new only when it has none. -->
                <p v-if="!asStatement(row).statement.checks.length && asStatement(row).statement.reason" class="section-note">
                  {{ asStatement(row).statement.reason }}
                </p>
                <p v-for="check in asStatement(row).statement.checks" :key="check.id" class="section-note">
                  {{ check.label }} · {{ checkStatusBadge(check.status).label }}<template v-if="check.reason"> · {{ check.reason }}</template>
                </p>
              </div>
              <AppTableFrame
                v-if="asStatement(row).statement.findings.length"
                :columns="findingColumns"
                :rows="findingRowsOf(asStatement(row))"
                row-key="id"
                row-test-id="audit-finding-row"
                :row-action-label="(item) => `Open ${item.id}`"
                @row-action="({ row: item }) => openFinding(String(item.id))"
              >
                <template #cell-state="{ row: item }">
                  <StatusBadge :label="findingStateBadge(String(item.state)).label" :tone="findingStateBadge(String(item.state)).tone" />
                </template>
              </AppTableFrame>
              <div v-else class="static-page-drop-hint" :data-testid="`audit-statement-empty-${row.id}`">No findings</div>
              <p v-if="asStatement(row).statement.findingsOmitted" class="section-note">
                {{ asStatement(row).statement.findingsOmitted }} more
              </p>
            </div>
          </template>
        </AppTableFrame>
      </StaticPageSection>

      <StaticPageSection v-if="findingId" :title="`Finding · ${findingId}`">
        <p v-if="findingLoading" class="section-note">Loading finding...</p>
        <InlineValidation v-if="findingError" tone="error" :message="findingError" data-testid="audit-finding-error" />
        <template v-if="finding">
          <p ref="findingTop" class="section-note" data-testid="audit-finding-headline">{{ finding.finding.headline }}</p>
          <div class="static-page-summary-grid">
            <article class="static-page-summary-card">
              <span class="static-page-summary-label">State</span>
              <span><StatusBadge :label="findingStateBadge(finding.finding.status.state).label" :tone="findingStateBadge(finding.finding.status.state).tone" /></span>
            </article>
            <article class="static-page-summary-card">
              <span class="static-page-summary-label">Statement</span>
              <span>{{ finding.finding.statement.id }}</span>
            </article>
            <article class="static-page-summary-card">
              <span class="static-page-summary-label">First Found</span>
              <span>{{ finding.finding.status.firstFound }}</span>
            </article>
            <article class="static-page-summary-card">
              <span class="static-page-summary-label">Last Seen</span>
              <span>{{ finding.finding.status.lastSeen }}</span>
            </article>
          </div>
          <AppTableFrame :columns="recordColumns" :rows="findingRecords" row-key="key" row-test-id="audit-record-row" />
          <p v-if="finding.finding.fix.action" class="section-note" data-testid="audit-finding-fix">{{ finding.finding.fix.action }}</p>
          <AppTableFrame
            v-if="finding.finding.evidence.checks.length"
            :columns="evidenceColumns"
            :rows="finding.finding.evidence.checks.map((check, index) => ({ ...check, key: String(index), passed: check.passed ? 'Yes' : 'No' }))"
            row-key="key"
          />
          <AppTableFrame
            :columns="historyColumns"
            :rows="finding.finding.history.map((event, index) => ({ key: String(index), at: instantLabel(event.at), event: event.event, by: instantLabel(event.by.label || event.by.type) }))"
            row-key="key"
            row-test-id="audit-history-row"
          />
        </template>
      </StaticPageSection>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import RunTypeBadge from '../../components/ui/RunTypeBadge.vue'
import { auditFacade } from '../../lib/api/facade'
import { playIconPath, playIconTransform, settingsIconPath } from '../../lib/iconPaths'
import { WORKFLOW_HINT_REQUEST_EVENT, type WorkflowHintRequestDetail } from '../../lib/uiEvents'
import type { AuditFindingDocument, AuditReport } from '../../lib/api/auditTypes'
import {
  ageLabel,
  checkStatusBadge,
  instantLabel,
  findingStateBadge,
  healthBadge,
  periodOptions,
  recordIds,
  recordRows,
  sourceRows,
  statementRows,
  type StatementRow,
} from '../../lib/auditReport'

// DAR-UI-058. The audit run's report for one morning, read from the same JSON GraphQL and the CLI serve
// (facade.AuditFacadeServices). The page adds no facts: every value is the document's. ?period, ?date and ?finding
// pick what it shows.

const route = useRoute()
const router = useRouter()

const report = ref<AuditReport | null>(null)
const loading = ref(false)
const pageError = ref('')
const finding = ref<AuditFindingDocument | null>(null)
const findingLoading = ref(false)
const findingError = ref('')
const expandedStatements = ref<string[]>([])
const findingTop = ref<HTMLElement | null>(null)

let abort = new AbortController()
onBeforeUnmount(() => abort.abort())

const auditCode = computed(() => String(route.params.audit ?? ''))
const findingId = computed(() => (typeof route.query.finding === 'string' ? route.query.finding : ''))
// The morning on show, handed to the run and settings pages so they return to it; an open finding is not.
const carriedQuery = computed(() => {
  const query: Record<string, string> = {}
  for (const key of ['period', 'date']) {
    const value = route.query[key]
    if (typeof value === 'string' && value) query[key] = value
  }
  return query
})

const health = computed(() => (report.value ? healthBadge(report.value) : { label: '', tone: 'neutral' as const }))
const sources = computed(() => (report.value ? sourceRows(report.value) : []))
const checksLine = computed(() => {
  const checks = report.value?.health.checks
  if (!checks) return ''
  return [`${checks.ran} ran`, checks.partial ? `${checks.partial} partial` : '', checks.notRun ? `${checks.notRun} not run` : '']
    .filter(Boolean)
    .join(' · ')
})
const counts = computed(() => {
  const summary = report.value?.summary
  if (!summary) return []
  return [
    { key: 'open', label: 'Open', value: summary.open },
    { key: 'pending', label: 'Pending', value: summary.pending },
    { key: 'new', label: 'New Today', value: summary.newToday },
    { key: 'fixed', label: 'Fixed Today', value: summary.fixedToday },
  ]
})
const periods = computed(() => periodOptions(report.value?.report.period))
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
const categories = computed(() =>
  Object.entries(report.value?.categories ?? {}).map(([id, category]) => ({
    id,
    label: category.label,
    rows: statementRows(category.statements) as unknown as Array<Record<string, unknown>>,
  })),
)
const findingRecords = computed(() => recordRows(finding.value?.finding.records) as unknown as Array<Record<string, unknown>>)

const statementColumns = [
  { key: 'id', label: 'ID', colStyle: { width: '4.5rem' } },
  { key: 'text', label: 'Statement' },
  { key: 'status', label: 'Check', colStyle: { width: '8rem' } },
  { key: 'open', label: 'Open', colStyle: { width: '5.5rem' } },
  { key: 'pending', label: 'Pending', colStyle: { width: '6.5rem' } },
]
const findingColumns = [
  { key: 'headline', label: 'Finding' },
  { key: 'records', label: 'Records', colStyle: { width: '11rem' } },
  { key: 'state', label: 'State', colStyle: { width: '7.5rem' } },
  { key: 'firstFound', label: 'First Found', colStyle: { width: '8.5rem' } },
  { key: 'age', label: 'Age', colStyle: { width: '7rem' } },
]
const recordColumns = [
  { key: 'system', label: 'System', colStyle: { width: '8.5rem' } },
  { key: 'recordType', label: 'Record', colStyle: { width: '9rem' } },
  { key: 'id', label: 'ID' },
  { key: 'internalId', label: 'Internal ID', colStyle: { width: '9rem' } },
  { key: 'status', label: 'Status', colStyle: { width: '15rem' } },
]
const evidenceColumns = [
  { key: 'label', label: 'Check' },
  { key: 'value', label: 'Value' },
  { key: 'passed', label: 'Passed' },
]
const historyColumns = [
  { key: 'at', label: 'When', colStyle: { width: '17rem' } },
  { key: 'event', label: 'Event', colStyle: { width: '8rem' } },
  { key: 'by', label: 'By' },
]

/** AppTableFrame hands rows back as plain records; these rows are the statementRows they were built from. */
function asStatement(row: Record<string, unknown>): StatementRow {
  return row as unknown as StatementRow
}

function findingRowsOf(row: StatementRow): Array<Record<string, unknown>> {
  return row.statement.findings.map((item) => ({
    id: item.id,
    headline: item.headline,
    records: recordIds(item.records),
    state: item.state,
    firstFound: item.firstFound,
    age: ageLabel(item.ageDays),
  }))
}

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
      {
        audit: auditCode.value,
        ...(typeof route.query.date === 'string' ? { date: route.query.date } : {}),
        ...(typeof route.query.period === 'string' ? { period: route.query.period } : {}),
      },
      abort.signal,
    )
    if (response.ok === false || !response.report) {
      report.value = null
      pageError.value = errorOf(response, 'Unable to load audit.')
    } else {
      report.value = response.report
    }
  } catch {
    if (!abort.signal.aborted) pageError.value = 'Unable to load audit.'
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
    if (response.ok === false || !response.finding) findingError.value = errorOf(response, 'Unable to load finding.')
    else finding.value = response.finding
  } catch {
    if (!abort.signal.aborted) findingError.value = 'Unable to load finding.'
  } finally {
    findingLoading.value = false
  }
}

function toggleStatement(id: string): void {
  expandedStatements.value = expandedStatements.value.includes(id)
    ? expandedStatements.value.filter((key) => key !== id)
    : [...expandedStatements.value, id]
}

function openFinding(id: string): void {
  void router.replace({ query: { ...route.query, finding: id } })
}

function choosePeriod(period: string): void {
  void router.replace({ query: { ...route.query, period, finding: undefined } })
}

watch(() => [auditCode.value, route.query.date, route.query.period], () => void loadReport(), { immediate: true })
watch(findingId, () => void loadFinding(), { immediate: true })
// The finding opens below the categories: bring it to the reader when it appears, whether it was clicked or linked
// (a link loads it before the report it sits under).
watch(findingTop, (element) => element?.scrollIntoView?.({ block: 'start' }))

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
</script>

<style scoped>
/* DAR-UI-063. The name with play and the settings gear on its right; they wrap under it on a phone. */
.audit-hero-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
</style>
