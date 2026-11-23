<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Queries</h1>
      <p class="section-note">Questions about your own data, answered from what your audits keep, sent when you want.</p>
    </template>

    <LoadingState v-if="loading" noun="queries" />
    <InlineValidation v-else-if="pageError" tone="error" :message="pageError" />
    <p v-else-if="queries.length === 0" class="section-note">No queries yet.</p>

    <ul v-if="rows.length" class="script-rows" data-testid="script-rows">
      <li v-for="row in rows" :key="row.tenantQueryId" class="script-row" data-testid="script-row">
        <span class="script-row__main">
          <span class="script-row__name">{{ row.queryName }}</span>
          <span class="script-row__dim" data-testid="script-row-reads">{{ row.reads }}</span>
        </span>
        <span class="script-row__main">
          <span class="script-row__schedule" data-testid="script-row-schedule">
            <span class="script-row__dot" :data-state="row.state" aria-hidden="true" />{{ row.schedule }}
          </span>
          <span class="script-row__dim" data-testid="script-row-last-run">{{ row.lastRun }}</span>
        </span>
        <span class="script-row__actions">
          <button
            type="button"
            :aria-label="`Open query ${row.queryName}`"
            data-testid="script-row-open"
            @click="openQuery(row.tenantQueryId)"
          >
            Open <span aria-hidden="true">→</span>
          </button>
        </span>
      </li>
    </ul>

    <RouterLink
      v-if="canEdit"
      :to="{ name: 'settings-tenant-script-new' }"
      class="static-page-action-tile static-page-create-action"
      data-testid="script-new"
    >
      New query
    </RouterLink>
  </StaticPageFrame>
</template>

<script setup lang="ts">
// DAR-BE-334 (was DAR-BE-164 / DAR-UI-124's scripts). The active tenant's queries as one list of rows: what each reads,
// when it sends and where, and how its last scheduled run went. Each opens its own page (TenantScriptPage).
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { scriptFacade, settingsFacade } from '../../lib/api/facade'
import type { TenantQuery, TenantQuerySchedule } from '../../lib/api/scriptTypes'
import type { TenantChatSpace } from '../../lib/api/types'
import { isOn, scheduleState, scheduleWords, sendsToWords, statusWords } from '../../lib/scriptDeployment'
import { formatDateTime } from '../../lib/utils/date'
import { usePermissionsStore } from '../../stores/permissions'

const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const queries = ref<TenantQuery[]>([])
const schedules = ref<TenantQuerySchedule[]>([])
const chatSpaces = ref<TenantChatSpace[]>([])
const timeZone = ref('')
const loading = ref(false)
const pageError = ref('')

function spaceName(chatSpaceId: string): string {
  return chatSpaces.value.find((space) => space.chatSpaceId === chatSpaceId)?.spaceName ?? chatSpaceId
}

const rows = computed(() => queries.value.map((query) => {
  // One schedule per query on this page; the backend allows more.
  const schedule = schedules.value.find((item) => item.tenantQueryId === query.tenantQueryId) ?? null
  const sendsTo = schedule ? sendsToWords(schedule.recipientCount, schedule.chatSpaceId ? spaceName(schedule.chatSpaceId) : null) : ''
  let scheduleText = 'Not scheduled'
  if (schedule) {
    scheduleText = isOn(schedule.isActive) ? `${scheduleWords(schedule.cronExpression)} → ${sendsTo}` : `Off · sends to ${sendsTo}`
  }
  const lastRun = schedule?.lastRunDate
    ? `Last run ${formatDateTime(schedule.lastRunDate, { timeZone: timeZone.value })} · ${statusWords(schedule.lastRunStatus).toLowerCase()}`
    : 'Never run on a schedule'
  return {
    tenantQueryId: query.tenantQueryId,
    queryName: query.queryName,
    reads: query.readText || 'Reads nothing: script only',
    schedule: scheduleText,
    state: scheduleState(schedule),
    lastRun,
  }
}))

function openQuery(tenantQueryId: string): void {
  void router.push({ name: 'settings-tenant-script', params: { tenantScriptId: tenantQueryId } })
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

async function load(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const [listed, scheduled] = await Promise.all([
      scriptFacade.listTenantQueries(),
      scriptFacade.listTenantQuerySchedules(),
    ])
    queries.value = listed.queries ?? []
    schedules.value = scheduled.schedules ?? []
    timeZone.value = scheduled.timeZone ?? ''
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the queries.')
  } finally {
    loading.value = false
  }
}

// Names only: a row still reads without them, as the space id.
async function loadNames(): Promise<void> {
  try {
    chatSpaces.value = (await settingsFacade.listTenantChatSpaces()).chatSpaces ?? []
  } catch {
    chatSpaces.value = []
  }
}

onMounted(() => {
  void load()
  void loadNames()
})
</script>

<style scoped>
/* DAR-UI-122's row list (Tenant Settings): one bordered list, every row the same minimum height. */
.script-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.script-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 4rem;
  padding: var(--space-1) var(--space-3);
  font-size: var(--static-tile-text-size);
}

.script-row + .script-row {
  border-top: 1px solid var(--static-tile-border);
}

.script-row__main {
  display: grid;
  min-width: 0;
}

.script-row__name {
  overflow-wrap: anywhere;
}

.script-row__dim {
  color: var(--text-dim);
  font-size: var(--type-note-size);
  overflow-wrap: anywhere;
}

.script-row__schedule {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  overflow-wrap: anywhere;
}

/* The state dot: filled on schedule, hollow off, dashed when the last scheduled run failed. */
.script-row__dot {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border: 1px solid var(--text-dim);
  border-radius: var(--radius-pill);
}

.script-row__dot[data-state='on'] {
  border-color: var(--text);
  background: var(--text);
}

.script-row__dot[data-state='failed'] {
  border-style: dashed;
  border-color: var(--text);
}

.script-row__actions {
  display: flex;
  justify-content: flex-end;
}

.script-row__actions button {
  min-height: 2.2rem;
  padding: var(--space-0) var(--space-2);
  font-size: var(--type-label-size);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .script-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .script-row > .script-row__main:nth-child(2) {
    grid-row: 2;
    grid-column: 1 / -1;
  }
}
</style>
