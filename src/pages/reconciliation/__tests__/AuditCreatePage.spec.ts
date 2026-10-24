import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('../../../lib/api/facade', () => ({ auditFacade: { createAudit: vi.fn() } }))

import { auditFacade } from '../../../lib/api/facade'
import AuditCreatePage from '../AuditCreatePage.vue'

const f = vi.mocked(auditFacade)

beforeEach(() => {
  push.mockReset()
  f.createAudit.mockReset()
  f.createAudit.mockResolvedValue({ ok: true, audit: { id: 'month-close', name: 'Month close', period: 'month' } } as never)
})

function form(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowStepForm' }) }

// DAR-UI-078. An audit made in the app: its name, then its period, then its settings for statements and checks.
describe('AuditCreatePage', () => {
  it('asks the name, then the period, and opens the new audit\'s settings', async () => {
    const w = mount(AuditCreatePage)
    expect(w.text()).toContain('What is the audit called?')
    expect(form(w).props('submitDisabled')).toBe(true)
    await w.get('[data-testid="audit-create-name"]').setValue('  Month close ')
    await form(w).vm.$emit('submit')
    expect(w.text()).toContain('What does one report cover?')
    await form(w).vm.$emit('submit')
    await flushPromises()
    expect(f.createAudit).toHaveBeenCalledWith({ name: 'Month close', period: 'month' })
    expect(push).toHaveBeenCalledWith({ name: 'audit-settings', params: { audit: 'month-close' } })
  })

  it('takes a refused name back to the name step, says why there, and clears it on the next keystroke', async () => {
    f.createAudit.mockRejectedValue(new Error('There is already an audit by that name.'))
    const w = mount(AuditCreatePage)
    await w.get('[data-testid="audit-create-name"]').setValue('Month close')
    await form(w).vm.$emit('submit')
    await form(w).vm.$emit('submit')
    await flushPromises()
    expect(w.text()).toContain('What is the audit called?')
    expect(w.get('[data-testid="audit-create-error"]').text()).toContain('already an audit by that name')
    expect(push).not.toHaveBeenCalled()
    await w.get('[data-testid="audit-create-name"]').setValue('Month close 2')
    expect(w.find('[data-testid="audit-create-error"]').exists()).toBe(false)
  })

  it('goes back to the run types from the name, and back to the name from the period', async () => {
    const w = mount(AuditCreatePage)
    await form(w).vm.$emit('back')
    expect(push).toHaveBeenCalledWith({ name: 'run-create' })
    await w.get('[data-testid="audit-create-name"]').setValue('Month close')
    await form(w).vm.$emit('submit')
    await form(w).vm.$emit('back')
    expect((w.get('[data-testid="audit-create-name"]').element as HTMLInputElement).value).toBe('Month close')
  })
})
