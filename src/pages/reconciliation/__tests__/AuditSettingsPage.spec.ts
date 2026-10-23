import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { push, route } = vi.hoisted(() => ({
  push: vi.fn(),
  route: { params: { audit: 'month-close' }, query: { period: '2026-09' } as Record<string, string>, fullPath: '/audits/month-close/settings?period=2026-09' },
}))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push }) }))
vi.mock('../../../lib/api/facade', () => ({ auditFacade: { getAuditSettings: vi.fn(), saveAuditSettings: vi.fn() } }))
vi.mock('../../../lib/savedRunEditorRoute', () => ({
  resolveSavedRunEditorTarget: vi.fn(),
  buildSavedRunEditorRoute: vi.fn(() => ({ name: 'settings-runs-edit', params: { reconciliationMappingId: 'S1' } })),
  buildRuleSetDraft: vi.fn(() => null),
}))

import { auditFacade } from '../../../lib/api/facade'
import { buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../../lib/savedRunEditorRoute'
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
    ],
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockReset()
  f.getAuditSettings.mockReset()
  f.saveAuditSettings.mockReset()
  vi.mocked(resolveSavedRunEditorTarget).mockReset()
  f.getAuditSettings.mockResolvedValue({ ok: true, settings: settings() } as never)
  f.saveAuditSettings.mockResolvedValue({ ok: true, settings: settings() } as never)
})

function form(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowStepForm' }) }
function zone(w: ReturnType<typeof mount>) {
  return w.findAllComponents({ name: 'AppSelect' }).find((c) => c.props('testId') === 'audit-settings-schedule-zone')!
}
async function save(w: ReturnType<typeof mount>) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('AuditSettingsPage', () => {
  it('shows the audit\'s name, schedule and statements with their checks', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    expect(f.getAuditSettings).toHaveBeenCalledWith({ audit: 'month-close' }, expect.anything())
    expect((w.get('[data-testid="audit-settings-name"]').element as HTMLInputElement).value).toBe('Month close')
    expect(w.get('[data-testid="audit-settings-schedule-active"]').attributes('aria-checked')).toBe('true')
    expect(w.findComponent({ name: 'WorkflowTimeSelect' }).props('modelValue')).toBe('06:00')
    expect(zone(w).props('modelValue')).toBe('America/Los_Angeles')
    expect(w.find('[data-testid="audit-settings-schedule-mixed"]').exists()).toBe(false)
    const first = w.get('[data-testid="audit-settings-statement-ST1"]')
    expect(first.text()).toContain('R2')
    expect((first.get('textarea').element as HTMLTextAreaElement).value).toBe('Every invoice carries the Etail id.')
    expect(first.get('[data-testid="audit-settings-check-C1"]').text()).toContain('Invoices with no Etail id')
    expect(first.get('[data-testid="audit-settings-check-C1"]').text()).toContain('NS invoices')
    // A check whose run is unknown has nowhere to go: its label, not a link.
    expect(w.get('[data-testid="audit-settings-check-C2"]').element.tagName).not.toBe('BUTTON')
  })

  it('says in one line when the checks run at different times', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: settings({ mixed: true }) } as never)
    const w = mount(AuditSettingsPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-settings-schedule-mixed"]').text()).toBe('Checks run at different times; a change here sets them all.')
  })

  it('saves only what changed: the name and one statement\'s text, no schedule', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    await w.get('[data-testid="audit-settings-name"]').setValue('System health')
    await w.get('[data-testid="audit-settings-statement-ST2"] textarea').setValue('Every store sale names its store.')
    await save(w)
    expect(f.saveAuditSettings).toHaveBeenCalledWith({
      audit: 'month-close', name: 'System health', statements: [{ id: 'ST2', text: 'Every store sale names its store.' }],
    })
    expect(push).toHaveBeenCalledWith(back)
  })

  it('turns a statement off', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    await w.get('[data-testid="audit-settings-statement-active-ST1"]').trigger('click')
    await save(w)
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', statements: [{ id: 'ST1', active: false }] })
  })

  it('sends the whole schedule when any part of it changed', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    w.findComponent({ name: 'WorkflowTimeSelect' }).vm.$emit('update:modelValue', '07:30')
    zone(w).vm.$emit('update:modelValue', 'Asia/Kolkata')
    await save(w)
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', schedule: { active: true, time: '07:30', timeZone: 'Asia/Kolkata' } })
  })

  it('pausing the schedule sends it off with its time and zone', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    await w.get('[data-testid="audit-settings-schedule-active"]').trigger('click')
    await save(w)
    expect(f.saveAuditSettings).toHaveBeenCalledWith({ audit: 'month-close', schedule: { active: false, time: '06:00', timeZone: 'America/Los_Angeles' } })
  })

  it('with nothing changed, Save returns without writing', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    await save(w)
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith(back)
  })

  it('shows a refusal in place and stays', async () => {
    f.saveAuditSettings.mockRejectedValue(new Error('Your active tenant only has view access for audit changes.'))
    const w = mount(AuditSettingsPage)
    await flushPromises()
    await w.get('[data-testid="audit-settings-name"]').setValue('System health')
    await save(w)
    expect(w.text()).toContain('Your active tenant only has view access for audit changes.')
    expect(push).not.toHaveBeenCalled()
  })

  it('a check opens its run\'s rules', async () => {
    vi.mocked(resolveSavedRunEditorTarget).mockResolvedValue({ savedRunId: 'S1', runType: 'mapping', reconciliationMappingId: 'S1' } as never)
    const w = mount(AuditSettingsPage)
    await flushPromises()
    const check = w.get('[data-testid="audit-settings-check-C1"]')
    expect(check.attributes('aria-label')).toBe('Open rules for Invoices with no Etail id')
    await check.trigger('click')
    await flushPromises()
    expect(resolveSavedRunEditorTarget).toHaveBeenCalledWith('S1')
    expect(buildSavedRunEditorRoute).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'settings-runs-edit', params: { reconciliationMappingId: 'S1' } })
  })

  it('Cancel returns to the audit without saving', async () => {
    const w = mount(AuditSettingsPage)
    await flushPromises()
    await w.get('[data-testid="audit-settings-name"]').setValue('System health')
    form(w).vm.$emit('cancel')
    expect(push).toHaveBeenCalledWith(back)
    expect(f.saveAuditSettings).not.toHaveBeenCalled()
  })

  it('says so when the audit cannot be read', async () => {
    f.getAuditSettings.mockRejectedValue(new Error('Audit month-close was not found'))
    const w = mount(AuditSettingsPage)
    await flushPromises()
    expect(w.text()).toContain('Audit month-close was not found')
    expect(form(w).props('submitDisabled')).toBe(true)
  })
})
