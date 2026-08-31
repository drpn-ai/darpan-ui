<template>
  <StaticPageFrame>
    <template #hero>
      <h1>{{ heroTitle }}</h1>
    </template>

    <p v-if="loading" class="section-note">Loading automation...</p>
    <InlineValidation v-else-if="error" tone="error" :message="error" />

    <template v-else-if="automation">
      <InlineValidation v-if="actionError" tone="error" :message="actionError" />
      <p
        v-if="runNowInFlight"
        class="section-note"
        data-testid="automation-run-now-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        Starting run...
      </p>

      <StaticPageSection>
        <template #header>
          <div class="static-page-section-header-row">
            <h2 class="static-page-section-heading">Setup</h2>
            <RouterLink
              v-if="canEditAutomation"
              :to="editRoute"
              class="app-icon-action static-page-section-edit-action"
              data-testid="automation-edit-action"
              aria-label="Edit automation"
              @click="setAutomationOrigin"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="editIconPath" />
              </svg>
            </RouterLink>
          </div>
        </template>

        <div class="automation-dashboard-setup" data-testid="automation-setup-summary">
          <div class="automation-dashboard-setup-head">
            <div class="automation-dashboard-heading-block">
              <span class="micro-label">Based On</span>
              <RouterLink
                v-if="savedRunRoute"
                :to="savedRunRoute"
                class="automation-dashboard-run-link"
                data-testid="automation-saved-run-link"
                @click="setAutomationOrigin"
              >
                {{ savedRunLabel }}
              </RouterLink>
              <span v-else class="automation-dashboard-run-link">{{ savedRunLabel }}</span>
            </div>
            <AppToggleSwitch
              :model-value="isAutomationActive"
              :label="activeToggleLabel"
              :disabled="!canToggleActive || actionInFlight"
              :busy="activeToggleInFlight"
              test-id="automation-active-toggle"
              @update:model-value="setAutomationActive"
            />
          </div>

          <dl class="automation-dashboard-detail-grid">
            <div class="automation-dashboard-detail-item">
              <dt class="micro-label">Automation ID</dt>
              <dd>{{ automation.automationId }}</dd>
            </div>
            <div class="automation-dashboard-detail-item">
              <dt class="micro-label">Schedule</dt>
              <dd>{{ scheduleLabel }}</dd>
            </div>
            <div class="automation-dashboard-detail-item">
              <dt class="micro-label">Window</dt>
              <dd>{{ windowLabel }}</dd>
            </div>
            <div class="automation-dashboard-detail-item automation-dashboard-detail-item--date">
              <dt class="micro-label">Previous Run</dt>
              <dd data-testid="automation-previous-run">{{ formatTenantDateTime(previousRunTime) }}</dd>
            </div>
            <div class="automation-dashboard-detail-item automation-dashboard-detail-item--date">
              <dt class="micro-label">Next Run</dt>
              <dd data-testid="automation-next-run">{{ formatTenantDateTime(nextRunTime) }}</dd>
            </div>
          </dl>
        </div>
      </StaticPageSection>

      <StaticPageSection title="Previous Runs">
        <EmptyState v-if="sortedExecutions.length === 0" title="No previous runs" />

        <template v-else>
          <AppListPager
            v-model:page-index="executionPageIndex"
            :page-count="executionPageCount"
            aria-label="Previous runs pages"
            previous-test-id="automation-executions-page-previous"
            next-test-id="automation-executions-page-next"
          />

          <AppTableFrame
            :columns="columns"
            :rows="tableRows"
            row-key="automationExecutionId"
            row-test-id="automation-execution-row"
            :row-action-label="executionRowActionLabel"
            @row-action="openExecutionResult"
          >
            <template #cell-status="{ row }">
              <StatusBadge :label="executionRow(row).statusLabel || executionRow(row).statusEnumId || 'Unknown'" :tone="statusTone(executionRow(row).statusEnumId)" />
            </template>

            <template #cell-scheduled="{ row }">
              <span class="automation-dashboard-date-text">{{ formatTenantDateTime(executionRow(row).scheduledDate) }}</span>
            </template>

            <template #cell-completed="{ row }">
              <span class="automation-dashboard-date-text">{{ formatTenantDateTime(executionRow(row).completedDate || executionRow(row).startedDate) }}</span>
            </template>

            <template #cell-counts="{ row }">
              <span>{{ executionRow(row).differenceCount ?? '-' }}</span>
            </template>
          </AppTableFrame>
        </template>
      </StaticPageSection>
    </template>

    <StaticPageSection v-else>
      <EmptyState title="Automation unavailable" />
    </StaticPageSection>

    <template v-if="automation" #actions>
      <div class="action-row settings-dashboard-footer-row">
        <RouterLink
          to="/reconciliation/automations"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="back-automations"
          aria-label="Back to Automations"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>

        <button
          v-if="canRunAutomation"
          type="button"
          class="app-icon-action app-icon-action--large settings-dashboard-footer-action"
          data-testid="automation-run-now-action"
          aria-label="Run automation now"
          :disabled="actionInFlight"
          @click="runNow"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M6 4.5v11l9-5.5-9-5.5Z" fill="currentColor" />
          </svg>
        </button>

        <button
          v-if="canDeleteAutomation"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger settings-dashboard-footer-action"
          data-testid="automation-delete-action"
          aria-label="Delete automation"
          :disabled="actionInFlight"
          @click="deleteAutomation"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
          </svg>
        </button>
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import AppListPager from '../../components/ui/AppListPager.vue'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type { AutomationExecutionSummary, AutomationRecord } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import {
  AUTOMATION_WINDOW_CUSTOM,
  AUTOMATION_WINDOW_LAST_DAYS,
  AUTOMATION_WINDOW_LAST_MONTHS,
  AUTOMATION_WINDOW_LAST_WEEKS,
  AUTOMATION_WINDOW_PREVIOUS_DAY,
  AUTOMATION_WINDOW_PREVIOUS_MONTH,
  AUTOMATION_WINDOW_PREVIOUS_WEEK,
} from '../../lib/reconciliationAutomationDraft'
import {
  buildReconciliationRunLiveRoute,
  buildReconciliationRunResultRoute,
  type ReconciliationRunRouteContext,
} from '../../lib/reconciliationRoutes'
import { useListPagination } from '../../lib/listPagination'
import { fileNameFromPath, humanizeToken, normalizeDisplayText } from '../../lib/reconciliationDisplay'
import { buildRuleSetDraft, buildSavedRunEditorRoute } from '../../lib/savedRunEditorRoute'
import { backIconPath, editIconPath, trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import { formatDateTime, getDefaultDisplayTimeZone, timeZoneCode } from '../../lib/utils/date'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { isActiveRunStatus } from '../../stores/runResults'

const columns = [
  { key: 'status', label: 'Status', colStyle: { width: '16%' } },
  { key: 'scheduled', label: 'Scheduled', colStyle: { width: '34%' } },
  { key: 'completed', label: 'Completed', colStyle: { width: '34%' } },
  // "Differences" is the number operators most often read as "everything that is
  // wrong". It is not: records missing on one side are counted separately, so a run
  // can show zero here and still have hundreds of unmatched records.
  { key: 'counts', label: 'Differences', colStyle: { width: '16%' }, explain: 'differenceCount' },
]

type AutomationExecutionTableRow = Record<string, unknown> & {
  execution: AutomationExecutionSummary
}

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()
const automation = ref<AutomationRecord | null>(null)
const executions = ref<AutomationExecutionSummary[]>([])
const loading = ref(false)
const actionInFlight = ref(false)
// Separate from actionInFlight, which also covers deleteAutomation(): the "Starting run..."
// status line must not appear while a delete is in flight.
const runNowInFlight = ref(false)
// Separate from actionInFlight so the switch can report aria-busy for its own change only,
// while still being disabled by any other action in flight.
const activeToggleInFlight = ref(false)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const weekdayLabels: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
}

const automationId = computed(() => (typeof route.params.automationId === 'string' ? route.params.automationId.trim() : ''))
const heroTitle = computed(() => automation.value?.automationName || 'Automation')
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const canRunActiveTenantReconciliation = computed(() => permissionsStore.canRunActiveTenantReconciliation)
const canEditAutomation = computed(() => canEditTenantSettings.value && automation.value?.permissions?.canEdit !== false)
const canDeleteAutomation = computed(() => canEditTenantSettings.value && automation.value?.permissions?.canDelete === true)
const canRunAutomation = computed(() => canRunActiveTenantReconciliation.value && automation.value?.permissions?.canRunNow !== false)
const isAutomationActive = computed(() => automation.value?.active !== false)
// The switch carries no visible text, so its accessible name is the only place the state is
// spelled out -- it has to name the state, not just the control.
const activeToggleLabel = computed(() => (isAutomationActive.value ? 'Automation is running' : 'Automation is paused'))
// The backend decides per row which direction is permitted; the tenant-level gate is the floor.
const canToggleActive = computed(() => {
  const row = automation.value
  if (!row || !canEditTenantSettings.value) return false
  return isAutomationActive.value ? row.permissions?.canPause !== false : row.permissions?.canResume !== false
})
const savedRunLabel = computed(() => automation.value?.savedRunName || automation.value?.savedRunId || 'Selected run')
const scheduleLabel = computed(() => scheduleDisplayLabel(automation.value))
const windowLabel = computed(() => {
  const row = automation.value
  if (!row) return '-'
  if (row.customWindowStartDate || row.customWindowEndDate) {
    return `${formatTenantDateTime(row.customWindowStartDate, 'Start')} - ${formatTenantDateTime(row.customWindowEndDate, 'End')}`
  }
  return windowDisplayLabel(row)
})
const previousRunTime = computed(() => (
  automation.value?.lastExecution?.scheduledDate ||
  automation.value?.lastExecution?.completedDate ||
  automation.value?.lastExecution?.startedDate ||
  automation.value?.lastScheduledFireTime
))
// A paused automation has no next run — the scheduler skips it. nextScheduledFireTime is derived
// from the schedule expression alone, so the backend keeps reporting the next matching instant
// while paused; printing it verbatim promises a run that will not happen, directly under a chip
// that says Paused. Falls back to the same "-" Previous Run shows when there is nothing to state.
const nextRunTime = computed(() => (
  automation.value?.active === false ? undefined : automation.value?.nextScheduledFireTime
))
const savedRunRoute = computed<RouteLocationRaw | null>(() => {
  if (automation.value?.savedRun) return buildSavedRunEditorRoute(automation.value.savedRun)

  const savedRunId = automation.value?.reconciliationMappingId || automation.value?.ruleSetId || automation.value?.savedRunId
  if (!savedRunId) return null
  return {
    name: 'settings-runs-edit',
    params: { reconciliationMappingId: savedRunId },
  }
})
const reconciliationRunRouteContext = computed<ReconciliationRunRouteContext | null>(() => {
  const row = automation.value
  const savedRunId = normalizeDisplayText(row?.savedRun?.savedRunId || row?.savedRunId || row?.reconciliationMappingId || row?.ruleSetId)
  if (!row || !savedRunId) return null

  return {
    savedRunId,
    runName: normalizeDisplayText(row.savedRun?.runName || row.savedRunName || row.automationName) || 'Selected Run',
    file1SystemLabel: automationSystemLabel('FILE_1', 'System 1'),
    file2SystemLabel: automationSystemLabel('FILE_2', 'System 2'),
  }
})
const editRoute = computed<RouteLocationRaw>(() => ({
  name: 'reconciliation-automation-edit',
  params: { automationId: automationId.value },
}))
const sortedExecutions = computed(() => [...executions.value].sort((left, right) => executionTime(right) - executionTime(left)))
const hasActiveExecution = computed(() => executions.value.some((execution) => isActiveRunStatus(execution.statusEnumId)))
const {
  pageIndex: executionPageIndex,
  pageCount: executionPageCount,
  pagedItems: pagedExecutions,
  resetPage: resetExecutionsPage,
} = useListPagination(sortedExecutions)
const tableRows = computed<AutomationExecutionTableRow[]>(() =>
  pagedExecutions.value.map((execution) => ({
    ...execution,
    execution,
  })),
)

function setAutomationOrigin(): void {
  draftStore.setWorkflowOrigin(heroTitle.value, route.fullPath || `/reconciliation/automations/${automationId.value}`)
  const savedRun = automation.value?.savedRun
  if (savedRun && savedRun.runType === 'ruleset') {
    const draft = buildRuleSetDraft(savedRun)
    if (draft) draftStore.setRuleSetDraft(draft, 'ruleset-manager')
  }
}

function executionRow(row: Record<string, unknown>): AutomationExecutionSummary {
  return (row as AutomationExecutionTableRow).execution
}

function formatTenantDateTime(value: unknown, fallback = '-'): string {
  return formatDateTime(value, { fallback })
}

function automationSystemLabel(fileSide: string, fallback: string): string {
  const savedRunOption = automation.value?.savedRun?.systemOptions?.find((option) => option.fileSide === fileSide)
  if (savedRunOption) return savedRunOption.label || savedRunOption.description || savedRunOption.enumCode || savedRunOption.enumId || fallback

  const source = automation.value?.sources?.find((option) => option.fileSide === fileSide)
  return source?.systemLabel || source?.systemEnumId || fallback
}

// What time is `utcMs` in `zone`, expressed as if it were UTC? Differencing that against the real
// instant yields the zone's offset at that moment, which is the only DST-correct way to do this
// with Intl alone.
function zoneOffsetMs(utcMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const at = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  // hour comes back as 24 rather than 0 for midnight under hour12:false in some engines.
  const asUtc = Date.UTC(at('year'), at('month') - 1, at('day'), at('hour') % 24, at('minute'), at('second'))
  return asUtc - utcMs
}

// The cron fires at a wall-clock time in the AUTOMATION's zone, but PREVIOUS/NEXT RUN and every
// execution row on this page render in the VIEWER's zone. Left unconverted the card read
// "Daily at 6:00 AM" directly above a table where each run said 1:00 PM, with nothing reconciling
// the two. Convert so the schedule agrees with Next Run. A concrete reference date is required
// because the offset between two zones is not constant — it moves with each zone's DST.
function cronTimeInViewerZone(hour: number, minute: number, sourceZone: string): { hour: number, minute: number } {
  const viewerZone = getDefaultDisplayTimeZone()
  if (!viewerZone || !sourceZone || viewerZone === sourceZone) return { hour, minute }
  try {
    const today = new Date()
    const naive = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour, minute)
    // Resolve the offset at the naive guess, then again at the corrected instant — a second pass
    // settles the case where the guess landed on the far side of a DST transition.
    let instant = naive - zoneOffsetMs(naive, sourceZone)
    instant = naive - zoneOffsetMs(instant, sourceZone)
    const shifted = instant + zoneOffsetMs(instant, viewerZone)
    const asDate = new Date(shifted)
    return { hour: asDate.getUTCHours(), minute: asDate.getUTCMinutes() }
  } catch {
    return { hour, minute }
  }
}

function scheduleDisplayLabel(row: AutomationRecord | null): string {
  if (!row) return '-'
  const zone = row.timezone?.trim() || 'UTC'
  const parsedExpression = scheduleLabelFromCron(row.scheduleExpr, zone)
  if (parsedExpression) return parsedExpression

  const summary = row.scheduleSummary?.trim()
  const summaryExpression = summary?.match(/^Cron:\s*(.+)$/i)?.[1]
  const parsedSummaryExpression = scheduleLabelFromCron(summaryExpression, zone)
  if (parsedSummaryExpression) return parsedSummaryExpression
  if (summary && !summary.match(/^Cron:/i)) return summary

  return row.scheduleExpr ? 'Custom schedule' : '-'
}

// Matches the AM/PM convention every other timestamp on the page uses (formatDateTime), and
// carries the zone code for the same reason formatDateTime now does: this hour has already been
// converted into the VIEWER's zone by cronTimeInViewerZone, so it is the viewer's zone that is
// named. Naming the automation's own zone here would label a converted time with the zone it is
// not in. Resolved against now, the same reference instant the conversion above uses, so the two
// cannot disagree about DST.
function formatHourMinuteAmPm(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const zone = timeZoneCode(new Date(), getDefaultDisplayTimeZone())
  const time = `${hour12}:${minute.toString().padStart(2, '0')} ${period}`
  return zone ? `${time} ${zone}` : time
}

function scheduleLabelFromCron(expression: string | undefined, sourceZone = 'UTC'): string | null {
  const parts = expression?.trim().split(/\s+/) ?? []
  if (parts.length !== 6 || parts[0] !== '0') return null

  const minute = Number(parts[1])
  const hour = Number(parts[2])
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null

  if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*' && parts[5] === '?') {
    // Hourly fires every hour in every zone, so only the minute matters and it needs no conversion
    // (no supported zone is offset by a fraction of a minute).
    return minute === 0 ? 'Hourly on the hour' : `Hourly at :${minute.toString().padStart(2, '0')}`
  }

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  const viewerTime = cronTimeInViewerZone(hour, minute, sourceZone)
  const timeLabel = formatHourMinuteAmPm(viewerTime.hour, viewerTime.minute)
  if (parts[3] === '*' && parts[4] === '*' && parts[5] === '?') return `Daily at ${timeLabel}`

  const weekdayLabel = weekdayDisplayLabel(parts[5])
  if (parts[3] === '?' && parts[4] === '*' && weekdayLabel) return `Weekly on ${weekdayLabel} at ${timeLabel}`

  const monthDay = Number(parts[3])
  if (Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31 && parts[4] === '*' && parts[5] === '?') {
    return `Monthly on day ${monthDay} at ${timeLabel}`
  }

  return null
}

function weekdayDisplayLabel(value: string | undefined): string | null {
  return value ? weekdayLabels[value] ?? null : null
}

function windowDisplayLabel(row: AutomationRecord): string {
  const count = row.relativeWindowCount
  const windowId = row.relativeWindowTypeEnumId || row.relativeWindowLabel
  switch (windowId) {
    case AUTOMATION_WINDOW_PREVIOUS_DAY:
      return 'Previous day'
    case AUTOMATION_WINDOW_PREVIOUS_WEEK:
      return 'Previous week'
    case AUTOMATION_WINDOW_PREVIOUS_MONTH:
      return 'Previous month'
    case AUTOMATION_WINDOW_LAST_DAYS:
    case 'LAST_N_DAYS':
      return countedWindowLabel('Last', count, 'day')
    case AUTOMATION_WINDOW_LAST_WEEKS:
    case 'LAST_N_WEEKS':
      return countedWindowLabel('Last', count, 'week')
    case AUTOMATION_WINDOW_LAST_MONTHS:
    case 'LAST_N_MONTHS':
      return countedWindowLabel('Last', count, 'month')
    case AUTOMATION_WINDOW_CUSTOM:
      return 'Custom range'
    default: {
      const label = humanizeToken(row.relativeWindowLabel || row.relativeWindowTypeEnumId)
      return count !== undefined && count !== null ? `${label}: ${count}` : label || '-'
    }
  }
}

function countedWindowLabel(prefix: string, count: number | undefined, unit: string): string {
  if (count === undefined || count === null) return `${prefix} ${unit}s`
  return `${prefix} ${count} ${unit}${count === 1 ? '' : 's'}`
}

function executionTime(execution: AutomationExecutionSummary): number {
  const value = execution.scheduledDate || execution.completedDate || execution.startedDate || execution.createdDate
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function statusTone(statusEnumId: string | undefined): 'neutral' | 'success' | 'warning' | 'danger' {
  const normalizedStatus = normalizeDisplayText(statusEnumId).toUpperCase()
  if (!normalizedStatus) return 'neutral'
  if (normalizedStatus.includes('SUCCESS') || normalizedStatus.includes('DONE')) return 'success'
  if (normalizedStatus.includes('FAIL') || normalizedStatus.includes('CANCEL')) return 'danger'
  if (normalizedStatus.includes('RUN') || normalizedStatus.includes('PENDING') || normalizedStatus.includes('SCHED')) return 'warning'
  return 'neutral'
}

function isSuccessfulExecution(execution: AutomationExecutionSummary): boolean {
  const status = execution.statusEnumId?.toUpperCase() || ''
  return status.includes('SUCCESS') || status.includes('DONE')
}

function executionResultPath(execution: AutomationExecutionSummary): string {
  if (!isSuccessfulExecution(execution)) return ''
  return normalizeDisplayText(execution.resultDataManagerPath) || normalizeDisplayText(execution.resultFileName)
}

function executionResultLabel(execution: AutomationExecutionSummary): string {
  return normalizeDisplayText(execution.resultFileName) || fileNameFromPath(execution.resultDataManagerPath) || 'Open result'
}

function executionResultRoute(execution: AutomationExecutionSummary): RouteLocationRaw | null {
  const routeContext = reconciliationRunRouteContext.value
  if (!routeContext) return null

  // A still-running execution has no result file yet, but it does have a run id — open the
  // live progress view instead of leaving the row dead until the run finishes.
  const runResultId = normalizeDisplayText(execution.reconciliationRunResultId)
  if (isActiveRunStatus(execution.statusEnumId) && runResultId) {
    return buildReconciliationRunLiveRoute(routeContext, runResultId)
  }

  const outputFileName = executionResultPath(execution)
  if (!outputFileName) return null
  return buildReconciliationRunResultRoute(routeContext, outputFileName)
}

function executionRowActionLabel(row: Record<string, unknown>): string | null {
  const execution = executionRow(row)
  if (!executionResultRoute(execution)) return null
  if (isActiveRunStatus(execution.statusEnumId)) return 'Open run progress'
  return `Open result ${executionResultLabel(execution)}`
}

function openExecutionResult(payload: { row: Record<string, unknown> }): void {
  const route = executionResultRoute(executionRow(payload.row))
  if (!route) return
  void router.push(route)
}

const pageAbortController = new AbortController()
let loadController: AbortController | null = null

// Live-refresh for Previous Runs: a run-now click (or a schedule-fired run already in
// flight when this page loads) leaves an execution PENDING/RUNNING for a stretch, and the
// backend's list#AutomationExecutions row can lag a beat behind run#AutomationNow's own
// response. Polls every 5s -- mirrors runResults.ts's RUN_STATUS_POLL_INTERVAL_MS / the
// document.hidden guard / self-stopping on terminal -- kept page-local since the page needs
// getAutomation (for Previous Run/Next Run, which read automation.lastExecution) alongside
// listAutomationExecutions, not the single run-status shape runResults.ts's store polls.
const EXECUTIONS_POLL_INTERVAL_MS = 5000
let executionsPollTimer: ReturnType<typeof setInterval> | null = null

// Mirrors ReconciliationDiffPage's run-registration poll. Task 2 detached the backend run from
// the request transaction, so the PENDING/RUNNING row commits within moments of submission while
// run#AutomationNow is still in flight -- long before the ~60s gateway timeout that used to kill
// the request and leave the user with no feedback at all.
const RUN_REGISTRATION_POLL_INTERVAL_MS = 900
const RUN_REGISTRATION_POLL_ATTEMPTS = 12
// One-sided on purpose: startedDate is the server's clock and submittedAtMs is the browser's, so a
// row minted a moment before submittedAtMs (clock skew, not an older run) must still match -- hence
// a small backward allowance. But there is no forward cap and no symmetry: a row that started
// clearly BEFORE this click is a DIFFERENT, already-in-flight run of this automation (e.g. a
// scheduled fire a few seconds ago) and must never win the redirect, no matter how long ago it
// started -- accepting it sends the user to watch someone else's run believing it is theirs.
const RUN_REGISTRATION_CLOCK_SKEW_MS = 5000

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

async function pollForRegisteredExecutionRunResultId(signal: AbortSignal): Promise<string> {
  const submittedAtMs = Date.now()
  for (let attempt = 0; attempt < RUN_REGISTRATION_POLL_ATTEMPTS; attempt += 1) {
    await delay(RUN_REGISTRATION_POLL_INTERVAL_MS, signal)
    if (signal.aborted) return ''

    try {
      const response = await reconciliationFacade.listAutomationExecutions(
        { automationId: automationId.value, pageIndex: 0, pageSize: 5 },
        signal,
      )
      const registered = (response.executions ?? []).find((execution) => {
        if (!isActiveRunStatus(execution.statusEnumId) || !execution.reconciliationRunResultId) return false
        // Ignore an older run of this automation that was already in flight before this click --
        // see RUN_REGISTRATION_CLOCK_SKEW_MS above for why this is one-sided. A row whose start
        // time cannot be read is REJECTED, not accepted: the two risks are not symmetric.
        // Rejecting costs, at worst, the early redirect for THIS row -- the poll just keeps
        // looking, and if nothing else matches, falls back to the pre-existing await-then-refetch
        // path. Accepting could send the user to watch a completely unrelated active run of this
        // automation while their own submission's failure is silently swallowed behind it.
        const startedMs = new Date(execution.startedDate ?? execution.createdDate ?? '').getTime()
        return Number.isFinite(startedMs) && startedMs >= submittedAtMs - RUN_REGISTRATION_CLOCK_SKEW_MS
      })
      if (registered?.reconciliationRunResultId) return registered.reconciliationRunResultId
    } catch {
      // Transient list failure -- try again on the next tick.
    }
  }
  return ''
}

function stopExecutionsPoll(): void {
  if (executionsPollTimer) {
    clearInterval(executionsPollTimer)
    executionsPollTimer = null
  }
}

function ensureExecutionsPoll(): void {
  if (executionsPollTimer || typeof window === 'undefined') return
  executionsPollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return
    void pollExecutionsTick()
  }, EXECUTIONS_POLL_INTERVAL_MS)
}

async function pollExecutionsTick(): Promise<void> {
  try {
    const refreshedAutomation = await fetchAutomationAndExecutions(pageAbortController.signal)
    if (refreshedAutomation) automation.value = refreshedAutomation
  } catch (pollError) {
    if ((pollError as { name?: string })?.name === 'AbortError') return
    // Poll errors are non-fatal: keep the last known state and retry next tick, matching
    // runResults.ts's _fetchRunStatus convention.
  }
  // Stops itself once nothing is active -- covers both a genuine terminal transition and
  // the (bounded, at most one extra tick) case where run-now's own execution never actually
  // shows up as active.
  if (!hasActiveExecution.value) stopExecutionsPoll()
}

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadController?.abort()
  stopExecutionsPoll()
})

async function loadExecutions(signal?: AbortSignal): Promise<void> {
  const response = await reconciliationFacade.listAutomationExecutions({
    automationId: automationId.value,
    pageIndex: 0,
    pageSize: 200,
  }, signal)
  executions.value = response.executions ?? []
  resetExecutionsPage()
}

async function fetchAutomationAndExecutions(signal?: AbortSignal): Promise<AutomationRecord | null> {
  const [automationResponse] = await Promise.all([
    reconciliationFacade.getAutomation({ automationId: automationId.value }, signal),
    loadExecutions(signal),
  ])
  return automationResponse.automation ?? null
}

async function load(): Promise<void> {
  if (!automationId.value) {
    error.value = 'Automation ID is missing.'
    return
  }

  loadController?.abort()
  loadController = new AbortController()
  const signal = loadController.signal

  loading.value = true
  error.value = null
  automation.value = null
  executions.value = []
  try {
    const loadedAutomation = await fetchAutomationAndExecutions(signal)
    if (!loadedAutomation) {
      error.value = `Unable to find automation "${automationId.value}".`
      return
    }
    automation.value = loadedAutomation
    if (hasActiveExecution.value) ensureExecutionsPoll()
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load automation.'
  } finally {
    loading.value = false
  }
}

async function runNow(): Promise<void> {
  if (!automation.value || !canRunAutomation.value || actionInFlight.value) return
  actionInFlight.value = true
  runNowInFlight.value = true
  actionError.value = null
  const registrationController = new AbortController()
  try {
    // The run executes detached from the request transaction, so its PENDING/RUNNING row is
    // readable within moments of submission while this call is still in flight. Race the two:
    // whichever resolves first decides where the user lands -- the live progress view for a run
    // long enough to still be running, or the in-place refresh for one that finished first.
    const submission = reconciliationFacade.runAutomationNow({ automationId: automation.value.automationId })
    const liveRunResultId = await Promise.race([
      pollForRegisteredExecutionRunResultId(registrationController.signal),
      submission.then(() => '', () => ''),
    ])

    const routeContext = reconciliationRunRouteContext.value
    if (liveRunResultId && routeContext) {
      // The submission stays in flight and owns the run from here; this page unmounts on
      // navigation, so nothing here may cancel it.
      void submission.catch(() => {
        // A submission failure after the redirect surfaces on the live progress view, which is
        // now the authoritative screen for this run.
      })
      await router.push(buildReconciliationRunLiveRoute(routeContext, liveRunResultId))
      return
    }

    await submission
    // Refetch (not just the runAutomationNow response) so Previous Run/Next Run and the
    // executions table all reflect the same, authoritative post-run state.
    const refreshedAutomation = await fetchAutomationAndExecutions()
    if (refreshedAutomation) automation.value = refreshedAutomation
    // Unconditional: even if the new PENDING row hasn't landed in list#AutomationExecutions
    // yet (backend lag), start polling now so the next tick catches it instead of requiring
    // the user to navigate away and back.
    ensureExecutionsPoll()
  } catch (runError) {
    actionError.value = runError instanceof ApiCallError ? runError.message : 'Unable to run automation.'
  } finally {
    registrationController.abort()
    actionInFlight.value = false
    runNowInFlight.value = false
  }
}

async function setAutomationActive(next: boolean): Promise<void> {
  const row = automation.value
  if (!row || !canToggleActive.value || actionInFlight.value) return

  const previous = row.active
  actionInFlight.value = true
  activeToggleInFlight.value = true
  actionError.value = null
  // Optimistic: pause/resume is a single-field write with no confirmation step, so the switch
  // must move under the pointer rather than waiting out a round trip and reading as a dead click.
  automation.value = { ...row, active: next }
  try {
    const response = next
      ? await reconciliationFacade.resumeAutomation({ automationId: row.automationId })
      : await reconciliationFacade.pauseAutomation({ automationId: row.automationId })
    // Both services rebuild and return the whole row (permissions and schedule fields included),
    // so adopting it keeps every derived cell -- Next Run especially -- consistent with the write.
    if (response.automation) automation.value = response.automation
  } catch (toggleError) {
    // The optimistic state claimed a scheduler change that did not happen; put it back.
    if (automation.value) automation.value = { ...automation.value, active: previous }
    actionError.value = toggleError instanceof ApiCallError
      ? toggleError.message
      : `Unable to ${next ? 'resume' : 'pause'} automation.`
  } finally {
    activeToggleInFlight.value = false
    actionInFlight.value = false
  }
}

async function deleteAutomation(): Promise<void> {
  if (!automation.value || !canDeleteAutomation.value || actionInFlight.value) return
  if (!window.confirm(`Delete automation "${automation.value.automationName}"?`)) return
  actionInFlight.value = true
  actionError.value = null
  try {
    await reconciliationFacade.deleteAutomation({ automationId: automation.value.automationId })
    await router.push('/reconciliation/automations')
  } catch (deleteError) {
    actionError.value = deleteError instanceof ApiCallError ? deleteError.message : 'Unable to delete automation.'
  } finally {
    actionInFlight.value = false
  }
}

watch(automationId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<style scoped>
.automation-dashboard-setup {
  display: grid;
  /* Pinned density, not scale spacing: a test locks these three so the setup rows stay compact.
     They sit between scale steps on purpose. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  gap: 0.5rem;
}

.automation-dashboard-setup-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.automation-dashboard-heading-block {
  display: grid;
  gap: var(--space-0);
  min-width: 0;
}

/* The "Based On" label uses .micro-label directly, like the dt elements below it — there is no
   page-local label rule. Do not reintroduce one with a trailing comma: a comment between a dangling
   selector and the next rule does not terminate the selector list, so the label silently inherits
   the run-link's display type instead. */
.automation-dashboard-run-link {
  min-width: 0;
  max-width: 100%;
  color: var(--text);
  /* Display text. The nearest role (--type-tile-size) is 1.6px away, past the point where folding is invisible. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  font-size: 1.08rem;
  font-weight: 400;
  line-height: 1.35;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.automation-dashboard-date-text {
  white-space: nowrap;
}

.automation-dashboard-detail-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0;
  margin: 0;
}

.automation-dashboard-detail-item {
  grid-column: span 2;
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  align-content: start;
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding: 0.45rem 1rem 0.45rem 0;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
}

.automation-dashboard-detail-item--date {
  grid-column: span 3;
}

.automation-dashboard-detail-item dt,
.automation-dashboard-detail-item dd {
  margin: 0;
}

.automation-dashboard-detail-item dd {
  min-width: 0;
  max-width: 100%;
  font-weight: 400;
  overflow-wrap: anywhere;
  overflow-wrap: break-word;
}

.automation-dashboard-detail-item--date dd {
  white-space: nowrap;
}

@media (max-width: 960px) {
  .automation-dashboard-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .automation-dashboard-detail-item,
  .automation-dashboard-detail-item--date {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .automation-dashboard-setup-head {
    display: grid;
  }

  .automation-dashboard-setup-head :deep(.app-toggle-switch) {
    justify-self: start;
  }

  .automation-dashboard-detail-grid {
    grid-template-columns: 1fr;
  }

  .automation-dashboard-detail-item--date {
    grid-column: auto;
  }

  .automation-dashboard-detail-item--date dd {
    white-space: normal;
  }
}
</style>
