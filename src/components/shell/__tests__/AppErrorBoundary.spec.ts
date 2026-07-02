/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import AppErrorBoundary from '../AppErrorBoundary.vue'
import * as report from '../../../lib/observability/report'

const Boom = defineComponent({ setup: () => () => { throw new Error('render boom') } })
const Ok = defineComponent({ setup: () => () => h('div', { class: 'ok' }, 'fine') })

describe('AppErrorBoundary', () => {
  it('passes the slot through unchanged when no error (happy path)', () => {
    const wrapper = mount(AppErrorBoundary, { slots: { default: () => h(Ok) } })
    expect(wrapper.find('.ok').exists()).toBe(true)
    expect(wrapper.find('.error-state').exists()).toBe(false)
  })
  it('renders ServerError and reports once when a child throws', async () => {
    const spy = vi.spyOn(report, 'reportError').mockImplementation(() => {})
    const wrapper = mount(AppErrorBoundary, { slots: { default: () => h(Boom) } })
    await nextTick()
    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('something went wrong')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
