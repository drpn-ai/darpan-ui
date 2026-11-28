<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': activePopup !== null }">
    <template #hero>
      <StaticRecordTitle
        v-if="draft"
        :model-value="title"
        :editable="false"
        test-id="sync-pair-name"
        explain="syncPairName"
        toggle-label="Sync pulse on"
        :on="draft.isActive"
        toggle-test-id="sync-pair-on"
        :toggle-disabled="!canEdit || busy"
        @update:on="setActive"
      />
      <h1 v-else v-explain="'syncPulse'">Sync pair</h1>
    </template>

    <LoadingState v-if="loading" noun="sync pair" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="sync-pair-page-error" />

    <template v-if="draft">
      <StaticFactStrip :facts="facts" test-id="sync-pair-facts" @open="openFact" />

      <template v-if="draft.syncPairId">
        <StaticPageSection data-testid="sync-pair-today">
          <template #header>
            <h2 v-explain="'syncPulseToday'" class="static-page-section-heading">Today</h2>
          </template>
          <div v-if="samples.length" class="sync-pair-charts">
            <PulseOldestChart v-model:active="activeHour" :samples="samples" :allowance-minutes="shownAllowance" />
            <PulseWaitingChart v-model:active="activeHour" :samples="samples" />
          </div>
          <p v-else class="section-note" data-testid="sync-pair-today-empty">No pulses today.</p>
        </StaticPageSection>

        <StaticPageSection>
          <template #header>
            <h2 v-explain="'syncPulsePastAllowance'" class="static-page-section-heading">Past allowance</h2>
          </template>
          <div v-if="pastRows.length" class="sync-pair-rows" data-testid="sync-pair-past-orders">
            <div class="sync-pair-row sync-pair-row--head" data-testid="sync-pair-past-head">
              <span v-explain="'syncPastOrder'" class="sync-pair-row__head-label">Order</span>
              <span v-explain="'syncPastCreated'" class="sync-pair-row__head-label">Created</span>
              <span v-explain="'syncPastWaiting'" class="sync-pair-row__head-label">Waiting</span>
              <span v-explain="'syncPastOtherSystem'" class="sync-pair-row__head-label">{{ otherSystemLabel }}</span>
            </div>
            <div v-for="row in pastRows" :key="row.recordKey" class="sync-pair-row" data-testid="sync-pair-past-order">
              <span>{{ row.order }}</span>
              <span class="sync-pair-row__soft">{{ row.created }}</span>
              <span>{{ row.waiting }}</span>
              <span class="sync-pair-row__soft">
                {{ row.otherSystemId }}
                <RouterLink
                  v-if="row.reportedInRunId && row.reportedInSavedRunId"
                  class="sync-pair-row__run"
                  data-testid="sync-pair-past-run"
                  :to="{ name: 'reconciliation-run-live', params: { savedRunId: row.reportedInSavedRunId, runResultId: row.reportedInRunId } }"
                >in run {{ row.reportedInRunId }}</RouterLink>
              </span>
            </div>
          </div>
          <p v-else class="section-note" data-testid="sync-pair-past-empty">Nothing past the allowance.</p>
        </StaticPageSection>
      </template>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="back"
          class="app-icon-action app-icon-action--large"
          :aria-label="isNewRoute ? 'Back to sync pulse' : 'Back to pulses'"
          :title="isNewRoute ? 'Back to sync pulse' : 'Back to pulses'"
          data-testid="sync-pair-back"
        >
          <AppIcon name="back" />
        </RouterLink>
        <AppSaveAction
          v-if="canEdit && draft && (!draft.syncPairId || dirty)"
          label="Save sync pair"
          test-id="sync-pair-save"
          :dirty="dirty"
          :disabled="busy || !canSave"
          @click="save"
        />
        <button
          v-if="canEdit && draft?.syncPairId"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger"
          aria-label="Delete sync pair"
          data-testid="sync-pair-delete"
          :disabled="busy"
          @click="openPopup('delete')"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </template>
  </StaticPageFrame>

  <div
    v-if="activePopup && draft"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sync-pair-popup-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="sync-pair-popup-title" data-testid="sync-pair-popup-title">{{ popupTitle }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          v-if="activePopup === 'every'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="How often should it pulse?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="sync-pair-every-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="sync-pair-every-cancel"
          @cancel="closePopup"
          @submit="saveEvery"
        >
          <label class="wizard-input-shell">
            <span v-explain="'syncPairEvery'" class="workflow-context-label">Every</span>
            <AppSelect v-model="everyForm" :options="everyOptions" test-id="sync-pair-every-select" />
          </label>
          <p v-if="everyNote" class="section-note" data-testid="sync-pair-every-period-note">{{ everyNote }}</p>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'allowance'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="How long may an order wait?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="sync-pair-allowance-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="sync-pair-allowance-cancel"
          @cancel="closePopup"
          @submit="saveAllowance"
        >
          <label class="wizard-input-shell">
            <span v-explain="'syncPairAllowance'" class="workflow-context-label">Allowance</span>
            <AppSelect v-model="allowanceForm" :options="allowanceOptions" test-id="sync-pair-allowance-select" />
          </label>
          <p v-if="allowanceNote" class="section-note" data-testid="sync-pair-allowance-period-note">{{ allowanceNote }}</p>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'run'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Which daily check does it watch?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="sync-pair-run-save"
          :submit-disabled="!runForm"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="sync-pair-run-cancel"
          @cancel="closePopup"
          @submit="saveRun"
        >
          <label class="wizard-input-shell">
            <span v-explain="'syncPairRun'" class="workflow-context-label">Run</span>
            <AppSelect
              v-model="runForm"
              :options="runOptions"
              placeholder="Select run"
              test-id="sync-pair-run-select"
              searchable
              search-placeholder="Search runs"
            />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'upstream'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Which side do orders reach first?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="sync-pair-upstream-save"
          :submit-disabled="!upstreamForm"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="sync-pair-upstream-cancel"
          @cancel="closePopup"
          @submit="saveUpstream"
        >
          <label class="wizard-input-shell">
            <span v-explain="'syncPairUpstream'" class="workflow-context-label">Upstream side</span>
            <AppSelect
              v-model="upstreamForm"
              :options="upstreamOptions"
              placeholder="Select side"
              test-id="sync-pair-upstream-select"
            />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'chat'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Where should it post?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="sync-pair-chat-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="sync-pair-chat-cancel"
          @cancel="closePopup"
          @submit="saveChat"
        >
          <label class="wizard-input-shell">
            <span v-explain="'syncPairChatSpace'" class="workflow-context-label">Chat space</span>
            <AppSelect
              v-model="chatForm"
              :options="chatOptions"
              test-id="sync-pair-chat-select"
              searchable
              search-placeholder="Search chat spaces"
            />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'hourly'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Post a summary every hour?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="sync-pair-hourly-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="sync-pair-hourly-cancel"
          @cancel="closePopup"
          @submit="saveHourly"
        >
          <div class="sync-pair-popup-toggle">
            <AppToggleSwitch v-model="hourlyForm" label="Hourly summary" test-id="sync-pair-hourly-toggle" />
            <span>Hourly summary</span>
          </div>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'delete'"
          class="workflow-form--popup-compact"
          :question="`Delete ${title}?`"
          :show-primary-action="false"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="sync-pair-popup-error" />
          <p class="section-note">Its pulses and the orders it is watching go with it.</p>
          <div class="wizard-actions">
            <button
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger"
              aria-label="Confirm delete"
              data-testid="sync-pair-delete-confirm"
              :disabled="popupBusy"
              @click="deletePair"
            >
              <AppIcon name="trash" />
            </button>
            <AppCancelAction test-id="sync-pair-delete-cancel" :disabled="popupBusy" @click="closePopup" />
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
// DAR-BE-328. One sync pair on a page of its own: which daily check it watches, how often it pulses, how long an order
// may wait, and today's pulses as two charts with the orders now past the allowance. The switch and the facts change
// only this page until Save. While the page is open and untouched, it reads the pair again every minute. On /new the
// facts also pick the run, its upstream side, the chat space and the hourly summary; the backend validates every save
// and its sentences show as they come.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PulseOldestChart from '../../components/pulse/PulseOldestChart.vue'
import PulseWaitingChart from '../../components/pulse/PulseWaitingChart.vue'
import AppCancelAction from '../../components/ui/AppCancelAction.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { ApiCallError } from '../../lib/api/client'
import { pulseFacade } from '../../lib/api/facade'
import type {
  GetSyncPairResponse,
  SyncAutomationOption,
  SyncChatSpaceOption,
  SyncPair,
  SyncPastOrder,
  SyncSample,
} from '../../lib/api/pulseTypes'
import {
  ALLOWANCE_CHOICES,
  allowanceWords,
  durationWords,
  PULSE_EVERY_CHOICES,
  pulseEveryWords,
} from '../../lib/pulseWords'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { formatClockTime } from '../../lib/utils/date'
import { calendarDayWords, latestReadSample, loadSyncPulseView, pairSidesLabel } from '../../lib/syncPulseView'
import { usePermissionsStore } from '../../stores/permissions'

interface Draft {
  syncPairId: string
  automationId: string
  /** FILE_1 or FILE_2; '' until chosen on /new. */
  upstreamSide: string
  allowanceMinutes: number
  /** null is off. */
  pulseEveryMinutes: number | null
  /** '' is none. */
  chatSpaceId: string
  hourlySummary: boolean
  isActive: boolean
}

type Popup = 'every' | 'allowance' | 'run' | 'upstream' | 'chat' | 'hourly' | 'delete'

const REFRESH_MS = 60_000
const OFF = 'off'
const NONE = 'none'
// A new pair starts with its own pulse off and a six-hour allowance: pulses run only on the days a peak period turns
// them on (Aditi 2026-11-26), and the period's sync row sets that pulse.
const NEW_ALLOWANCE_MINUTES = 360

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const routePairId = computed(() => String(route.params.syncPairId ?? ''))
// A new pair is made from Tenant Settings and goes back there; a saved pulse's page sits under Pulses (DAR-UI-154).
const isNewRoute = computed(() => route.name === 'settings-tenant-sync-pair-new')
const back = computed(() => ({ name: isNewRoute.value ? 'settings-tenant-sync-pairs' : 'pulses' }))

const saved = ref<SyncPair | null>(null)
const samples = ref<SyncSample[]>([])
const pastOrders = ref<SyncPastOrder[]>([])
const automations = ref<SyncAutomationOption[]>([])
const chatSpaces = ref<SyncChatSpaceOption[]>([])
const loading = ref(false)
const pageError = ref('')

const draft = ref<Draft | null>(null)
const baseline = ref('')
const saving = ref(false)

const activePopup = ref<Popup | null>(null)
const popupBusy = ref(false)
const popupError = ref('')
const everyForm = ref(OFF)
const allowanceForm = ref(String(NEW_ALLOWANCE_MINUTES))
const runForm = ref('')
const upstreamForm = ref('')
const chatForm = ref(NONE)
const hourlyForm = ref(false)

/** The hour pointed at on either Today chart; null is the latest. */
const activeHour = ref<number | null>(null)

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let unmounted = false

const busy = computed(() => saving.value || popupBusy.value)
const isNew = computed(() => Boolean(draft.value && !draft.value.syncPairId))

function snapshot(): string {
  return JSON.stringify(draft.value)
}
const dirty = computed(() => Boolean(draft.value) && snapshot() !== baseline.value)
const canSave = computed(() => Boolean(draft.value?.automationId && draft.value.upstreamSide))

// A peak period overrides the pair today; the drafts hold the pair's own (normal) values, and the facts show today's
// effective ones, with the period named, until the draft is changed.
const periodName = computed(() => saved.value?.periodName || '')
const normalAllowance = computed(() => saved.value?.normalAllowanceMinutes ?? saved.value?.allowanceMinutes ?? 0)
const normalPulseEvery = computed(() => saved.value?.normalPulseEveryMinutes ?? saved.value?.pulseEveryMinutes ?? null)
// A period overrides a value when today's effective one differs from the pair's own; the fact then keeps the
// effective value even after the draft changes (the sub says what the normal one became).
const allowancePeriodActive = computed(() => Boolean(periodName.value && saved.value?.allowanceMinutes !== normalAllowance.value))
const everyPeriodActive = computed(() => Boolean(periodName.value && (saved.value?.pulseEveryMinutes || null) !== (normalPulseEvery.value || null)))
const allowanceDraftIsNormal = computed(() => draft.value?.allowanceMinutes === normalAllowance.value)
const everyDraftIsNormal = computed(() => (draft.value?.pulseEveryMinutes || null) === (normalPulseEvery.value || null))
const shownAllowance = computed(() => (allowancePeriodActive.value ? saved.value?.allowanceMinutes : draft.value?.allowanceMinutes) ?? 0)
const periodThru = computed(() => saved.value?.periodThruDate ?? '')
/** What the period does to the pulse, as a verb phrase: "pulses every hour", "turns the pulse off". */
function periodPulseWords(minutes: number | null | undefined): string {
  if (!minutes) return 'turns the pulse off'
  if (minutes === 60) return 'pulses every hour'
  return minutes % 60 === 0 ? `pulses every ${minutes / 60} hours` : `pulses every ${minutes} min`
}
const periodUntil = computed(() => (periodThru.value ? ` through ${calendarDayWords(periodThru.value)}` : ''))
/** The popup's one-line cue that a peak period overrides the value it edits. */
const allowanceNote = computed(() => (allowancePeriodActive.value
  ? `Normal days. ${periodName.value} uses ${allowanceWords(saved.value?.allowanceMinutes ?? 0)}${periodUntil.value}.` : ''))
const everyNote = computed(() => (everyPeriodActive.value
  ? `Normal days. ${periodName.value} ${periodPulseWords(saved.value?.pulseEveryMinutes)}${periodUntil.value}.` : ''))
const lastPulseFailed = computed(() => saved.value?.lastPulseStatusEnumId === 'SPS_FAILED')

const chosenAutomation = computed(() => automations.value.find((automation) => automation.automationId === draft.value?.automationId) ?? null)

// DAR-UI-154: system names only ("HotWax → NetSuite returns"), as on the Sync pulse list and the Pulses page.
// A pulse that shares its label with others (RAILS: one per Shopify store) is named as the Pulses page names it.
const pulseViewLabel = ref('')
const title = computed(() => pulseViewLabel.value || (saved.value ? pairSidesLabel(saved.value, automations.value) : '') || chosenAutomation.value?.label || 'New sync pair')

const upstreamLabel = computed(() => chosenAutomation.value?.upstreamOptions
  .find((option) => option.upstreamSide === draft.value?.upstreamSide)?.label ?? '')

/** The side the orders should reach after the upstream one; it names the past-allowance list's last column. */
const otherSystemLabel = computed(() => chosenAutomation.value?.upstreamOptions
  .find((option) => option.upstreamSide !== draft.value?.upstreamSide)?.label || 'Other system')

const chatLabel = computed(() => chatSpaces.value.find((space) => space.chatSpaceId === draft.value?.chatSpaceId)?.label
  ?? (draft.value?.chatSpaceId ? draft.value.chatSpaceId : 'None'))

const latestSample = computed(() => latestReadSample(samples.value))

const oldestMinutes = computed(() => latestSample.value?.oldestWaitingMinutes ?? pastOrders.value[0]?.waitingMinutes ?? null)

const facts = computed<StaticFact[]>(() => {
  const current = draft.value
  if (!current) return []
  const changeable = { interactive: canEdit.value, disabled: busy.value }
  const every: StaticFact = {
    key: 'every', label: 'Every',
    value: pulseEveryWords(everyPeriodActive.value ? saved.value?.pulseEveryMinutes ?? null : current.pulseEveryMinutes),
    sub: lastPulseFailed.value && saved.value?.lastPulseStamp
      ? `last pulse failed ${formatClockTime(saved.value.lastPulseStamp)}`
      : everyPeriodActive.value
        ? (everyDraftIsNormal.value ? periodName.value : `normal: ${pulseEveryWords(current.pulseEveryMinutes)}`)
        : saved.value?.lastPulseStamp ? `last ${formatClockTime(saved.value.lastPulseStamp)}` : '',
    explain: 'syncPairEvery', testId: 'sync-pair-fact-every', ...changeable,
  }
  const allowance: StaticFact = {
    key: 'allowance', label: 'Allowance', value: allowanceWords(shownAllowance.value),
    sub: allowancePeriodActive.value
      ? (allowanceDraftIsNormal.value ? periodName.value : `normal: ${allowanceWords(current.allowanceMinutes)}`)
      : 'normal', explain: 'syncPairAllowance', testId: 'sync-pair-fact-allowance', ...changeable,
  }
  if (isNew.value) {
    const pickable = { interactive: canEdit.value, disabled: busy.value }
    return [
      { key: 'run', label: 'Run', value: chosenAutomation.value?.label || 'Not set', explain: 'syncPairRun',
        testId: 'sync-pair-fact-run', ...pickable },
      { key: 'upstream', label: 'Upstream side', value: upstreamLabel.value || 'Not set', explain: 'syncPairUpstream',
        testId: 'sync-pair-fact-upstream', ...pickable, disabled: busy.value || !current.automationId },
      every,
      allowance,
      { key: 'chat', label: 'Chat space', value: chatLabel.value, explain: 'syncPairChatSpace',
        testId: 'sync-pair-fact-chat', ...pickable },
      { key: 'hourly', label: 'Hourly summary', value: current.hourlySummary ? 'On' : 'Off', explain: 'syncPairHourlySummary',
        testId: 'sync-pair-fact-hourly', ...pickable },
    ]
  }
  return [
    every,
    allowance,
    { key: 'waiting', label: 'Waiting', value: (saved.value?.waitingCount ?? 0).toLocaleString('en-US'), sub: 'orders',
      explain: 'syncPairWaiting', testId: 'sync-pair-fact-waiting' },
    { key: 'oldest', label: 'Oldest', value: oldestMinutes.value ? durationWords(oldestMinutes.value) : 'None',
      sub: oldestMinutes.value ? pastOrders.value[0]?.orderName ?? '' : '', explain: 'syncPairOldest',
      testId: 'sync-pair-fact-oldest' },
    { key: 'past', label: 'Past allowance', value: (saved.value?.pastAllowanceCount ?? 0).toLocaleString('en-US'),
      sub: 'findings', explain: 'syncPairPastAllowance', testId: 'sync-pair-fact-past' },
  ]
})

const pastRows = computed(() => pastOrders.value.map((order) => ({
  recordKey: order.recordKey,
  order: order.orderName || order.recordKey,
  created: formatClockTime(order.sourceCreatedStamp) || '—',
  waiting: durationWords(order.waitingMinutes),
  otherSystemId: order.otherSystemId || '—',
  reportedInRunId: order.reportedInRunId,
  reportedInSavedRunId: order.reportedInSavedRunId,
})))

/** The choices, plus the value the pair has today when it is not one of them (a peak period's, say). */
function withCurrent(options: { value: string; label: string }[], value: string, label: string) {
  return options.some((option) => option.value === value) ? options : [...options, { value, label }]
}

const everyOptions = computed(() => withCurrent(
  PULSE_EVERY_CHOICES.map((minutes) => ({
    value: minutes === null ? OFF : String(minutes),
    label: minutes === null ? 'Off' : minutes === 60 ? '1 hour' : `${minutes / 60} hours`,
  })),
  everyForm.value,
  pulseEveryWords(Number(everyForm.value)),
))

const allowanceOptions = computed(() => withCurrent(
  ALLOWANCE_CHOICES.map((minutes) => ({ value: String(minutes), label: allowanceWords(minutes) })),
  allowanceForm.value,
  allowanceWords(Number(allowanceForm.value)),
))

const runOptions = computed(() => automations.value.map((automation) => ({ value: automation.automationId, label: automation.label })))

const upstreamOptions = computed(() => (chosenAutomation.value?.upstreamOptions ?? [])
  .map((option) => ({ value: option.upstreamSide, label: option.label })))

const chatOptions = computed(() => [
  { value: NONE, label: 'None' },
  ...chatSpaces.value.map((space) => ({ value: space.chatSpaceId, label: space.label })),
])

const popupTitle = computed(() => {
  switch (activePopup.value) {
    case 'every': return 'Every'
    case 'allowance': return 'Allowance'
    case 'run': return 'Run'
    case 'upstream': return 'Upstream side'
    case 'chat': return 'Chat space'
    case 'hourly': return 'Hourly summary'
    case 'delete': return 'Delete sync pair'
    default: return ''
  }
})

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** A refusal returned rather than thrown: the server's own sentences. */
function refusalOf(response: { ok?: boolean; errors?: string[] }, fallback: string): string {
  if (response.ok !== false) return ''
  return response.errors?.length ? response.errors.join(' ') : fallback
}

function resetDraft(): void {
  const pair = saved.value
  draft.value = pair
    ? {
        syncPairId: pair.syncPairId,
        automationId: pair.automationId,
        upstreamSide: pair.upstreamSide ?? '',
        allowanceMinutes: pair.normalAllowanceMinutes ?? pair.allowanceMinutes,
        pulseEveryMinutes: (pair.normalPulseEveryMinutes ?? pair.pulseEveryMinutes) || null,
        chatSpaceId: pair.chatSpaceId ?? '',
        hourlySummary: pair.hourlySummary === 'Y',
        isActive: pair.isActive !== 'N',
      }
    : {
        syncPairId: '', automationId: '', upstreamSide: '', allowanceMinutes: NEW_ALLOWANCE_MINUTES,
        pulseEveryMinutes: null, chatSpaceId: '', hourlySummary: false, isActive: true,
      }
  baseline.value = snapshot()
}

function apply(response: GetSyncPairResponse): void {
  saved.value = response.syncPair ?? null
  samples.value = response.samplesToday ?? []
  pastOrders.value = response.pastOrders ?? []
  automations.value = response.automations ?? []
  chatSpaces.value = response.chatSpaces ?? []
}

/** The pair, or on /new only the pickers (no syncPairId): its daily checks and chat spaces. */
async function fetchPair(syncPairId: string): Promise<GetSyncPairResponse> {
  const response = await pulseFacade.getSyncPair(syncPairId ? { syncPairId } : {})
  const refusal = refusalOf(response, 'Could not load the sync pair.')
  if (refusal) throw new ApiCallError(refusal)
  return response
}

/**
 * The server answered no (not found, another tenant's pair, signed out), not "could not answer" (unreachable, 5xx, a
 * dropped connection). Asking again a minute later gets the same no: the active tenant is shared by every tab, so a
 * pulse tab left open after another tab switched company asked as the wrong tenant all night (DAR-UI-164).
 */
function refusedOutright(error: unknown): boolean {
  return error instanceof ApiCallError && (error.status === undefined || error.status < 500)
}

async function load(syncPairId: string): Promise<void> {
  loading.value = true
  pageError.value = ''
  draft.value = null
  saved.value = null
  samples.value = []
  pastOrders.value = []
  activeHour.value = null
  try {
    apply(await fetchPair(syncPairId))
    resetDraft()
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the sync pair.')
  } finally {
    loading.value = false
  }
}

function stopRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
}

/**
 * Every minute while the page is open: the pair read again, unless something on the page is unsaved, a popup is open
 * or a save is in flight. A timeout chain, not an interval, so the next read waits for this one to answer.
 */
function scheduleRefresh(): void {
  stopRefresh()
  if (unmounted) return
  refreshTimer = setTimeout(() => { void refreshTick() }, REFRESH_MS)
}

function quiet(): boolean {
  return !dirty.value && !activePopup.value && !busy.value
}

async function refreshTick(): Promise<void> {
  refreshTimer = null
  const syncPairId = draft.value?.syncPairId
  if (syncPairId && quiet()) {
    try {
      const response = await fetchPair(syncPairId)
      // Something may have changed while the read was out: the page, the pair on show, or the page itself closing.
      if (!unmounted && quiet() && draft.value?.syncPairId === syncPairId) {
        apply(response)
        resetDraft()
        pageError.value = ''
      }
    } catch (error) {
      if (!unmounted) pageError.value = messageOf(error, 'Could not load the sync pair.')
      // The page shows the no and reads no more; reopening it asks again.
      if (refusedOutright(error)) return
    }
  }
  scheduleRefresh()
}

function setActive(on: boolean): void {
  if (draft.value) draft.value.isActive = on
}

function openPopup(popup: Popup): void {
  if (!canEdit.value || busy.value) return
  popupError.value = ''
  activePopup.value = popup
}

function closePopup(): void {
  if (popupBusy.value) return
  activePopup.value = null
  popupError.value = ''
}

function openFact(key: string): void {
  const current = draft.value
  if (!current) return
  if (key === 'every') {
    everyForm.value = current.pulseEveryMinutes ? String(current.pulseEveryMinutes) : OFF
    openPopup('every')
  } else if (key === 'allowance') {
    allowanceForm.value = String(current.allowanceMinutes)
    openPopup('allowance')
  } else if (key === 'run') {
    runForm.value = current.automationId
    openPopup('run')
  } else if (key === 'upstream') {
    if (!current.automationId) return
    upstreamForm.value = current.upstreamSide
    openPopup('upstream')
  } else if (key === 'chat') {
    chatForm.value = current.chatSpaceId || NONE
    openPopup('chat')
  } else if (key === 'hourly') {
    hourlyForm.value = current.hourlySummary
    openPopup('hourly')
  }
}

function saveEvery(): void {
  if (draft.value) draft.value.pulseEveryMinutes = everyForm.value === OFF ? null : Number(everyForm.value)
  closePopup()
}

function saveAllowance(): void {
  if (draft.value) draft.value.allowanceMinutes = Number(allowanceForm.value)
  closePopup()
}

function saveRun(): void {
  const current = draft.value
  if (!current || !runForm.value) return
  // Each run has its own two sides, so a side picked for another run no longer means anything.
  if (current.automationId !== runForm.value) current.upstreamSide = ''
  current.automationId = runForm.value
  closePopup()
}

function saveUpstream(): void {
  if (draft.value && upstreamForm.value) draft.value.upstreamSide = upstreamForm.value
  closePopup()
}

function saveChat(): void {
  if (draft.value) draft.value.chatSpaceId = chatForm.value === NONE ? '' : chatForm.value
  closePopup()
}

function saveHourly(): void {
  if (draft.value) draft.value.hourlySummary = hourlyForm.value
  closePopup()
}

async function deletePair(): Promise<void> {
  const syncPairId = draft.value?.syncPairId
  if (!syncPairId || popupBusy.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    const out = await pulseFacade.deleteSyncPair({ syncPairId })
    const refusal = refusalOf(out, 'Could not delete the sync pair.')
    if (refusal) {
      popupError.value = refusal
      return
    }
    popupBusy.value = false
    closePopup()
    void router.push({ name: 'pulses' })
  } catch (error) {
    popupError.value = messageOf(error, 'Could not delete the sync pair.')
  } finally {
    popupBusy.value = false
  }
}

/**
 * The pair as the page now shows it, laid over what was read: what an edit's save stores. A peak period's override
 * of today's allowance or pulse stays, as only the next read can say what it now is.
 */
function savedFromDraft(pair: SyncPair, current: Draft): SyncPair {
  return {
    ...pair,
    automationId: current.automationId,
    upstreamSide: current.upstreamSide,
    normalAllowanceMinutes: current.allowanceMinutes,
    normalPulseEveryMinutes: current.pulseEveryMinutes,
    ...(allowancePeriodActive.value ? {} : { allowanceMinutes: current.allowanceMinutes }),
    ...(everyPeriodActive.value ? {} : { pulseEveryMinutes: current.pulseEveryMinutes }),
    chatSpaceId: current.chatSpaceId || null,
    hourlySummary: current.hourlySummary ? 'Y' : 'N',
    isActive: current.isActive ? 'Y' : 'N',
  }
}

/** One Save: every fact and the switch together. A new pair then moves to its own address and is read again. */
async function save(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value || !canSave.value) return
  saving.value = true
  pageError.value = ''
  // DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). An edit shows as saved at
  // once and is not read again; the minute's refresh brings the counts. A refusal puts back the unsaved Save,
  // with the typed values still on the page and the reason above them.
  const wasNew = !current.syncPairId
  const was = { saved: saved.value, baseline: baseline.value }
  if (!wasNew && saved.value) {
    saved.value = savedFromDraft(saved.value, current)
    baseline.value = snapshot()
  }
  const putBack = () => {
    if (wasNew) return
    saved.value = was.saved
    baseline.value = was.baseline
  }
  try {
    const out = await pulseFacade.saveSyncPair({
      ...(current.syncPairId ? { syncPairId: current.syncPairId } : {}),
      automationId: current.automationId,
      upstreamSide: current.upstreamSide,
      allowanceMinutes: current.allowanceMinutes,
      // null is off, as none is no chat space: both are sent, so a save never keeps an old value by leaving it out.
      pulseEveryMinutes: current.pulseEveryMinutes,
      chatSpaceId: current.chatSpaceId || null,
      hourlySummary: current.hourlySummary,
      isActive: current.isActive,
    })
    const refusal = refusalOf(out, 'Could not save the sync pair.')
    if (refusal) {
      putBack()
      pageError.value = refusal
      return
    }
    if (!wasNew) return
    current.syncPairId = out.syncPairId
    void router.replace({ name: 'pulse', params: { syncPairId: out.syncPairId } })
    try {
      apply(await fetchPair(out.syncPairId))
      resetDraft()
    } catch (error) {
      // Saved all the same: what is on the page is what was saved.
      baseline.value = snapshot()
      pageError.value = messageOf(error, 'Could not load the sync pair.')
    }
  } catch (error) {
    putBack()
    pageError.value = messageOf(error, 'Could not save the sync pair.')
  } finally {
    saving.value = false
  }
}

// A first Save on /new moves the URL to the pair's own; that is this page already, so it does not reload.
watch(routePairId, (id) => {
  if (id && id === draft.value?.syncPairId) return
  pulseViewLabel.value = ''
  void load(id)
  void loadPulseViewLabel(id)
})

// Esc closes a popup; the delete popup has no cancel of WorkflowStepForm's own to catch it.
function handleCancelRequest(event: Event): void {
  if (!activePopup.value || popupBusy.value) return
  event.preventDefault()
  closePopup()
}

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  void load(routePairId.value)
  void loadPulseViewLabel(routePairId.value)
  scheduleRefresh()
})

async function loadPulseViewLabel(syncPairId: string): Promise<void> {
  if (!syncPairId) return
  try {
    const loaded = await loadSyncPulseView()
    const row = loaded.view.pulsing.find((r) => r.syncPairId === syncPairId)
    if (!unmounted && routePairId.value === syncPairId && row) pulseViewLabel.value = row.label
  } catch {
    // Best effort: the pair's own label stands.
  }
}

onBeforeUnmount(() => {
  unmounted = true
  stopRefresh()
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
})
</script>

<style scoped>

.sync-pair-charts {
  display: grid;
  gap: var(--space-2);
}

/* The orders past the allowance as a bordered list of even rows, like a peak period's run times. */
.sync-pair-rows {
  display: grid;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
  font-size: var(--static-tile-text-size);
}

.sync-pair-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr);
  align-items: center;
  gap: var(--space-3);
  min-height: 3rem;
  padding: var(--space-1) var(--space-3);
  font-variant-numeric: tabular-nums;
}

.sync-pair-row + .sync-pair-row {
  border-top: 1px solid var(--static-tile-border);
}

.sync-pair-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.sync-pair-row--head {
  min-height: 2.4rem;
}

.sync-pair-row__head-label {
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.sync-pair-row__run {
  display: block;
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.sync-pair-row__soft {
  color: var(--text-soft);
}

.sync-pair-popup-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-soft);
}

@media (max-width: 768px) {
  .sync-pair-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
}
</style>
