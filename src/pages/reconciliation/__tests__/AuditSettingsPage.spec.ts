import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { push, route } = vi.hoisted(() => ({
  push: vi.fn(),
  route: { params: { audit: 'month-close' }, query: { period: '2026-09' } as Record<string, string>, fullPath: '/audits/month-close/settings?period=2026-09' },
}))
vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRoute: () => route,
    useRouter: () => ({ push }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup(props, { slots, attrs }) {
        return () => h('a', { ...attrs, 'data-to': JSON.stringify(props.to) }, slots.default?.())
      },
    }),
  }
})
vi.mock('../../../lib/api/facade', () => ({
  auditFacade: { getAuditSettings: vi.fn(), saveAuditSettings: vi.fn(), addAuditStatement: vi.fn() },
  settingsFacade: { listTenantChatSpaces: vi.fn() },
}))
vi.mock('../../../stores/auth', () => ({ useAuthStore: () => ({ sessionInfo: { activeTenantLabel: 'Gorjana' } }) }))
vi.mock('../../../lib/savedRunEditorRoute', () => ({
  resolveSavedRunEditorTarget: vi.fn(),
  buildSavedRunEditorRoute: vi.fn(() => ({ name: 'settings-runs-edit', params: { reconciliationMappingId: 'S1' } })),
  buildRuleSetDraft: vi.fn(() => null),
}))

import { auditFacade, settingsFacade } from '../../../lib/api/facade'
import { buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../../lib/savedRunEditorRoute'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../../lib/uiEvents'
import type { AuditSettings } from '../../../lib/api/auditTypes'
import AuditSettingsPage from '../AuditSettingsPage.vue'

const f = vi.mocked(auditFacade)
const back = { name: 'audit-report', params: { audit: 'month-close' }, query: { period: '2026-09' } }

function settings(overrides: Partial<AuditSettings['schedule']> = {}): AuditSettings {
  return {
    audit: { id: 'month-close', name: 'Month close', period: 'month' },
    schedule: { active: true, time: '06:00', timeZone: 'America/Los_Angeles', mixed: false, automations: 2, checksWithoutRun: 0, ...overrides },
    statements: [
      { id: 'ST1', code: 'R2', text: 'Every invoice carries the Etail id.', active: true,
        checks: [{ id: 'C1', label: 'Invoices with no Etail id', savedRunId: 'S1', runName: 'NS invoices' }] },
      { id: 'ST2', code: 'R3', text: 'Every store sale carries its store.', active: true,
        checks: [{ id: 'C2', label: 'Store sales with no store', savedRunId: null, runName: null }] },
      { id: 'ST3', code: 'R4', text: 'Every return reaches NetSuite.', active: false, checks: [] },
    ],
  }
}

beforeEach(() => {
  push.mockReset()
  f.getAuditSettings.mockReset()
  f.saveAuditSettings.mockReset()
  f.addAuditStatement.mockReset()
  vi.mocked(resolveSavedRunEditorTarget).mockReset()
  f.getAuditSettings.mockResolvedValue({ ok: true, settings: settings() } as never)
  // No settings in the answer: the page applies what it sent, as it does for a backend that answers without them.
  f.saveAuditSettings.mockResolvedValue({ ok: true } as never)
  vi.mocked(settingsFacade.listTenantChatSpaces).mockReset()
  vi.mocked(settingsFacade.listTenantChatSpaces).mockResolvedValue({ ok: true, chatSpaces: [
    { chatSpaceId: 'spaces/AAA', spaceName: 'Gorjana ops', isActive: 'Y' },
    { chatSpaceId: 'spaces/BBB', spaceName: 'Gorjana accounting', isActive: 'Y' },
    { chatSpaceId: 'spaces/OFF', spaceName: 'Old space', isActive: 'N' },
  ] } as never)
})

type W = VueWrapper

async function mountPage(): Promise<W> {
  const w = mount(AuditSettingsPage, { attachTo: document.body, global: { stubs: { AuditCheckEditor: true } } })
  await flushPromises()
  return w
}
function get(w: W, testId: string) { return w.get(`[data-testid="${testId}"]`) }
function has(w: W, testId: string) { return w.find(`[data-testid="${testId}"]`).exists() }
function select(w: W, testId: string) {
  return w.findAllComponents({ name: 'AppSelect' }).find((c) => c.props('testId') === testId)!
}
function factValue(w: W, testId: string) { return get(w, testId).get('.static-fact__value').text() }
function popupOpen(w: W) { return w.find('.popup-workflow-modal').exists() }
function escape() { document.dispatchEvent(new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })) }
async function click(w: W, testId: string) {
  await get(w, testId).trigger('click')
  await flushPromises()
}

describe('AuditSettingsPage', () => {
  it('opens with the name, the schedule switch, the facts strip and one row per statement', async () => {
    const w = await mountPage()
    expect(f.getAuditSettings).toHaveBeenCalledWith({ audit: 'month-close' }, expect.anything())
    expect(get(w, 'audit-settings-name').text()).toBe('Month close')
    expect(get(w, 'audit-settings-name').attributes('contenteditable')).toBe('plaintext-only')
    expect(get(w, 'audit-settings-schedule-active').attributes('aria-checked')).toBe('true')
    expect(get(w, 'audit-settings-schedule-active').attributes('aria-label')).toBe('Daily schedule')
    expect(factValue(w, 'audit-settings-fact-schedule')).toBe('Daily at 6:00 AM')
    expect(get(w, 'audit-settings-fact-schedule').get('.static-fact__sub').text()).toBe('America/Los_Angeles')
    expect(factValue(w, 'audit-settings-fact-statements')).toBe('2 of 3 on')
    expect(get(w, 'audit-settings-fact-statements').element.tagName).toBe('DIV')
    // A backend before DAR-BE-207 says nothing about the update after each run, so neither fact shows.
    expect(has(w, 'audit-settings-fact-after-run')).toBe(false)
    expect(has(w, 'audit-settings-fact-posts-to')).toBe(false)

    const first = get(w, 'audit-settings-statement-ST1')
    expect(first.text()).toContain('R2')
    expect(first.text()).toContain('Every invoice carries the Etail id.')
    expect(first.text()).toContain('1 check')
    expect(get(w, 'audit-settings-statement-ST3').text()).toContain('No checks')
    expect(get(w, 'audit-settings-statement-active-ST3').attributes('aria-checked')).toBe('false')
    expect(JSON.parse(get(w, 'audit-settings-back').attributes('data-to')!)).toEqual(back)
    w.unmount()
  })

  // DAR-UI-159: Config history left Tenant Settings for here; back from it returns to this audit.
  it('opens config history from the footer, saying which audit it came from', async () => {
    const w = await mountPage()
    expect(JSON.parse(get(w, 'audit-settings-config-history').attributes('data-to')!))
      .toEqual({ name: 'settings-tenant-config-history', query: { audit: 'month-close' } })
    w.unmount()
  })

  it('has no page Save or Cancel, no form and no textarea until a popup opens', async () => {
    const w = await mountPage()
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
    expect(has(w, 'audit-settings-save')).toBe(false)
    expect(has(w, 'audit-settings-cancel')).toBe(false)
    expect(w.text()).not.toContain('Update the audit.')
    expect(popupOpen(w)).toBe(false)
    w.unmount()
  })

  it('saves the name on Enter, and on blur, alone', async () => {
    f.saveAuditSettings.mockResolvedValueOnce({ ok: true, settings: { ...settings(), audit: { id: 'month-close', name: 'System health', period: 'month' } } } as never)
    const w = await mountPage()
    const title = get(w, 'audit-settings-name')
    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = 'System health'
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', name: 'System health' })

    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = 'Daily close'
    await title.trigger('input')
    await title.trigger('blur')
    await flushPromises()
    expect(f.saveAuditSettings).toHaveBeenLastCalledWith({ audit: 'month-close', name: 'Daily close' })
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('leaves an unchanged or blank name unsaved', async () => {
    const w = await mountPage()
    const title = get(w, 'audit-settings-name')
    await title.trigger('focus')
    await title.trigger('keydown', { key: 'Enter' })
    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = '   '
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    w.unmount()
  })

  it('shows a refused rename on the page and keeps the saved name', async () => {
    f.saveAuditSettings.mockRejectedValue(new Error('Your active tenant only has view access for audit changes.'))
    const w = await mountPage()
    const title = get(w, 'audit-settings-name')
    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = 'System health'
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(get(w, 'audit-settings-error').text()).toBe('Your active tenant only has view access for audit changes.')
    expect(title.text()).toBe('Month close')
    w.unmount()
  })

  it('pauses the schedule from the title switch at once, with its time and zone', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-schedule-active')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', schedule: { active: false, time: '06:00', timeZone: 'America/Los_Angeles' } })
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-schedule-active').attributes('aria-checked')).toBe('false')
    expect(factValue(w, 'audit-settings-fact-schedule')).toBe('Off · 6:00 AM')
    w.unmount()
  })

  it('changes the schedule in its popup and saves the whole of it', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-schedule')
    expect(w.get('#audit-settings-popup-title').text()).toBe('Schedule')
    expect(w.findComponent({ name: 'WorkflowTimeSelect' }).props('modelValue')).toBe('06:00')
    expect(select(w, 'audit-settings-schedule-zone').props('modelValue')).toBe('America/Los_Angeles')
    expect(select(w, 'audit-settings-schedule-zone').props('searchable')).toBe(true)
    expect(has(w, 'audit-settings-schedule-mixed')).toBe(false)
    w.findComponent({ name: 'WorkflowTimeSelect' }).vm.$emit('update:modelValue', '07:30')
    select(w, 'audit-settings-schedule-zone').vm.$emit('update:modelValue', 'Asia/Kolkata')
    await flushPromises()
    await click(w, 'audit-settings-schedule-save')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', schedule: { active: true, time: '07:30', timeZone: 'Asia/Kolkata' } })
    expect(popupOpen(w)).toBe(false)
    expect(factValue(w, 'audit-settings-fact-schedule')).toBe('Daily at 7:30 AM')
    w.unmount()
  })

  it('says in the schedule popup when the checks run at different times', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: settings({ mixed: true }) } as never)
    const w = await mountPage()
    await click(w, 'audit-settings-fact-schedule')
    expect(get(w, 'audit-settings-schedule-mixed').text()).toBe('Checks run at different times; a change here sets them all.')
    w.unmount()
  })

  it('closes a popup on Cancel or Esc without writing, and on Save when nothing changed', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-schedule')
    await click(w, 'audit-settings-schedule-cancel')
    expect(popupOpen(w)).toBe(false)
    await click(w, 'audit-settings-fact-schedule')
    escape()
    await flushPromises()
    expect(popupOpen(w)).toBe(false)
    await click(w, 'audit-settings-fact-schedule')
    await click(w, 'audit-settings-schedule-save')
    expect(popupOpen(w)).toBe(false)
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    w.unmount()
  })

  it('flips a statement from its row switch at once, without opening it', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-active-ST1')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', statements: [{ id: 'ST1', active: false }] })
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-statement-active-ST1').attributes('aria-checked')).toBe('false')
    expect(factValue(w, 'audit-settings-fact-statements')).toBe('1 of 3 on')
    w.unmount()
  })

  it('opens a statement from its row, and saves its words alone', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-ST2')
    expect(w.get('#audit-settings-popup-title').text()).toBe('Statement R3')
    const text = get(w, 'audit-settings-statement-text')
    expect((text.element as HTMLTextAreaElement).value).toBe('Every store sale carries its store.')
    await text.setValue(' Every store sale names its store. ')
    await click(w, 'audit-settings-statement-save')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', statements: [{ id: 'ST2', text: 'Every store sale names its store.' }] })
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-statement-ST2').text()).toContain('Every store sale names its store.')
    w.unmount()
  })

  // DAR-UI-156: the popup has closed by the time the backend answers, so a refusal says why on the page.
  it('puts a refused statement\'s words back and says why on the page', async () => {
    f.saveAuditSettings.mockResolvedValue({ ok: false, errors: ['Statement ST2 needs its text.'] } as never)
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-ST2')
    await get(w, 'audit-settings-statement-text').setValue('Every store sale names its store.')
    await click(w, 'audit-settings-statement-save')
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-error').text()).toBe('Statement ST2 needs its text.')
    expect(get(w, 'audit-settings-statement-ST2').text()).toContain('Every store sale carries its store.')
    w.unmount()
  })

  it('lists the statement\'s checks; one with a run opens its rules', async () => {
    vi.mocked(resolveSavedRunEditorTarget).mockResolvedValue({ savedRunId: 'S1', runType: 'mapping', reconciliationMappingId: 'S1' } as never)
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-ST1')
    expect(get(w, 'audit-settings-check-C1').text()).toContain('Invoices with no Etail id')
    expect(get(w, 'audit-settings-check-C1').text()).toContain('NS invoices')
    const rules = get(w, 'audit-settings-check-rules-C1')
    expect(rules.attributes('aria-label')).toBe('Open rules for Invoices with no Etail id')
    await rules.trigger('click')
    await flushPromises()
    expect(resolveSavedRunEditorTarget).toHaveBeenCalledWith('S1')
    expect(buildSavedRunEditorRoute).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'settings-runs-edit', params: { reconciliationMappingId: 'S1' } })
    w.unmount()
  })

  it('shows a check whose run is unknown with nowhere to go', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-ST2')
    expect(get(w, 'audit-settings-check-C2').text()).toContain('Store sales with no store')
    expect(has(w, 'audit-settings-check-rules-C2')).toBe(false)
    w.unmount()
  })

  // DAR-UI-064: Add check opens today's editor in a popup of its own and comes back to the statement.
  it('adds a check in its own popup and returns to the statement, its words kept', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-ST3')
    await get(w, 'audit-settings-statement-text').setValue('Every return reaches NetSuite in a day.')
    await click(w, 'audit-settings-add-check')
    const editor = w.findComponent({ name: 'AuditCheckEditor' })
    expect(editor.exists()).toBe(true)
    expect(editor.props()).toEqual({ audit: 'month-close', statement: 'R4' })
    expect(w.get('#audit-settings-popup-title').text()).toBe('Statement R4')
    expect(has(w, 'audit-settings-statement-text')).toBe(false)

    const fresh = settings()
    fresh.statements[2]!.checks = [{ id: 'C3', label: 'Returns not in NetSuite', savedRunId: 'S3', runName: 'Returns' }]
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: fresh } as never)
    editor.vm.$emit('saved', { id: 'C3' })
    await flushPromises()
    expect(f.getAuditSettings).toHaveBeenCalledTimes(2)
    expect(w.findComponent({ name: 'AuditCheckEditor' }).exists()).toBe(false)
    expect((get(w, 'audit-settings-statement-text').element as HTMLTextAreaElement).value).toBe('Every return reaches NetSuite in a day.')
    expect(get(w, 'audit-settings-check-C3').text()).toContain('Returns not in NetSuite')
    expect(get(w, 'audit-settings-statement-ST3').text()).toContain('1 check')
    w.unmount()
  })

  it('goes back to the statement from the check editor on its Cancel or on Esc', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-ST1')
    await click(w, 'audit-settings-add-check')
    w.findComponent({ name: 'AuditCheckEditor' }).vm.$emit('cancel')
    await flushPromises()
    expect(has(w, 'audit-settings-statement-text')).toBe(true)
    await click(w, 'audit-settings-add-check')
    escape()
    await flushPromises()
    expect(has(w, 'audit-settings-statement-text')).toBe(true)
    expect(popupOpen(w)).toBe(true)
    w.unmount()
  })

  // DAR-UI-078. A new audit gets its statements here: saved at once, listed as saved, so a check can be added to it.
  it('adds a new statement from the create tile', async () => {
    f.addAuditStatement.mockResolvedValue({ ok: true,
      statement: { id: 'ST4', code: 'R5', text: 'Every exchange ships within three days.', active: true, checks: [] } } as never)
    const w = await mountPage()
    await click(w, 'audit-settings-new-open')
    expect(w.get('#audit-settings-popup-title').text()).toBe('New statement')
    await get(w, 'audit-settings-new-text').setValue(' Every exchange ships within three days. ')
    select(w, 'audit-settings-new-category').vm.$emit('update:modelValue', 'exchangesAndWarranty')
    select(w, 'audit-settings-new-weight').vm.$emit('update:modelValue', 'firm')
    await flushPromises()
    await click(w, 'audit-settings-new-save')
    expect(f.addAuditStatement).toHaveBeenCalledWith({ audit: 'month-close', text: 'Every exchange ships within three days.',
      category: 'exchangesAndWarranty', weight: 'firm' })
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-statement-ST4').text()).toContain('R5')
    expect(factValue(w, 'audit-settings-fact-statements')).toBe('3 of 4 on')
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    w.unmount()
  })

  it('keeps the new statement popup open with the refusal in it', async () => {
    f.addAuditStatement.mockResolvedValue({ ok: false, errors: ['Statement text is required.'] } as never)
    const w = await mountPage()
    await click(w, 'audit-settings-new-open')
    await get(w, 'audit-settings-new-text').setValue('Every exchange ships.')
    await click(w, 'audit-settings-new-save')
    expect(get(w, 'audit-settings-popup-error').text()).toBe('Statement text is required.')
    expect(popupOpen(w)).toBe(true)
    w.unmount()
  })

  it('opens a new audit with the new statement popup ready, and Enter saves it', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), statements: [] } } as never)
    f.addAuditStatement.mockResolvedValue({ ok: true,
      statement: { id: 'ST1', code: 'R1', text: 'Every return reaches NetSuite.', active: true, checks: [] } } as never)
    const w = await mountPage()
    const box = get(w, 'audit-settings-new-text')
    expect(document.activeElement).toBe(box.element)
    await box.setValue('Every return reaches NetSuite.')
    await box.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(f.addAuditStatement).toHaveBeenCalledTimes(1)
    expect(has(w, 'audit-settings-statement-ST1')).toBe(true)
    expect(popupOpen(w)).toBe(false)
    w.unmount()
  })

  it('says so when the audit cannot be read', async () => {
    f.getAuditSettings.mockRejectedValue(new Error('Audit month-close was not found'))
    const w = await mountPage()
    expect(get(w, 'audit-settings-error').text()).toBe('Audit month-close was not found')
    expect(has(w, 'audit-settings-facts')).toBe(false)
    expect(has(w, 'audit-settings-back')).toBe(true)
    w.unmount()
  })
})

// DAR-BE-207 / DAR-UI-111. The update after each run: on/off and extra addresses, and the chat space for its card.
describe('AuditSettingsPage after each run', () => {
  const runEmail = { active: true, alsoSendTo: ['ops@gorjana.com'], members: 4, chatSpaceId: 'spaces/AAA' }
  beforeEach(() => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail } } as never)
  })
  function address(w: W) { return get(w, 'audit-settings-run-email').get('input[type="text"]') }
  function chips(w: W) { return w.findAll('[data-testid="workflow-chip-text-chip"]').map((c) => c.text().replace('×', '').trim()) }

  it('states who gets it and where the card posts', async () => {
    const w = await mountPage()
    expect(factValue(w, 'audit-settings-fact-after-run')).toBe('Email to 4 people + 1 more')
    expect(get(w, 'audit-settings-fact-after-run').attributes('aria-label')).toBe('After each run: Email to 4 people + 1 more')
    expect(factValue(w, 'audit-settings-fact-posts-to')).toBe('Gorjana ops')
    expect(get(w, 'audit-settings-fact-posts-to').attributes('aria-label')).toBe('Audit posts to: Gorjana ops')
    w.unmount()
  })

  it('reads Off when it is off, and None with no space', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail: { ...runEmail, active: false, chatSpaceId: null } } } as never)
    const w = await mountPage()
    expect(factValue(w, 'audit-settings-fact-after-run')).toBe('Off')
    expect(factValue(w, 'audit-settings-fact-posts-to')).toBe('None')
    w.unmount()
  })

  it('opens with the switch, the members line, and the chips below the address box', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-after-run')
    expect(w.get('#audit-settings-popup-title').text()).toBe('After each run')
    expect(get(w, 'audit-settings-run-email-active').attributes('aria-checked')).toBe('true')
    expect(get(w, 'audit-settings-run-email-members').text()).toBe('Sent to the 4 people with access to Gorjana')
    expect(chips(w)).toEqual(['ops@gorjana.com'])
    const input = address(w).element
    const chipRow = w.get('.workflow-select-chip-row').element
    expect(input.compareDocumentPosition(chipRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    w.unmount()
  })

  it('adds an address by Enter and one still typed at Save, keeping the chat space', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-after-run')
    await address(w).setValue('finance@gorjana.com')
    await address(w).trigger('keydown', { key: 'Enter' })
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    await address(w).setValue('cfo@gorjana.com')
    await click(w, 'audit-settings-run-email-save')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close',
      runEmail: { active: true, alsoSendTo: ['ops@gorjana.com', 'finance@gorjana.com', 'cfo@gorjana.com'], chatSpaceId: 'spaces/AAA' } })
    expect(popupOpen(w)).toBe(false)
    expect(factValue(w, 'audit-settings-fact-after-run')).toBe('Email to 4 people + 3 more')
    w.unmount()
  })

  it('refuses a malformed address, keeps it typed, and Save does not write', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-after-run')
    await address(w).setValue('finance@gorjana')
    await address(w).trigger('keydown', { key: 'Enter' })
    expect(get(w, 'audit-settings-address-error').text()).toBe('finance@gorjana is not an email address.')
    expect(chips(w)).toHaveLength(1)
    expect((address(w).element as HTMLInputElement).value).toBe('finance@gorjana')
    await click(w, 'audit-settings-run-email-save')
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    expect(popupOpen(w)).toBe(true)
    w.unmount()
  })

  it('turns it off from the popup, with its addresses', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-after-run')
    await click(w, 'audit-settings-run-email-active')
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    await click(w, 'audit-settings-run-email-save')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close',
      runEmail: { active: false, alsoSendTo: ['ops@gorjana.com'], chatSpaceId: 'spaces/AAA' } })
    w.unmount()
  })

  it('takes back an address the backend refuses and names it on the page', async () => {
    f.saveAuditSettings.mockRejectedValue(new Error('Not an email address: cfo@gorjana.con'))
    const w = await mountPage()
    await click(w, 'audit-settings-fact-after-run')
    await address(w).setValue('cfo@gorjana.con')
    await click(w, 'audit-settings-run-email-save')
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-error').text()).toBe('Not an email address: cfo@gorjana.con')
    expect(factValue(w, 'audit-settings-fact-after-run')).toBe('Email to 4 people + 1 more')
    w.unmount()
  })

  it('lists None and the tenant\'s active spaces, the saved one picked', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-posts-to')
    expect(w.get('#audit-settings-popup-title').text()).toBe('Posts to')
    expect(select(w, 'audit-settings-chat-space').props('modelValue')).toBe('spaces/AAA')
    expect(select(w, 'audit-settings-chat-space').props('options')).toEqual([
      { value: '', label: 'None' },
      { value: 'spaces/AAA', label: 'Gorjana ops' },
      { value: 'spaces/BBB', label: 'Gorjana accounting' },
    ])
    w.unmount()
  })

  it('saves a new space with the email as it is, and None clears it', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-fact-posts-to')
    select(w, 'audit-settings-chat-space').vm.$emit('update:modelValue', 'spaces/BBB')
    await flushPromises()
    await click(w, 'audit-settings-chat-space-save')
    expect(f.saveAuditSettings).toHaveBeenLastCalledWith({ audit: 'month-close',
      runEmail: { active: true, alsoSendTo: ['ops@gorjana.com'], chatSpaceId: 'spaces/BBB' } })
    expect(factValue(w, 'audit-settings-fact-posts-to')).toBe('Gorjana accounting')

    await click(w, 'audit-settings-fact-posts-to')
    select(w, 'audit-settings-chat-space').vm.$emit('update:modelValue', '')
    await flushPromises()
    await click(w, 'audit-settings-chat-space-save')
    expect(f.saveAuditSettings).toHaveBeenLastCalledWith({ audit: 'month-close',
      runEmail: { active: true, alsoSendTo: ['ops@gorjana.com'], chatSpaceId: null } })
    expect(factValue(w, 'audit-settings-fact-posts-to')).toBe('None')
    w.unmount()
  })

  it('keeps a saved space that is off, or a list that did not load, as a choice', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail: { ...runEmail, chatSpaceId: 'spaces/OFF' } } } as never)
    const w = await mountPage()
    await click(w, 'audit-settings-fact-posts-to')
    expect(select(w, 'audit-settings-chat-space').props('options')).toContainEqual({ value: 'spaces/OFF', label: 'Old space' })
    w.unmount()

    vi.mocked(settingsFacade.listTenantChatSpaces).mockRejectedValue(new Error('down'))
    const v = await mountPage()
    await click(v, 'audit-settings-fact-posts-to')
    expect(select(v, 'audit-settings-chat-space').props('options')).toEqual([{ value: '', label: 'None' }, { value: 'spaces/OFF', label: 'spaces/OFF' }])
    expect(has(v, 'audit-settings-error')).toBe(false)
    v.unmount()
  })

  // DAR-BE-256. The sender drops the card silently when its space cannot be used; the page says so.
  function problem(w: W, testId = 'audit-settings-chat-space-problem'): string | null {
    const node = w.find(`[data-testid="${testId}"]`)
    return node.exists() ? node.text() : null
  }

  it.each([
    ['spaces/OFF', 'This chat space is turned off, so no card is sent.'],
    ['spaces/GONE', 'This chat space no longer exists, so no card is sent.'],
    ['spaces/NOHOOK', 'This chat space has no webhook or Slack channel, so no card is sent.'],
  ])('warns when the saved space %s cannot be posted to, and the popup clears it for a usable pick', async (chatSpaceId, warning) => {
    vi.mocked(settingsFacade.listTenantChatSpaces).mockResolvedValue({ ok: true, chatSpaces: [
      { chatSpaceId: 'spaces/AAA', spaceName: 'Gorjana ops', isActive: 'Y', webhookConfigured: true },
      { chatSpaceId: 'spaces/OFF', spaceName: 'Old space', isActive: 'N', webhookConfigured: true },
      { chatSpaceId: 'spaces/NOHOOK', spaceName: 'Half set up', isActive: 'Y', webhookConfigured: false },
    ] } as never)
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail: { ...runEmail, chatSpaceId } } } as never)
    const w = await mountPage()
    expect(problem(w)).toBe(warning)
    await click(w, 'audit-settings-fact-posts-to')
    expect(problem(w, 'audit-settings-picked-space-problem')).toBe(warning)
    select(w, 'audit-settings-chat-space').vm.$emit('update:modelValue', 'spaces/AAA')
    await flushPromises()
    expect(problem(w, 'audit-settings-picked-space-problem')).toBeNull()
    w.unmount()
  })

  it('says nothing about a usable space, or when the list did not load', async () => {
    const w = await mountPage()
    expect(problem(w)).toBeNull()
    w.unmount()

    vi.mocked(settingsFacade.listTenantChatSpaces).mockRejectedValue(new Error('down'))
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail: { ...runEmail, chatSpaceId: 'spaces/GONE' } } } as never)
    const v = await mountPage()
    expect(problem(v)).toBeNull()
    v.unmount()
  })

  it('is plain text for someone who cannot edit it, opens nothing, and still warns', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail: { ...runEmail, chatSpaceId: 'spaces/OFF', canEdit: false } } } as never)
    const w = await mountPage()
    for (const fact of ['audit-settings-fact-after-run', 'audit-settings-fact-posts-to']) {
      expect(get(w, fact).element.tagName).toBe('DIV')
      await click(w, fact)
      expect(popupOpen(w)).toBe(false)
    }
    expect(factValue(w, 'audit-settings-fact-posts-to')).toBe('Old space')
    expect(problem(w)).toBe('This chat space is turned off, so no card is sent.')
    // The rest of the page is theirs to change, as before.
    expect(get(w, 'audit-settings-fact-schedule').element.tagName).toBe('BUTTON')
    await click(w, 'audit-settings-statement-active-ST1')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', statements: [{ id: 'ST1', active: false }] })
    w.unmount()
  })
})

// DAR-UI-140. How soon a broken statement must be fixed, and under it a reason's own level.
describe('AuditSettingsPage priorities', () => {
  const twoChecks = [
    { id: 'C11', label: 'Orders not in the OMS', savedRunId: null, runName: null },
    { id: 'C12', label: 'Orders held in the OMS', savedRunId: null, runName: null },
  ]
  function prioritySettings(): AuditSettings {
    return {
      ...settings(),
      statements: [
        { id: 'R11', code: 'R11', text: 'Every order reaches the OMS.', active: true, priority: 'P0', checks: twoChecks, reasons: [
          // A stale level on a reason that closes on every check: still reads Closes, and opens nothing.
          { conclusion: 'CONC_ALL', label: 'Order cancelled in Shopify', priority: 'P1', closes: 'all', closesOn: 2, checks: 2 },
          { conclusion: 'CONC_SOME', label: 'Order on hold for fraud', priority: null, closes: 'some', closesOn: 1, checks: 2 },
          { conclusion: 'CONC_NONE', label: 'Gift card only', priority: 'KNOWN', closes: 'none', closesOn: 0, checks: 2 },
        ] },
        { id: 'R5', code: 'R5', text: 'Every refund reaches NetSuite.', active: true, priority: 'P2', checks: twoChecks, reasons: [
          { conclusion: 'CONC_X', label: 'Refund still pending', priority: null, closes: 'none', closesOn: 0, checks: 2 },
        ] },
      ],
    }
  }
  beforeEach(() => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: prioritySettings() } as never)
  })
  // A level reads as plain words ("P0 today"); Aditi: no marks.
  function parts(node: Element) {
    return [...node.querySelectorAll('.audit-level__word')].map((part) => part.textContent?.trim()).join(' ')
  }
  function levelText(w: W, testId: string) { return parts(get(w, testId).element) }
  // The level popup's lettered cards: each card's label, in order.
  function options(w: W) { return w.findAll('.workflow-shortcut-choice-card__label').map((label) => label.text()) }

  it('aStatementRowsPriorityCellOpensItsPopup', async () => {
    const w = await mountPage()
    const cell = get(w, 'audit-settings-priority-R11')
    expect(cell.element.tagName).toBe('BUTTON')
    expect(levelText(w, 'audit-settings-priority-R11')).toBe('P0 today')
    expect(cell.text()).not.toMatch(/Change|Edit/)

    await click(w, 'audit-settings-priority-R11')
    expect(popupOpen(w)).toBe(true)
    expect(w.get('.wizard-question').text()).toBe('How soon must a broken R11 be fixed?')
    expect(options(w)).toEqual(['P0 today', 'P1 this week', 'P2 later', 'Known owned'])
    expect(get(w, 'audit-settings-level-P0').attributes('aria-pressed')).toBe('true')
    await click(w, 'audit-settings-level-P1')
    expect(get(w, 'audit-settings-level-P1').attributes('aria-pressed')).toBe('true')
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    await click(w, 'audit-settings-priority-save')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', statements: [{ id: 'R11', priority: 'P1' }] })
    expect(popupOpen(w)).toBe(false)
    expect(levelText(w, 'audit-settings-priority-R11')).toBe('P1 this week')
    w.unmount()
  })

  it('closes the priority popup on Cancel, and on Save with the level unchanged, without writing', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-priority-R5')
    await click(w, 'audit-settings-level-KNOWN')
    await click(w, 'audit-settings-priority-cancel')
    expect(popupOpen(w)).toBe(false)
    await click(w, 'audit-settings-priority-R5')
    expect(get(w, 'audit-settings-level-P2').attributes('aria-pressed')).toBe('true')
    await click(w, 'audit-settings-priority-save')
    expect(popupOpen(w)).toBe(false)
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    w.unmount()
  })

  it('keeps a statement\'s level through a save that does not name it, and reads P2 once cleared', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-active-R11')
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', statements: [{ id: 'R11', active: false }] })
    expect(levelText(w, 'audit-settings-priority-R11')).toBe('P0 today')

    // A cleared level (null) with no settings in the answer reads as the backend reads it: P2. No row sends null
    // today, so the save goes in through the page's own persist.
    const vm = w.vm as unknown as { persist: (change: object) => Promise<boolean> }
    expect(await vm.persist({ statements: [{ id: 'R11', priority: null }] })).toBe(true)
    await flushPromises()
    expect(levelText(w, 'audit-settings-priority-R11')).toBe('P2 later')
    w.unmount()
  })

  it('reasonsListInTheStatementPopup', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-R11')
    const all = get(w, 'audit-settings-reason-CONC_ALL')
    expect(all.text()).toContain('Order cancelled in Shopify')
    expect(all.text()).toContain('Closes')
    expect(all.find('button').exists()).toBe(false)
    expect(all.find('.audit-level__word').exists()).toBe(false)

    const some = get(w, 'audit-settings-reason-CONC_SOME')
    expect(some.text()).toContain('Order on hold for fraud')
    expect(get(w, 'audit-settings-reason-closes-CONC_SOME').text()).toBe('Closes on 1 of 2 checks')
    expect(get(w, 'audit-settings-reason-priority-CONC_SOME').element.tagName).toBe('BUTTON')
    expect(levelText(w, 'audit-settings-reason-priority-CONC_SOME')).toBe('Same as R11')

    expect(levelText(w, 'audit-settings-reason-priority-CONC_NONE')).toBe('Known owned')
    expect(has(w, 'audit-settings-reason-closes-CONC_NONE')).toBe(false)
    expect(has(w, 'audit-settings-reason-priority-CONC_ALL')).toBe(false)
    w.unmount()
  })

  it('savingAReasonLevel', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-R5')
    await click(w, 'audit-settings-reason-priority-CONC_X')
    // One popup at a time: the statement's gives way to the reason's.
    expect(has(w, 'audit-settings-statement-text')).toBe(false)
    expect(w.findAll('.popup-workflow-modal')).toHaveLength(1)
    expect(w.get('.wizard-question').text()).toBe('How soon must "Refund still pending" on R5 be fixed?')
    expect(options(w)).toEqual(['Same as R5', 'P0 today', 'P1 this week', 'P2 later', 'Known owned'])
    expect(get(w, 'audit-settings-level-same').attributes('aria-pressed')).toBe('true')
    await click(w, 'audit-settings-level-KNOWN')
    await click(w, 'audit-settings-reason-priority-save')
    expect(f.saveAuditSettings).toHaveBeenLastCalledWith({ audit: 'month-close',
      reasons: [{ statement: 'R5', conclusion: 'CONC_X', priority: 'KNOWN' }] })
    // Back in the statement's popup, the reason at its new level.
    expect(has(w, 'audit-settings-statement-text')).toBe(true)
    expect(levelText(w, 'audit-settings-reason-priority-CONC_X')).toBe('Known owned')

    await click(w, 'audit-settings-reason-priority-CONC_X')
    await click(w, 'audit-settings-level-same')
    await click(w, 'audit-settings-reason-priority-save')
    expect(f.saveAuditSettings).toHaveBeenLastCalledWith({ audit: 'month-close',
      reasons: [{ statement: 'R5', conclusion: 'CONC_X', priority: null }] })
    expect(levelText(w, 'audit-settings-reason-priority-CONC_X')).toBe('Same as R5')
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('goes back to the statement from a reason\'s level on Cancel, its words kept', async () => {
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-R5')
    await get(w, 'audit-settings-statement-text').setValue('Every refund reaches NetSuite in a day.')
    await click(w, 'audit-settings-reason-priority-CONC_X')
    await click(w, 'audit-settings-reason-priority-cancel')
    expect((get(w, 'audit-settings-statement-text').element as HTMLTextAreaElement).value).toBe('Every refund reaches NetSuite in a day.')
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    w.unmount()
  })

  // DAR-UI-156: back in the statement's popup at once; a refusal puts the level back and says why there.
  it('aRefusedReasonLevelGoesBackAndSaysWhyInTheStatementPopup', async () => {
    f.saveAuditSettings.mockRejectedValue(new Error('Reason CONC_X closes on every check of R5, so it takes no level.'))
    const w = await mountPage()
    await click(w, 'audit-settings-statement-open-R5')
    await click(w, 'audit-settings-reason-priority-CONC_X')
    await click(w, 'audit-settings-level-P0')
    await click(w, 'audit-settings-reason-priority-save')
    expect(has(w, 'audit-settings-statement-text')).toBe(true)
    expect(get(w, 'audit-settings-popup-error').text()).toBe('Reason CONC_X closes on every check of R5, so it takes no level.')
    expect(levelText(w, 'audit-settings-reason-priority-CONC_X')).toBe('Same as R5')
    expect(has(w, 'audit-settings-error')).toBe(false)
    w.unmount()
  })

  it('aLevelShowsAndItsPopupClosesBeforeTheSaveAnswers', async () => {
    f.saveAuditSettings.mockReturnValue(new Promise(() => {}) as never)
    const w = await mountPage()
    await click(w, 'audit-settings-priority-R11')
    await click(w, 'audit-settings-level-P1')
    await click(w, 'audit-settings-priority-save')
    expect(popupOpen(w)).toBe(false)
    expect(levelText(w, 'audit-settings-priority-R11')).toBe('P1 this week')

    await click(w, 'audit-settings-statement-open-R5')
    await click(w, 'audit-settings-reason-priority-CONC_X')
    await click(w, 'audit-settings-level-KNOWN')
    await click(w, 'audit-settings-reason-priority-save')
    expect(has(w, 'audit-settings-statement-text')).toBe(true)
    expect(levelText(w, 'audit-settings-reason-priority-CONC_X')).toBe('Known owned')
    // The second save waits its turn behind the first, which never answers.
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})

// DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). The screen changes at once,
// the saves run behind it one after another, and only a refusal changes it again.
describe('AuditSettingsPage saves behind the screen', () => {
  const runEmail = { active: true, alsoSendTo: ['ops@gorjana.com'], members: 4, chatSpaceId: 'spaces/AAA' }
  function deferred() {
    let resolve!: (value: unknown) => void
    const promise = new Promise((done) => { resolve = done })
    return { promise, resolve }
  }
  async function rename(w: W, name: string) {
    const title = get(w, 'audit-settings-name')
    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = name
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await flushPromises()
  }

  it('flips the switches and takes the name before the save answers', async () => {
    f.saveAuditSettings.mockReturnValue(new Promise(() => {}) as never)
    const w = await mountPage()
    await click(w, 'audit-settings-schedule-active')
    expect(get(w, 'audit-settings-schedule-active').attributes('aria-checked')).toBe('false')
    expect(factValue(w, 'audit-settings-fact-schedule')).toBe('Off · 6:00 AM')
    await click(w, 'audit-settings-statement-active-ST1')
    expect(get(w, 'audit-settings-statement-active-ST1').attributes('aria-checked')).toBe('false')
    expect(factValue(w, 'audit-settings-fact-statements')).toBe('1 of 3 on')
    // Nothing waits on the save: the switches stay live.
    expect(get(w, 'audit-settings-statement-active-ST2').attributes('disabled')).toBeUndefined()
    await rename(w, 'System health')
    expect(get(w, 'audit-settings-name').text()).toBe('System health')
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('closes each popup with its change shown before the save answers', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { ...settings(), runEmail } } as never)
    f.saveAuditSettings.mockReturnValue(new Promise(() => {}) as never)
    const w = await mountPage()
    await click(w, 'audit-settings-fact-schedule')
    w.findComponent({ name: 'WorkflowTimeSelect' }).vm.$emit('update:modelValue', '07:30')
    await flushPromises()
    await click(w, 'audit-settings-schedule-save')
    expect(popupOpen(w)).toBe(false)
    expect(factValue(w, 'audit-settings-fact-schedule')).toBe('Daily at 7:30 AM')

    await click(w, 'audit-settings-fact-after-run')
    await click(w, 'audit-settings-run-email-active')
    await click(w, 'audit-settings-run-email-save')
    expect(popupOpen(w)).toBe(false)
    expect(factValue(w, 'audit-settings-fact-after-run')).toBe('Off')

    await click(w, 'audit-settings-fact-posts-to')
    select(w, 'audit-settings-chat-space').vm.$emit('update:modelValue', 'spaces/BBB')
    await flushPromises()
    await click(w, 'audit-settings-chat-space-save')
    expect(popupOpen(w)).toBe(false)
    expect(factValue(w, 'audit-settings-fact-posts-to')).toBe('Gorjana accounting')

    await click(w, 'audit-settings-statement-open-ST2')
    await get(w, 'audit-settings-statement-text').setValue('Every store sale names its store.')
    await click(w, 'audit-settings-statement-save')
    expect(popupOpen(w)).toBe(false)
    expect(get(w, 'audit-settings-statement-ST2').text()).toContain('Every store sale names its store.')
    w.unmount()
  })

  // Review: a late answer to another save used to reset the name box, wiping a name being typed.
  it('keeps a name being typed when another save answers', async () => {
    const save = deferred()
    f.saveAuditSettings.mockReturnValueOnce(save.promise as never)
    const w = await mountPage()
    await click(w, 'audit-settings-schedule-active')
    const title = get(w, 'audit-settings-name')
    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = 'System he'
    await title.trigger('input')
    save.resolve({ ok: true })
    await flushPromises()
    expect(get(w, 'audit-settings-name').text()).toBe('System he')
    w.unmount()
  })

  // Review: a refusal belongs to the popup that made the change, not one opened since.
  it('says a refusal on the page once its popup has closed, even with another popup open', async () => {
    const save = deferred()
    f.saveAuditSettings.mockReturnValueOnce(save.promise as never)
    const w = await mountPage()
    await click(w, 'audit-settings-fact-schedule')
    w.findComponent({ name: 'WorkflowTimeSelect' }).vm.$emit('update:modelValue', '07:30')
    await flushPromises()
    await click(w, 'audit-settings-schedule-save')
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(1)
    expect(popupOpen(w)).toBe(false)
    await click(w, 'audit-settings-fact-schedule')
    expect(popupOpen(w)).toBe(true)
    save.resolve({ ok: false, errors: ['Your active tenant only has view access for audit changes.'] })
    await flushPromises()
    expect(get(w, 'audit-settings-error').text()).toBe('Your active tenant only has view access for audit changes.')
    w.unmount()
  })

  it('puts a refused switch back and says why on the page', async () => {
    f.saveAuditSettings.mockRejectedValue(new Error('Your active tenant only has view access for audit changes.'))
    const w = await mountPage()
    await click(w, 'audit-settings-schedule-active')
    expect(get(w, 'audit-settings-schedule-active').attributes('aria-checked')).toBe('true')
    expect(factValue(w, 'audit-settings-fact-schedule')).toBe('Daily at 6:00 AM')
    expect(get(w, 'audit-settings-error').text()).toBe('Your active tenant only has view access for audit changes.')

    f.saveAuditSettings.mockResolvedValue({ ok: false, errors: ['Statement ST1 is locked.'] } as never)
    await click(w, 'audit-settings-statement-active-ST1')
    expect(get(w, 'audit-settings-statement-active-ST1').attributes('aria-checked')).toBe('true')
    expect(factValue(w, 'audit-settings-fact-statements')).toBe('2 of 3 on')
    expect(get(w, 'audit-settings-error').text()).toBe('Statement ST1 is locked.')
    w.unmount()
  })

  it('saves in order, and an older answer does not undo a newer change', async () => {
    const first = deferred()
    const second = deferred()
    f.saveAuditSettings.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never)
    const w = await mountPage()
    await click(w, 'audit-settings-statement-active-ST1')
    await click(w, 'audit-settings-statement-active-ST1')
    expect(get(w, 'audit-settings-statement-active-ST1').attributes('aria-checked')).toBe('true')
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(1)

    // The first answer says ST1 is off, as it was then; the newer "on" still saving stays on screen.
    const off = settings()
    off.statements[0]!.active = false
    first.resolve({ ok: true, settings: off })
    await flushPromises()
    expect(get(w, 'audit-settings-statement-active-ST1').attributes('aria-checked')).toBe('true')
    expect(f.saveAuditSettings).toHaveBeenCalledTimes(2)
    expect(f.saveAuditSettings).toHaveBeenLastCalledWith({ audit: 'month-close', statements: [{ id: 'ST1', active: true }] })

    second.resolve({ ok: true })
    await flushPromises()
    expect(get(w, 'audit-settings-statement-active-ST1').attributes('aria-checked')).toBe('true')
    expect(has(w, 'audit-settings-error')).toBe(false)
    w.unmount()
  })

  it('takes back only the refused change, keeping a newer one still saving', async () => {
    const first = deferred()
    f.saveAuditSettings.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(new Promise(() => {}) as never)
    const w = await mountPage()
    await click(w, 'audit-settings-schedule-active')
    await click(w, 'audit-settings-statement-active-ST2')
    first.resolve({ ok: false, errors: ['The schedule is locked.'] })
    await flushPromises()
    expect(get(w, 'audit-settings-schedule-active').attributes('aria-checked')).toBe('true')
    expect(get(w, 'audit-settings-statement-active-ST2').attributes('aria-checked')).toBe('false')
    expect(get(w, 'audit-settings-error').text()).toBe('The schedule is locked.')
    w.unmount()
  })
})
