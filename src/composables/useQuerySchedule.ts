// DAR-BE-334, DAR-UI-126, DAR-OPS-029 U09. A query page's schedule: as saved, as the page stages it until Save, the
// popup's form over it, and the words its fact strip shows. One schedule per query on this page; the backend allows more.
// Scheduling needs tenant admin (it sends the tenant's data out); only the schedule's owner can send it by hand.
import { computed, ref, type Ref } from 'vue'
import { scriptFacade } from '../lib/api/facade'
import type { QueryScheduleOutcome, TenantQuerySchedule } from '../lib/api/scriptTypes'
import type { TenantChatSpace } from '../lib/api/types'
import {
  badRecipient,
  cronFromTime,
  formatRecipients,
  isFailedStatus,
  isOn,
  parseRecipients,
  scheduleWords,
  sendsToWords,
  statusWords,
  timeFromCron,
} from '../lib/scriptDeployment'
import { formatDateTime } from '../lib/utils/date'

/** The schedule as the page holds it until Save. */
export interface StagedSchedule {
  cronExpression: string
  isActive: boolean
  emailTo: string
  emailCc: string
  chatSpaceId: string
}

export interface ScheduleForm {
  time: string
  emailTo: string
  emailCc: string
  chatSpaceId: string
  isActive: boolean
}

export function toStagedSchedule(current: TenantQuerySchedule | null): StagedSchedule | null {
  return current
    ? { cronExpression: current.cronExpression, isActive: isOn(current.isActive), emailTo: current.emailTo ?? '',
        emailCc: current.emailCc ?? '', chatSpaceId: current.chatSpaceId ?? '' }
    : null
}

export interface QueryScheduleOptions {
  timeZone: Ref<string>
  chatSpaces: Ref<TenantChatSpace[]>
  userId: () => string | null | undefined
}

export function useQuerySchedule(options: QueryScheduleOptions) {
  const savedSchedule = ref<TenantQuerySchedule | null>(null)
  const schedule = ref<StagedSchedule | null>(null)
  const scheduleForm = ref<ScheduleForm>({ time: '', emailTo: '', emailCc: '', chatSpaceId: '', isActive: false })

  const isOwner = computed(() => Boolean(savedSchedule.value?.ownerUserId) && savedSchedule.value?.ownerUserId === options.userId())

  const chatSpaceOptions = computed(() => [
    { value: '', label: 'No chat' },
    ...options.chatSpaces.value
      .filter((space) => space.isActive !== 'N')
      .map((space) => ({ value: space.chatSpaceId, label: `${space.spaceName} · ${space.chatProviderLabel}` })),
  ])

  function spaceName(chatSpaceId: string): string {
    return options.chatSpaces.value.find((space) => space.chatSpaceId === chatSpaceId)?.spaceName ?? chatSpaceId
  }

  const scheduleText = computed(() => {
    if (!schedule.value) return 'Not scheduled'
    return schedule.value.isActive ? scheduleWords(schedule.value.cronExpression) : 'Off'
  })
  const sendsToText = computed(() => (schedule.value
    ? sendsToWords(parseRecipients(schedule.value.emailTo).length, schedule.value.chatSpaceId ? spaceName(schedule.value.chatSpaceId) : null)
    : '—'))
  /** The addresses in full, under Sends to, for everyone who can see the query (not only those who can change it). */
  const addressesText = computed(() => {
    const current = schedule.value
    if (!current) return ''
    return [current.emailTo, ...(current.emailCc ? [`cc ${current.emailCc}`] : [])].filter(Boolean).join(' · ')
  })
  const lastRunFailed = computed(() => isFailedStatus(savedSchedule.value?.lastRunStatus))
  const lastRunText = computed(() => {
    const current = savedSchedule.value
    if (!current?.lastRunDate) return 'Never'
    const when = formatDateTime(current.lastRunDate, { timeZone: options.timeZone.value })
    return `${when} · ${statusWords(current.lastRunStatus).toLowerCase()}`
  })

  /** Take the saved schedule as both what is saved and what is staged. */
  function adopt(saved: TenantQuerySchedule | null): void {
    savedSchedule.value = saved
    schedule.value = toStagedSchedule(saved)
  }

  /** The popup opens on what is staged, or on a 09:00 start when nothing is. */
  function fillForm(): void {
    const current = schedule.value
    scheduleForm.value = current
      ? { time: timeFromCron(current.cronExpression) ?? '', emailTo: current.emailTo, emailCc: current.emailCc,
          chatSpaceId: current.chatSpaceId, isActive: current.isActive }
      : { time: '09:00', emailTo: '', emailCc: '', chatSpaceId: '', isActive: false }
  }

  /** Stage what the popup holds. Returns the refusal to show, or null once it is staged. */
  function stageForm(): string | null {
    const form = scheduleForm.value
    const to = parseRecipients(form.emailTo)
    const cc = parseRecipients(form.emailCc)
    const bad = badRecipient([...to, ...cc])
    if (bad) return `${bad} is not an email address.`
    if (!to.length && !form.chatSpaceId) return 'Send it somewhere: an email address or a chat space.'
    // A cron that is not once a day shows no time; left untouched, it is kept as it is.
    const cronExpression = form.time ? cronFromTime(form.time) : schedule.value?.cronExpression ?? null
    if (!cronExpression) return 'Pick the time it runs.'
    schedule.value = { cronExpression, isActive: form.isActive, emailTo: formatRecipients(to), emailCc: formatRecipients(cc),
      chatSpaceId: form.chatSpaceId }
    return null
  }

  function setActive(on: boolean): void {
    if (schedule.value) schedule.value.isActive = on
  }

  /** After the query saved: save the staged schedule when it changed, else read it back (saving a scheduled query's
   *  script makes the saver its owner, so the owner line must be read again). */
  async function persist(tenantQueryId: string, canSchedule: boolean): Promise<void> {
    const staged = schedule.value
    if (staged && canSchedule && JSON.stringify(staged) !== JSON.stringify(toStagedSchedule(savedSchedule.value))) {
      const time = timeFromCron(staged.cronExpression)
      const out = await scriptFacade.saveTenantQuerySchedule({
        scheduleId: savedSchedule.value?.scheduleId,
        tenantQueryId,
        ...(time ? { dailyAt: time } : { cronExpression: staged.cronExpression }),
        isActive: staged.isActive,
        emailTo: staged.emailTo || undefined,
        emailCc: staged.emailCc || undefined,
        chatSpaceId: staged.chatSpaceId || undefined,
      })
      adopt(out.schedule)
    } else if (savedSchedule.value) {
      await reread(tenantQueryId)
    }
  }

  async function reread(tenantQueryId: string): Promise<void> {
    const listed = await scriptFacade.listTenantQuerySchedules({ tenantQueryId })
    savedSchedule.value = (listed.schedules ?? [])[0] ?? savedSchedule.value
  }

  /** What the saved schedule would send (send false), or send it now (owner only; then reread for its last run). */
  async function runSaved(send: boolean): Promise<QueryScheduleOutcome | null> {
    const current = savedSchedule.value
    if (!current || (send && !isOwner.value)) return null
    return (await scriptFacade.runTenantQuerySchedule({ scheduleId: current.scheduleId, send })).outcome
  }

  return {
    savedSchedule, schedule, scheduleForm, isOwner, chatSpaceOptions, scheduleText, sendsToText, addressesText,
    lastRunFailed, lastRunText, adopt, fillForm, stageForm, setActive, persist, reread, runSaved,
  }
}
