<template>
  <StaticPageFrame class="audit-page">
    <template #hero>
      <!-- DAR-UI-063. Play and the settings gear beside the name, where a long audit cannot push them out of sight. -->
      <div class="audit-hero-title">
        <h1>{{ report?.report.audit.name || 'Audit' }}</h1>
        <div class="action-row audit-hero-actions">
          <!-- DAR-UI-087. The period beside the actions, said once: the toolbar no longer repeats it. -->
          <div v-if="report && periods.length > 1" class="audit-period">
            <AppSelect
              :model-value="report.report.period"
              :options="periods.map((value) => ({ value, label: value }))"
              test-id="audit-period"
              @update:model-value="choosePeriod"
            />
          </div>
          <RouterLink
            v-if="canRun"
            :to="{ name: 'audit-run-start', params: { audit: auditCode }, query: carriedQuery }"
            class="app-icon-action app-icon-action--large"
            aria-label="Run audit"
            title="Run audit"
            data-testid="audit-run-button"
          >
            <AppIcon name="play" />
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
            <AppIcon name="download" />
          </button>
          <!-- DAR-UI-147. Re-check every open finding of the audit now; what was fixed since the morning closes. -->
          <button
            v-if="report && canRun"
            type="button"
            class="app-icon-action app-icon-action--large"
            aria-label="Re-check all findings"
            title="Re-check all findings"
            data-testid="audit-recheck-report"
            :disabled="rechecking"
            @click="recheckAll()"
          >
            <AppIcon name="recheck" />
          </button>
          <RouterLink
            :to="{ name: 'audit-settings', params: { audit: auditCode }, query: carriedQuery }"
            class="app-icon-action app-icon-action--large"
            aria-label="Audit settings"
            title="Audit settings"
            data-testid="audit-settings-button"
          >
            <AppIcon name="settings" />
          </RouterLink>
        </div>
      </div>
      <!-- DAR-UI-087. One line under the name: the type, the window, today's movement. -->
      <p v-if="report" class="static-page-section-description audit-hero-meta">
        <RunTypeBadge type="audit" :detail="periods.length > 1 ? undefined : report.report.period" />
        <span aria-hidden="true">·</span>
        <span data-testid="audit-window">{{ shortRange(report.report.window.from, report.report.window.thru) }}<template v-if="readWindow"> · read {{ shortRange(readWindow.from, readWindow.thru) }}</template></span>
        <span aria-hidden="true">·</span>
        <span data-testid="audit-today">{{ todayLine }}</span>
      </p>
    </template>

    <LoadingState v-if="loading" noun="audit" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="audit-page-error" />
    <InlineValidation v-if="exportError" tone="error" :message="exportError" data-testid="audit-export-error" />
    <InlineValidation v-if="recheckError" tone="error" :message="recheckError" data-testid="audit-recheck-error" />
    <InlineValidation v-if="periodError" tone="error" :message="periodError" data-testid="audit-find-error" />

    <template v-if="report">
      <!-- DAR-UI-065. The counts are the filters: each pill keeps the statements it names. -->
      <div class="audit-toolbar">
        <div class="audit-filters" role="group" aria-label="Show">
          <!-- DAR-UI-087. Open and all count findings; "not checked" counts statements, so it stands apart. -->
          <button
            v-for="pill in pills"
            :key="pill.id"
            type="button"
            class="audit-filter"
            :class="{ 'audit-filter--on': pill.id === filter, 'audit-filter--empty': pill.id === 'notChecked', 'audit-filter--apart': pill.id === 'notChecked' }"
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
      </div>

      <AuditColumns
        :report="boardReport ?? report"
        :category="selectedCategory"
        :statement="selectedStatement"
        :finding="findingId"
        :source="selectedSource"
        :filter="filter"
        :by="by"
        :level="level"
        :finding-doc="finding"
        :finding-loading="findingLoading"
        :finding-error="findingError"
        :more="boardMore"
        :exporting="exporting"
        :narrowed="narrowed"
        :cause="findingFilters.cause"
        :order-unit="orderUnit"
        :waiting="waiting"
        :verifying="verifying"
        :rechecking="rechecking"
        :progress="progress"
        :retryable="isTodaysMorning && canRun"
        :retrying="retryingChecks"
        :can-resolve="canRun"
        :agent="agentOn"
        :agent-open="agentOpen"
        :drafts="drafts"
        :me="me"
        @navigate="navigate"
        @by="chooseBy"
        @export="(what) => (what === 'finding' ? exportFinding() : void exportFindings())"
        @extract="(check, system) => void exportExtract(check, system)"
        @verify="verifyFinding"
        @recheck="(statement) => void recheckAll(statement)"
        @retry="retryCheck"
        @agent="setAgentTab"
        @acknowledging="onAcknowledging"
        @acknowledged="(id: string, seq: number) => void onAcknowledged(id, seq)"
        @ack-failed="onAckFailed"
      >
        <!-- DAR-UI-108. The agent, in the Agent tab of the board's deepest column; DAR-UI-145: or beside it, on a wide window.
             The card is the open finding, pinned when the agent covers it. -->
        <template #agent="{ card }">
          <AuditAgentPanel
            :card="card"
            :key="`${report.report.tenant.id}:${auditCode}`"
            :audit-code="auditCode"
            :tenant-id="report.report.tenant.id"
            :finding-id="findingTarget"
            :statement="selectedStatement"
            :audit-name="report.report.audit.name"
            :can-approve="agentStatus?.canApprove === true"
            @preview="(next) => (draftPreviews = next)"
            @applied="loadReport({ quiet: true })"
          />
        </template>
      </AuditColumns>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import RunTypeBadge from '../../components/ui/RunTypeBadge.vue'
import AuditColumns from '../../components/audit/AuditColumns.vue'
import AuditAgentPanel from '../../components/audit/AuditAgentPanel.vue'
import { agentFacade, auditFacade, reconciliationFacade } from '../../lib/api/facade'
import { usePermissionsStore } from '../../stores/permissions'
import { useAuthStore } from '../../stores/auth'
import { useMascotStore } from '../../stores/mascot'
import type { GetAgentStatusResponse } from '../../lib/api/agentTypes'
import { boardDrafts, type DraftPreview } from '../../lib/agentDrafts'
import { ApiCallError } from '../../lib/api/client'
import { downloadTextFile } from '../../lib/utils/download'
import { WORKFLOW_HINT_REQUEST_EVENT, type WorkflowHintRequestDetail } from '../../lib/uiEvents'
import { AUDIT_LEVELS, type AuditAcknowledgement, type AuditFindingDocument, type AuditFindingListItem, type AuditLevel, type AuditProgress, type AuditReport } from '../../lib/api/auditTypes'
import { auditMorningQuery, periodOptions, shortRange, systemLabel } from '../../lib/auditReport'
import {
  HEALTH,
  defaultCategory,
  defaultSource,
  defaultStatement,
  causeOptions,
  emptyFindingsMore,
  withAckPatches,
  withAckRows,
  type AckPatch,
  filterCounts,
  findStatement,
  findingsLeft,
  hasFindingFilters,
  holdsFinding,
  matchesFindingFilters,
  orderKey,
  isAuditFilter,
  sourceItems,
  statementItemsByPriority,
  tenantToday,
  topLevel,
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
/** DAR-UI-140. A linked order the report does not list, read from the statement's orders at every level. */
const orderLookup = ref<{ key: string; items: AuditFindingListItem[]; error: string } | null>(null)
const exporting = ref(false)
const verifying = ref(false)
// DAR-UI-147. A Re-check all in flight (statement or whole audit): one at a time.
const rechecking = ref(false)
const recheckError = ref('')
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
  // DAR-BE-206. A finding is open or fixed; a link from before still saying ?show=pending opens on open.
  if (value === 'pending') return 'open'
  return isAuditFilter(value) ? value : 'all'
})
// DAR-UI-140. Record type (today's rail) or priority, picked in column 1's head. ?by= wins and is not remembered (a shared
// link must not change the reader's own default); the switch remembers the person's pick. In priority mode ?category=
// holds the level.
type AuditBy = 'type' | 'priority'
const BY_STORAGE_KEY = 'darpan.audit.by'
const isAuditBy = (value: unknown): value is AuditBy => value === 'type' || value === 'priority'
function readStoredBy(): AuditBy {
  try {
    const value = window.localStorage.getItem(BY_STORAGE_KEY)
    return isAuditBy(value) ? value : 'type'
  } catch {
    return 'type'
  }
}
const storedBy = ref<AuditBy>(readStoredBy())
const isLevel = (value: string): value is AuditLevel => (AUDIT_LEVELS as readonly string[]).includes(value)
const by = computed<AuditBy>(() => {
  const asked = queryValue('by')
  if (isAuditBy(asked)) return asked
  // A link from before the switch names a record type and no ?by=: it keeps its meaning under a remembered Priority.
  const category = queryValue('category')
  return category && category !== HEALTH && !isLevel(category) ? 'type' : storedBy.value
})
/** The level priority mode opens on: the most urgent with an open finding, else P0. */
function defaultLevel(doc: AuditReport): AuditLevel {
  return topLevel(doc.summary)?.level ?? 'P0'
}

// A linked finding (?finding alone, as the CLI hands out) opens under its own category and statement.
const findingHome = computed(() => (findingId.value ? finding.value?.finding : null))
/** DAR-UI-140. By priority, the level a link that names none opens on (an email card's ?statement, a Run health row, a
 *  copied record-type link): the open unit's own level (an order's, never its line's), else the open finding's own, else
 *  the statement's most urgent, else null. Reads the lists directly, not orderUnit: that reads the statement on show, which reads the level. */
const linkedLevel = computed<AuditLevel | null>(() => {
  const doc = report.value
  if (!doc) return null
  const statement = queryValue('statement') || findingHome.value?.statement.id || ''
  const found = statement ? findStatement(doc, statement)?.statement : null
  const id = findingId.value
  if (id) {
    const unit = [...(found?.findings ?? []), ...more.value.findings, ...(orderLookup.value?.items ?? []), ...(periodFindings.value?.items ?? [])]
      .find((item) => holdsFinding(item, id))
    if (unit?.priority) return unit.priority
  }
  return findingHome.value?.priority?.level ?? topLevel(found?.counts)?.level ?? null
})
const selectedCategory = computed(() => {
  const doc = report.value
  if (!doc) return ''
  const asked = queryValue('category')
  if (by.value === 'priority') {
    if (asked === HEALTH || isLevel(asked)) return asked
    return linkedLevel.value ?? defaultLevel(doc)
  }
  if (asked === HEALTH || (asked && doc.categories?.[asked])) return asked
  const home = findingHome.value?.category.id
  if (home && doc.categories?.[home]) return home
  return defaultCategory(doc, filter.value)
})
/** DAR-UI-140. The level on show in priority mode; null by record type and on Run health. */
const pickedLevel = computed<AuditLevel | null>(() =>
  (by.value === 'priority' && isLevel(selectedCategory.value) ? selectedCategory.value : null))
const selectedStatement = computed(() => {
  const doc = report.value
  if (!doc) return ''
  const asked = queryValue('statement')
  const home = findingHome.value?.statement.id
  const level = pickedLevel.value
  if (level) {
    // Statements across record types: any the report has opens, as a link may name one with nothing at this level.
    if (asked && findStatement(doc, asked)) return asked
    if (home && findStatement(doc, home)) return home
    const items = statementItemsByPriority(doc, level, filter.value)
    return (items.find((item) => item.open) ?? items[0])?.id ?? ''
  }
  const category = doc.categories?.[selectedCategory.value]
  if (!category) return ''
  if (asked && category.statements?.[asked]) return asked
  if (home && category.statements?.[home]) return home
  return defaultStatement(category, filter.value)
})
// The statement on show, wherever it sits: its category by record type, any category by priority.
const statementDoc = computed(() => {
  const doc = report.value
  if (!doc || !selectedStatement.value) return null
  return pickedLevel.value ? (findStatement(doc, selectedStatement.value)?.statement ?? null)
    : (doc.categories?.[selectedCategory.value]?.statements?.[selectedStatement.value] ?? null)
})
const selectedSource = computed(() => {
  const doc = report.value
  if (!doc || selectedCategory.value !== HEALTH) return ''
  const asked = queryValue('source')
  return sourceItems(doc, progress.value).some((item) => item.key === asked) ? asked : defaultSource(doc, progress.value)
})
// The column a phone shows: the deepest one the URL names.
const level = computed(() => {
  if (findingId.value) return 4
  if (queryValue('statement') || (selectedCategory.value === HEALTH && queryValue('source'))) return 3
  return queryValue('category') ? 2 : 1
})

const FILTER_LABELS: Record<AuditFilter, string> = { open: 'open', acknowledged: 'acknowledged', notChecked: 'not checked', all: 'all' }
// DAR-UI-087. The finding pills first, then the statements' one, as the left column words it.
const PILL_ORDER: AuditFilter[] = ['open', 'acknowledged', 'all', 'notChecked']
const pills = computed(() => {
  const doc = boardReport.value
  if (!doc) return []
  const counts = filterCounts(doc)
  return PILL_ORDER.map((id) => ({ id, count: counts[id], label: FILTER_LABELS[id] }))
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
const FINDINGS_LOST = 'The findings could not be found. Yes, really.'

// quiet (DAR-UI-085): a refresh while a play runs keeps the page on screen and keeps the last report if it fails.
/** True when the report was read (DAR-UI-155: a pending acknowledgement waits for one). */
async function loadReport(options: { quiet?: boolean } = {}): Promise<boolean> {
  if (!auditCode.value) return false
  abort.abort()
  abort = new AbortController()
  if (!options.quiet) {
    loading.value = true
    pageError.value = ''
  }
  try {
    const response = await auditFacade.getAuditReport(
      { audit: auditCode.value, ...carriedQuery.value },
      abort.signal,
    )
    if (response.ok === false || !response.report) {
      if (options.quiet) return false
      report.value = null
      pageError.value = errorOf(response, 'The audit got lost on the way here. Send a search party.')
    } else {
      report.value = response.report
      // DAR-UI-143. The list moved under an open finding: read the finding too, so the row and the detail agree.
      if (options.quiet) void loadFinding({ quiet: true })
      return true
    }
  } catch {
    if (!abort.signal.aborted && !options.quiet) pageError.value = 'The audit got lost on the way here. Send a search party.'
  } finally {
    if (!options.quiet) loading.value = false
  }
  return false
}

// DAR-UI-085. What the checks are doing right now, for Run health. Read when the audit opens, then every 10 s while any
// check is in flight (and for two minutes after a play is submitted, before its runs show). A failed read leaves the
// page as it was: progress is a view of the run, never a reason to hide the report.
const PROGRESS_POLL_MS = 10_000
const PLAY_WATCH_MS = 120_000
const progress = ref<AuditProgress | null>(null)
let progressAbort = new AbortController()
let progressTimer: ReturnType<typeof setTimeout> | undefined
let watchPlayUntil = 0

async function loadProgress(): Promise<void> {
  if (!auditCode.value) return
  progressAbort.abort()
  progressAbort = new AbortController()
  const before = progress.value?.activeChecks ?? 0
  try {
    const response = await auditFacade.getAuditProgress({ audit: auditCode.value }, progressAbort.signal)
    if (response.ok === false || !response.progress) return
    progress.value = response.progress
    // A check finished: its ledger row and findings are in the report now.
    if (response.progress.activeChecks < before) void loadReport({ quiet: true })
  } catch {
    // Aborted or unreachable: try again on the next tick if one is due.
  } finally {
    scheduleProgress()
  }
}

// DAR-BE-292: play, Retry and Resolve are the run tier's (tenant user, editor, tenant admin); view-only sees none of them.
const permissionsStore = usePermissionsStore()
const canRun = computed(() => permissionsStore.canRunActiveTenantReconciliation)
// DAR-UI-086. "Retry from last read" is offered on today's morning only: a retry runs now, so it reports on today.
const retryingChecks = ref<string[]>([])
const isTodaysMorning = computed(() => {
  const doc = report.value?.report
  return Boolean(doc?.running) && doc!.date === tenantToday(doc!.tenant.timeZone || 'UTC')
})

// DAR-UI-087. A family row on Run health retries each of its stores that did not run, one after another.
async function retryCheck(checks: string[]): Promise<void> {
  const doc = report.value?.report
  if (!doc || retryingChecks.value.length || !checks.length) return
  retryingChecks.value = checks
  // DAR-UI-156: says so and starts watching at once; the submits answer behind, and only a refusal speaks again.
  say('Retrying from the last read. Nothing is read again.')
  watchPlayUntil = Date.now() + PLAY_WATCH_MS
  try {
    for (const check of checks) {
      const response = await auditFacade.retryAuditCheck({ audit: auditCode.value, check, date: doc.date, period: doc.period })
      if (response.ok === false || !response.submitted) {
        say(errorOf(response, 'The check would not go again. Try a play instead.'))
        return
      }
    }
    void loadProgress()
  } catch (err) {
    say(err instanceof Error && err.message ? err.message : 'The check would not go again. Try a play instead.')
  } finally {
    retryingChecks.value = []
  }
}

// A check is in flight, or a play was just submitted and its runs may not show yet.
function playInFlight(): boolean {
  return (progress.value?.activeChecks ?? 0) > 0 || Date.now() < watchPlayUntil
}

function scheduleProgress(): void {
  clearTimeout(progressTimer)
  if (!playInFlight()) return
  progressTimer = setTimeout(() => {
    if (document.hidden) scheduleProgress()
    else void loadProgress()
  }, PROGRESS_POLL_MS)
}

onBeforeUnmount(() => {
  progressAbort.abort()
  clearTimeout(progressTimer)
})

// DAR-UI-075. An order open in the detail: its row in the list (the report's, "more", or the filters' read). Its detail
// reads the stuck line's finding (else its first open line's), whose fix and history are the order's. DAR-UI-081 (Aditi:
// "remove the click and detail page"): a line has no page of its own; its finding id opens its order.
const listedRows = computed(() => withAckRows([...(statementDoc.value?.findings ?? []), ...more.value.findings,
  ...(orderLookup.value?.items ?? []), ...(periodFindings.value?.items ?? [])], ackPatches.value))
const orderUnit = computed(() => {
  const id = findingId.value
  if (!id || !report.value) return null
  return listedRows.value
    .find((item) => item.kind === 'order' && holdsFinding(item, id)) ?? null
})
// DAR-BE-250. The open finding's row (an order or a lone finding): what later steps report on the same order.
const waiting = computed(() => {
  const id = findingId.value
  if (!id || !report.value) return []
  return listedRows.value.find((item) => holdsFinding(item, id))?.waiting ?? []
})
// DAR-UI-143. A finding's state as the list says it: its line's on an order row, else its own row's.
function listedState(id: string): string | undefined {
  if (orderUnit.value) return orderUnit.value.lines?.find((line) => line.id === id)?.state
  return listedRows.value.find((item) => item.id === id)?.state
}
// A line's finding is F-<n>; anything else names an order, read once the statement's orders are in.
const isLineId = (id: string) => /^F-\d+$/.test(id)
const findingTarget = computed(() => {
  if (!findingId.value || !report.value) return ''
  const unit = orderUnit.value
  // DAR-UI-118: the morning's report keeps lines fixed that day, so an open order opens an open line.
  if (unit) return unit.stuck?.[0] ?? (unit.lines?.find((line) => line.state === 'open') ?? unit.lines?.[0])?.id ?? ''
  return isLineId(findingId.value) ? findingId.value : ''
})

// DAR-UI-143. Its own abort: a quiet report refresh mid-run aborted the shared one and left the detail blank.
let findingAbort = new AbortController()
onBeforeUnmount(() => findingAbort.abort())
// quiet: a re-read under an open finding keeps it on screen and keeps it if the read fails. A fresh read that disagrees
// with its row while a play runs reads the report again (once: that refresh's re-read is quiet and asks for no more).
async function loadFinding(options: { quiet?: boolean } = {}): Promise<void> {
  findingAbort.abort()
  const controller = (findingAbort = new AbortController())
  const id = findingTarget.value
  if (!options.quiet) {
    finding.value = null
    findingError.value = ''
  }
  if (!id) return
  if (!options.quiet) findingLoading.value = true
  try {
    const response = await auditFacade.getAuditFinding({ findingId: id }, controller.signal)
    if (controller.signal.aborted) return
    if (response.ok === false || !response.finding) {
      if (!options.quiet) findingError.value = errorOf(response, 'This finding is lost. Ironic, we know.')
      return
    }
    finding.value = response.finding
    findingError.value = ''
    const listed = listedState(id)
    if (!options.quiet && playInFlight() && listed && listed !== response.finding.finding.status.state) void loadReport({ quiet: true })
  } catch {
    if (!controller.signal.aborted && !options.quiet) findingError.value = 'This finding is lost. Ironic, we know.'
  } finally {
    if (controller === findingAbort) findingLoading.value = false
  }
}

// DAR-BE-123. Resolve: the finding's check runs again for its record alone, in the background; the
// finding is read again until its lastChecked moves, then the top pill says whether it closed.
const VERIFY_POLL_MS = 3000
const VERIFY_POLL_TRIES = 60
// DAR-UI-116. Leaving the page ends the wait: a page left mid-Resolve kept reading the finding every 3 s for up to
// three minutes and could say "Resolved" over whatever page came next.
let left = false
onBeforeUnmount(() => { left = true })
async function verifyFinding(): Promise<void> {
  // An order's finding is its stuck line's (F-n), never the order id in the URL.
  const id = findingTarget.value
  if (!id || verifying.value) return
  const watching = () => !left && findingTarget.value === id
  const before = finding.value?.finding.status.lastChecked ?? null
  verifying.value = true
  findingError.value = ''
  try {
    const started = await auditFacade.verifyAuditFinding({ findingId: id })
    if (!started.submitted) {
      findingError.value = 'The finding dodged the check. Try again.'
      return
    }
    for (let tries = 0; tries < VERIFY_POLL_TRIES && watching(); tries++) {
      await new Promise((resolve) => setTimeout(resolve, VERIFY_POLL_MS))
      if (!watching()) return
      const response = await auditFacade.getAuditFinding({ findingId: id })
      const doc = response.finding
      if (!watching() || !doc || doc.finding.status.lastChecked === before) continue
      finding.value = doc
      const closed = doc.finding.status.state === 'fixed'
      say(closed ? 'Resolved. The finding is closed.' : 'Still open. The cause above is from this check.')
      if (closed) void loadReport()
      return
    }
    if (watching()) say('Still checking. Reopen the finding in a minute.')
  } catch (error) {
    if (watching()) findingError.value = error instanceof ApiCallError ? error.message : 'The finding dodged the check. Try again.'
  } finally {
    verifying.value = false
  }
}

// DAR-UI-147 (Aditi: "maybe we can do a button that refreshes findings?"). Re-check all: the statement's open findings, or
// the audit's, read again now (verify#AuditFindings, one run per automation); wait until each was checked, then say what
// closed and reload. A finding whose read does not finish is never counted, so the wait ends at five minutes.
const RECHECK_POLL_MS = 3000
const RECHECK_POLL_TRIES = 100
async function recheckAll(statement?: string): Promise<void> {
  const period = report.value?.report.period
  if (!period || rechecking.value) return
  const audit = auditCode.value
  const scope = statement ? { statement } : {}
  const watching = () => !left && auditCode.value === audit && report.value?.report.period === period
  rechecking.value = true
  recheckError.value = ''
  try {
    const started = await auditFacade.verifyAuditFindings({ audit, period, ...scope })
    const total = started.findings ?? 0
    if (!total || !started.checkedSince) {
      say(started.skipped ? 'Nothing to re-check until the audit has run once.' : 'Nothing open to re-check.')
      return
    }
    let closed = 0
    for (let tries = 0; tries < RECHECK_POLL_TRIES && watching(); tries++) {
      await new Promise((resolve) => setTimeout(resolve, RECHECK_POLL_MS))
      if (!watching()) return
      const tally = await auditFacade.getAuditRecheckProgress({ audit, period, ...scope, since: started.checkedSince })
      closed = tally.closed ?? 0
      if ((tally.checked ?? 0) >= total) {
        say(closed >= total ? `Re-checked ${total}. All ${total} closed.` : `Re-checked ${total}. ${closed} closed, ${total - closed} still open.`)
        void loadReport({ quiet: true })
        return
      }
    }
    if (watching()) {
      say(`${closed} closed so far. The rest are still being checked.`)
      void loadReport({ quiet: true })
    }
  } catch (error) {
    if (watching()) recheckError.value = error instanceof ApiCallError ? error.message : 'The re-check did not start. Try again.'
  } finally {
    rechecking.value = false
  }
}

function say(message: string): void {
  document.dispatchEvent(new CustomEvent<WorkflowHintRequestDetail>(WORKFLOW_HINT_REQUEST_EVENT, {
    detail: { message, durationMs: 5000 },
  }))
}

// DAR-UI-070. The report lists 50 findings a statement; the rest are read in one call. DAR-UI-091 (Aditi: "all results
// loaded... no '119 more'"): read as soon as the statement shows, so its cause counts are whole. A second caller waits
// on the read in flight for the same statement and pill; another statement starts its own.
let moreLoading: { key: string; read: Promise<void> } | null = null
function loadMore(): Promise<void> {
  const key = `${selectedStatement.value}|${filter.value}|${pickedLevel.value ?? ''}`
  if (moreLoading?.key !== key) {
    const read = readMore().finally(() => { if (moreLoading?.read === read) moreLoading = null })
    moreLoading = { key, read }
  }
  return moreLoading.read
}
async function readMore(): Promise<void> {
  const statement = selectedStatement.value
  const pill = filter.value
  const level = pickedLevel.value
  if (!report.value || !statement) return
  // A read for a statement, pill or level no longer on show leaves the current one's state alone.
  const stale = () => statement !== selectedStatement.value || pill !== filter.value || level !== pickedLevel.value
  more.value = { ...more.value, loading: true, error: '' }
  try {
    // DAR-UI-075. The rest as the report lists them, one per order, in one read. DAR-UI-140: at the level on show.
    const response = await readOrders(report.value.report.period, statement, level)
    if (stale()) return
    more.value = response.ok === false
      ? { ...more.value, error: errorOf(response, FINDINGS_LOST) }
      : { ...more.value, findings: response.findings ?? [], hasNextPage: false }
  } catch {
    if (!abort.signal.aborted && !stale()) more.value = { ...more.value, error: FINDINGS_LOST }
  } finally {
    if (!stale()) more.value = { ...more.value, loading: false }
  }
}

// DAR-UI-073. The picked pill's state, sent with every findings page, so "more" and the export list what the board counts.
// DAR-UI-144. Open excludes acknowledged rows; the acknowledged pill lists only those; all lists both.
const pillState = computed<{ state?: 'open' | 'acknowledged' }>(() =>
  filter.value === 'open' || filter.value === 'acknowledged' ? { state: filter.value } : {})
/** Every finding of the period under the pill, one per order: a statement's when named, at a level when named. */
function readOrders(period: string, statement?: string, level?: AuditLevel | null) {
  return auditFacade.getAuditFindingsByOrder({
    audit: auditCode.value, period, ...(statement ? { statement } : {}), ...pillState.value, ...(level ? { priority: level } : {}),
  }, abort.signal)
}

// DAR-UI-073. The toolbar's filters: ?q (an order or record id), ?cause, ?age (at least N days). The report lists 50
// findings a statement and no cause, so a filter reads every open finding of the period, once per morning,
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
  return withAckRows(periodFindings.value.items.filter((item) => matchesFindingFilters(item, findingFilters.value)), ackPatches.value)
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

async function loadPeriodFindings(options: { force?: boolean } = {}): Promise<void> {
  const key = periodKey.value
  if (!report.value || !key || (!options.force && periodFindings.value?.key === key) || periodLoading === key) return
  const period = report.value.report.period
  periodLoading = key
  periodError.value = ''
  try {
    const response = await readOrders(period)
    if (response.ok === false) throw new Error(errorOf(response, FINDINGS_LOST))
    const items: AuditFindingListItem[] = response.findings ?? []
    if (key === periodKey.value) periodFindings.value = { key, items }
  } catch (error) {
    if (!abort.signal.aborted) periodError.value = error instanceof Error ? error.message : FINDINGS_LOST
  } finally {
    if (periodLoading === key) periodLoading = ''
  }
}

watch([() => hasFindingFilters(findingFilters.value), periodKey], ([on]) => { if (on) void loadPeriodFindings() }, { immediate: true })

// DAR-UI-155 (Aditi: "UI changes should always be immediate.. backend can do its thing"). An acknowledgement set on the
// board shows at once: its row moves between Open and Acknowledged and the counts with it, from a patch over what the
// backend last said. The patch stays until the reads after its save land (so a quiet reload mid-save cannot put the row
// back), and goes at once if the backend refuses it.
const auth = useAuthStore()
const mascot = useMascotStore()
const me = computed(() => (auth.userId ? { id: auth.userId, label: auth.sessionInfo?.displayName ?? auth.userId } : null))
// Each patch carries the number of the save that set it, so a save's answer only ever settles its own patch.
const ackPatches = ref<ReadonlyMap<string, AckPatch & { version: number }>>(new Map())
const boardReport = computed(() => (report.value ? withAckPatches(report.value, ackPatches.value) : null))
const boardMore = computed(() => (ackPatches.value.size ? { ...more.value, findings: withAckRows(more.value.findings, ackPatches.value) } : more.value))

function onAcknowledging(id: string, acknowledgement: AuditAcknowledgement | null, was: AuditAcknowledgement | null, seq: number): void {
  if (!report.value) return
  // A second change before the first is saved keeps the first's starting point.
  const held = ackPatches.value.get(id)
  const unit = listedRows.value.find((item) => holdsFinding(item, id))
  const next = new Map(ackPatches.value)
  next.set(id, {
    statement: selectedStatement.value, acknowledgement, was: held ? held.was : was, base: held ? held.base : report.value,
    priority: unit?.priority ?? null, version: seq,
  })
  ackPatches.value = next
}

/** Drops a save's pending acknowledgement, only if no later save replaced it meanwhile. */
function dropAckPatch(id: string, version: number): void {
  const held = ackPatches.value.get(id)
  if (!held || held.version !== version) return
  const next = new Map(ackPatches.value)
  next.delete(id)
  ackPatches.value = next
}

// DAR-UI-144. A saved acknowledgement moves its row without changing the morning, so the two lists cached on it (the
// filters' read, a level's orders past the report's 50) are read again, in place, with the quiet reload. DAR-UI-155: the
// board already shows it; the patch goes once all three reads are in, and stays if the report could not be read.
async function onAcknowledged(id: string, seq: number): Promise<void> {
  const period = periodFindings.value?.key === periodKey.value ? periodFindings.value : null
  const lookup = orderLookup.value?.key === `${periodKey.value}|${selectedStatement.value}` ? orderLookup.value : null
  periodFindings.value = period
  orderLookup.value = lookup
  const read = await loadReport({ quiet: true })
  await Promise.all([period ? loadPeriodFindings({ force: true }) : null, lookup ? lookUpOrders({ force: true }) : null])
  if (read) dropAckPatch(id, seq)
}

// A refusal: the row shows what the backend holds (its own patch says so until the reads land, so a stale report
// cannot flash the wrong word), and if the person has moved off the finding the mascot says it, since nothing else will.
function onAckFailed(id: string, reason: string, shown: boolean, held: AuditAcknowledgement | null, seq: number): void {
  const patch = ackPatches.value.get(id)
  if (patch && patch.version === seq) {
    const next = new Map(ackPatches.value)
    next.set(id, { ...patch, acknowledgement: held })
    ackPatches.value = next
    void onAcknowledged(id, seq)
  }
  if (!shown) {
    mascot.raise({
      id: `audit-ack-${id}`,
      title: 'An acknowledgement did not save',
      prompt: `${id} is not acknowledged.`,
      body: reason,
      actions: [],
    })
  }
}

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
    const level = pickedLevel.value
    const response = await readOrders(period, statement, level)
    if (response.ok === false) throw new Error(errorOf(response, 'The findings refused to leave the building. Nothing exported.'))
    const findings = response.findings ?? []
    saveJson(`${auditCode.value}-${period}-${statement}${level ? `-${level}` : ''}-findings.json`, {
      audit: auditCode.value, period, statement, ...(level ? { priority: level } : {}),
      findings: findings.map((item) => ({ ...item, order: item.order ?? orderKey(item) })),
    })
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

// DAR-UI-140. A new cut starts the columns over: record type on its default category, priority on its most urgent level.
// The pick is remembered for the next visit and written to the URL.
function chooseBy(next: AuditBy): void {
  const current = by.value
  storedBy.value = next
  try {
    window.localStorage.setItem(BY_STORAGE_KEY, next)
  } catch {
    // Storage may be unavailable; the URL still carries the pick.
  }
  // The choice on show again: remembered (it may have come from the URL), and the board stays where it is.
  if (next === current) return
  void router.replace({
    query: { ...route.query, by: next, category: undefined, statement: undefined, finding: undefined, source: undefined },
  })
}

function choosePeriod(period: string): void {
  void router.replace({ query: { ...route.query, period, finding: undefined } })
}

// DAR-UI-108. The Agent tab exists only when the agent is on for the person and their grant is live (send#AgentTurn
// refuses otherwise anyway); ?tab=agent shows it, kept while the person moves around the board like every other pick.
const agentStatus = ref<GetAgentStatusResponse | null>(null)
// DAR-BE-292: only editors and tenant admins talk to the agent (canApprove), so nobody else gets the tab.
const agentOn = computed(() => agentStatus.value?.state === 'ON' && agentStatus.value.grantState === 'LIVE' &&
  agentStatus.value.canApprove === true)
const agentOpen = computed(() => agentOn.value && queryValue('tab') === 'agent')
// DAR-UI-109. What the waiting drafts would change, marked on the board.
const draftPreviews = ref<DraftPreview[]>([])
const drafts = computed(() => boardDrafts(draftPreviews.value))

function setAgentTab(open: boolean): void {
  void router.replace({ query: { ...route.query, tab: open ? 'agent' : undefined } })
}

async function loadAgentStatus(): Promise<void> {
  try {
    agentStatus.value = await agentFacade.getAgentStatus({}, abort.signal)
  } catch {
    agentStatus.value = null
  }
}

onMounted(() => void loadAgentStatus())

// DAR-UI-063. Arrived from play: the runs were submitted and finish in the background. Said once in the top pill,
// and consumed, so a reload does not say it again.
onMounted(() => {
  const state = window.history.state as Record<string, unknown> | null
  if (!state?.startedAudit) return
  window.history.replaceState({ ...state, startedAudit: false }, '')
  // DAR-BE-328: play inside peak hours says so in this one pill, in place of the running line.
  say(typeof state.peakNotice === 'string' && state.peakNotice ? state.peakNotice : 'Running. Findings arrive as each check finishes.')
  watchPlayUntil = Date.now() + PLAY_WATCH_MS
  scheduleProgress()
})

// DAR-UI-068. One source per value, so a column pick (a new query object) does not count as a new morning.
watch([auditCode, () => route.query.date, () => route.query.period], () => void loadReport(), { immediate: true })
watch(findingTarget, () => void loadFinding(), { immediate: true })
watch(auditCode, () => {
  progress.value = null
  void loadProgress()
}, { immediate: true })
watch([report, selectedStatement, filter, pickedLevel], () => {
  more.value = emptyFindingsMore()
  if (findingsLeft(statementDoc.value, 0, null, filter.value)) void loadMore()
})
// DAR-UI-075. An order the report does not list (past its 50: a reload, a link) is found in the statement's orders.
// DAR-UI-140: read at every level, not the one on show, so an order at another level is found and opens on its own.
watch([findingId, report, selectedStatement], async () => {
  const id = findingId.value
  if (!id || !report.value || isLineId(id) || orderUnit.value) return
  // By record type "more" already reads every order of the statement.
  const atLevel = Boolean(pickedLevel.value)
  if (atLevel) await lookUpOrders()
  else if (more.value.hasNextPage !== false) await loadMore()
  const failed = atLevel ? orderLookup.value?.error : more.value.error
  if (findingId.value === id && !orderUnit.value && !failed) findingError.value = `Finding ${id} has gone missing. We checked under every row.`
}, { immediate: true })

async function lookUpOrders(options: { force?: boolean } = {}): Promise<void> {
  const statement = selectedStatement.value
  const key = `${periodKey.value}|${statement}`
  if (!report.value || !statement || (!options.force && orderLookup.value?.key === key)) return
  try {
    const response = await readOrders(report.value.report.period, statement)
    if (key !== `${periodKey.value}|${selectedStatement.value}`) return
    orderLookup.value = response.ok === false
      ? { key, items: [], error: errorOf(response, FINDINGS_LOST) }
      : { key, items: response.findings ?? [], error: '' }
  } catch {
    if (!abort.signal.aborted) orderLookup.value = { key, items: [], error: FINDINGS_LOST }
  }
}
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
  gap: var(--space-3);
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

/* DAR-UI-087. The hero is the board's head: no band between them. */
.audit-page :deep(.static-page-panel) {
  gap: 0;
}

.audit-page :deep(.static-page-hero) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.audit-page :deep(.static-page-board) {
  border-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.audit-hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
}

/* A fixed width, as the design system's run result screen holds a header-row select; a phone gives way. */
.audit-period {
  width: min(10rem, 40vw);
}

@media (max-width: 760px) {
  .audit-find {
    flex: 1 1 100%;
  }
}

.audit-search {
  /* A fixed width (not a percentage): the row sizes .audit-find from it before it wraps. */
  width: 16rem;
  max-width: 100%;
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
  /* The search box's and AppSelect's height, so the row reads as one line. */
  min-height: 2.55rem;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: var(--type-label-size);
  cursor: pointer;
  transition: background var(--motion-base) var(--ease-out), border-color var(--motion-base) var(--ease-out);
}

.audit-filter--empty {
  border-style: dashed;
  border-color: var(--text-dim);
}

.audit-filter--apart {
  margin-left: var(--space-2);
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
