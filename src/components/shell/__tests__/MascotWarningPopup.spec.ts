import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MascotWarningPopup from '../MascotWarningPopup.vue'
import type { MascotWarning } from '../../../stores/mascot'

const drift: MascotWarning = {
  id: 'automation-drift',
  title: 'Out of date',
  body: 'Until you sync, this keeps running the setup it was built with.',
  actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: vi.fn() }],
}

const inactive: MascotWarning = {
  id: 'automation-chat-space-inactive',
  title: 'Chat space is inactive',
  body: 'Rails Tech is no longer active, so nothing will be delivered there.',
  actions: [],
}

describe('MascotWarningPopup', () => {
  // One page can raise two at once, so a single-warning popup would be wrong on day one.
  it('renders every standing warning, not just the first', () => {
    const wrapper = mount(MascotWarningPopup, { props: { warnings: [drift, inactive] } })

    const items = wrapper.findAll('[data-testid="mascot-warning"]')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('Out of date')
    expect(items[1]?.text()).toContain('no longer active')
  })

  it('renders no action row for a warning that can only be acknowledged', () => {
    const wrapper = mount(MascotWarningPopup, { props: { warnings: [inactive] } })

    expect(wrapper.find('[data-testid="mascot-warning-actions"]').exists()).toBe(false)
  })

  it('runs the action the page handed over', async () => {
    const run = vi.fn()
    const wrapper = mount(MascotWarningPopup, {
      props: {
        warnings: [{ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run }] }],
      },
    })

    await wrapper.get('[data-testid="mascot-warning-action-sync"]').trigger('click')

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('offers one dismiss for the whole popup', async () => {
    const wrapper = mount(MascotWarningPopup, { props: { warnings: [drift, inactive] } })

    expect(wrapper.findAll('[data-testid="mascot-warning-dismiss"]')).toHaveLength(1)
    await wrapper.get('[data-testid="mascot-warning-dismiss"]').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('announces itself as a dialog labelled by the first warning', () => {
    const wrapper = mount(MascotWarningPopup, { props: { warnings: [drift] } })
    const popup = wrapper.get('[data-testid="mascot-warning-popup"]')

    expect(popup.attributes('role')).toBe('dialog')
    expect(popup.attributes('aria-labelledby'))
      .toBe(wrapper.get('[data-testid="mascot-warning-title"]').attributes('id'))
  })

  // Sync replaces the automation's whole source setup. It must not be one stray Enter away.
  it('lands focus on the acknowledgement, never on the destructive action', async () => {
    const wrapper = mount(MascotWarningPopup, {
      props: { warnings: [drift] },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()

    expect(document.activeElement)
      .toBe(wrapper.get('[data-testid="mascot-warning-dismiss"]').element)
    wrapper.unmount()
  })

  it('opens beside the face rather than over the page', () => {
    const wrapper = mount(MascotWarningPopup, { props: { warnings: [drift] } })
    const popup = wrapper.get('[data-testid="mascot-warning-popup"]')
    // Comments stripped: this file explains itself by naming the overlay it does not use, and
    // a raw text match cannot tell that prose apart from an actual class binding.
    const style = readFileSync('src/components/shell/MascotWarningPopup.vue', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')

    // The centred, scrimmed overlay would disconnect the popup from the thing that jumped.
    expect(popup.classes()).toContain('popup-workflow-modal')
    expect(popup.classes()).not.toContain('popup-workflow-overlay')
    expect(style).not.toContain('popup-workflow-overlay')
    expect(style).toContain('position: absolute;')
  })
})
