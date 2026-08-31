import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MascotDock from '../MascotDock.vue'
import { useMascotStore } from '../../../stores/mascot'

function mountDock() {
  return mount(MascotDock, { global: { plugins: [createPinia()] } })
}

describe('MascotDock', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('replaces the old pill with a face that still names itself for screen readers', () => {
    const wrapper = mountDock()
    const fab = wrapper.get('.mascot-fab')

    expect(fab.attributes('aria-label')).toContain('Ask Darpan')
    expect(wrapper.find('.mascot').exists()).toBe(true)
    // Nothing is said until it is asked: an empty corner at rest.
    expect(wrapper.find('.mascot-say').exists()).toBe(false)
  })

  it('opens the launcher when the face is clicked', async () => {
    const wrapper = mountDock()

    await wrapper.get('.mascot-fab').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('offers only the shortcut when you look at the face', async () => {
    const wrapper = mountDock()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })

    const say = wrapper.get('.mascot-say')
    expect(say.classes()).toContain('mascot-say--hint')
    expect(say.text()).toContain('Click or')
    expect(say.text()).toContain('to search')
  })

  it('ignores a touch tap for the hover label, which would otherwise latch open', async () => {
    const wrapper = mountDock()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'touch' })

    expect(wrapper.find('.mascot-say').exists()).toBe(false)
  })

  it('speaks a glossary entry, leading with the term', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    await wrapper.vm.$nextTick()

    const say = wrapper.get('.mascot-say')
    expect(say.get('.mascot-say-lead').text()).toBe('Differences')
    expect(say.text()).toContain('disagree on a compared field')
    expect(say.classes()).not.toContain('mascot-say--hint')
  })

  it('says it does not know rather than opening an empty bubble', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('noSuchTermExists')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-say').text()).toContain('Nothing written yet')
  })

  it('does not let the face label interrupt an explanation already on screen', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.get('.mascot-say-lead').text()).toBe('Differences')
  })

  it('keeps the answer when the pointer moves onto the bubble to read it', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    mascot.beginRelease()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.mascot-say').classes()).toContain('mascot-say--going')

    await wrapper.get('.mascot-say').trigger('pointerenter')

    expect(mascot.releasing).toBe(false)
    expect(wrapper.get('.mascot-say').classes()).not.toContain('mascot-say--going')
  })

  it('dismisses on Escape without needing the pointer to move', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    await wrapper.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(mascot.mode).toBe('idle')
    expect(wrapper.find('.mascot-say').exists()).toBe(false)
  })
})
