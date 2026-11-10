import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { MyCliAccess } from '../../../lib/api/types'

const requestCliAccess = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/api/facade', () => ({ authFacade: { requestCliAccess } }))

import CliAccessRequestCard from '../CliAccessRequestCard.vue'

const base: MyCliAccess = { tenantUserGroupId: 'ACME', tenantLabel: 'Acme', state: 'NOT_GRANTED', lifetimeDays: 7, request: null }
const card = (access: Partial<MyCliAccess>) => mount(CliAccessRequestCard, { props: { access: { ...base, ...access } } })

describe('CliAccessRequestCard', () => {
  beforeEach(() => {
    requestCliAccess.mockReset()
  })

  it('offers no request when the CLI is on, or for a Darpan admin', () => {
    const live = card({ state: 'LIVE', lifetimeDays: 30 })
    expect(live.text()).toContain('A sign-in lasts 30 days.')
    expect(live.find('[data-testid="cli-access-request"]').exists()).toBe(false)
    expect(card({ state: 'DARPAN_ADMIN' }).find('[data-testid="cli-access-request"]').exists()).toBe(false)
  })

  it('shows a pending request instead of the button', () => {
    const wrapper = card({ request: { requestId: 'R1', statusId: 'PENDING', requestedDate: '2026-11-10T09:30:00Z' } })
    expect(wrapper.find('[data-testid="cli-access-pending"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-access-request"]').exists()).toBe(false)
  })

  it('shows a decline with its note and lets the person ask again', () => {
    const wrapper = card({ request: { requestId: 'R1', statusId: 'DECLINED', decidedDate: '2026-11-10T09:30:00Z', decisionNote: 'Use the app for now' } })
    expect(wrapper.get('[data-testid="cli-access-declined"]').text()).toContain(': Use the app for now')
    expect(wrapper.find('[data-testid="cli-access-request"]').exists()).toBe(true)
  })

  it('a paused grant can be asked about again', () => {
    const wrapper = card({ state: 'PAUSED' })
    expect(wrapper.text()).toContain('Paused by a Darpan admin.')
    expect(wrapper.find('[data-testid="cli-access-request"]').exists()).toBe(true)
  })

  it("shows the server's refusal", async () => {
    requestCliAccess.mockImplementation(async () => { throw new ApiCallError('The CLI is already on for you in Acme.', 400) })
    const wrapper = card({})
    await wrapper.get('[data-testid="cli-access-request"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="cli-access-error"]').text()).toBe('The CLI is already on for you in Acme.')
  })
})
