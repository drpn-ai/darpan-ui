<template>
  <StaticPageFrame>
    <template #hero>
      <h1>{{ report?.report.audit.name || 'Audit' }}</h1>
      <RunTypeBadge v-if="report" type="audit" :detail="report.report.period" />
      <p v-if="report" class="static-page-section-description" data-testid="audit-window">
        {{ report.report.window.from }} to {{ report.report.window.thru }}
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
            <AppSelect
              v-if="periods.length > 1"
              :model-value="report.report.period"
              :options="periods.map((value) => ({ value, label: value }))"
              test-id="audit-period"
              @update:model-value="choosePeriod"
            />
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
            <div :data-testid="`audit-statement-detail-${row.id}`">
              <p v-if="asStatement(row).statement.reason" class="section-note">{{ asStatement(row).statement.reason }}</p>
              <p v-for="check in asStatement(row).statement.checks" :key="check.id" class="section-note">
                {{ check.label }} · {{ checkStatusBadge(check.status).label }}<template v-if="check.reason"> · {{ check.reason }}</template>
              </p>
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
          <p class="section-note" data-testid="audit-finding-headline">{{ finding.finding.headline }}</p>
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
            <article class="static-page-summary-card">
              <span class="static-page-summary-label">Fix In</span>
              <span>{{ finding.finding.fix.where || '' }}</span>
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
            :rows="finding.finding.history.map((event, index) => ({ key: String(index), at: event.at, event: event.event, by: event.by.label || event.by.type }))"
            row-key="key"
            row-test-id="audit-history-row"
          />
        </template>
      </StaticPageSection>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import RunTypeBadge from '../../components/ui/RunTypeBadge.vue'
import { auditFacade } from '../../lib/api/facade'
import type { AuditFindingDocument, AuditReport } from '../../lib/api/auditTypes'
import {
  ageLabel,
  checkStatusBadge,
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

let abort = new AbortController()
onBeforeUnmount(() => abort.abort())

const auditCode = computed(() => String(route.params.audit ?? ''))
const findingId = computed(() => (typeof route.query.finding === 'string' ? route.query.finding : ''))

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
const categories = computed(() =>
  Object.entries(report.value?.categories ?? {}).map(([id, category]) => ({
    id,
    label: category.label,
    rows: statementRows(category.statements) as unknown as Array<Record<string, unknown>>,
  })),
)
const findingRecords = computed(() => recordRows(finding.value?.finding.records) as unknown as Array<Record<string, unknown>>)

const statementColumns = [
  { key: 'id', label: 'ID' },
  { key: 'text', label: 'Statement' },
  { key: 'status', label: 'Check' },
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
]
const findingColumns = [
  { key: 'headline', label: 'Finding' },
  { key: 'records', label: 'Records' },
  { key: 'state', label: 'State' },
  { key: 'firstFound', label: 'First Found' },
  { key: 'age', label: 'Age' },
]
const recordColumns = [
  { key: 'system', label: 'System' },
  { key: 'recordType', label: 'Record' },
  { key: 'id', label: 'ID' },
  { key: 'internalId', label: 'Internal ID' },
  { key: 'status', label: 'Status' },
]
const evidenceColumns = [
  { key: 'label', label: 'Check' },
  { key: 'value', label: 'Value' },
  { key: 'passed', label: 'Passed' },
]
const historyColumns = [
  { key: 'at', label: 'When' },
  { key: 'event', label: 'Event' },
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
</script>
