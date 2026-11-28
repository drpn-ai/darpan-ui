import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { useScreenAwareMenu } from '../useScreenAwareMenu'

/**
 * DAR-OPS-029 S99-226. The dropdown placement AppSelect uses: below its trigger down to the mascot's bottom edge (or the
 * screen's, less 8 px), flipped above when the room below is short and the room above is larger. Gap 7 px.
 */
function rect(top: number, bottom: number, height = bottom - top): DOMRect {
  return { top, bottom, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect
}

function setViewport(height: number) {
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

interface Harness { isOpen: Ref<boolean>; style: () => Record<string, unknown>; unmount: () => void }

function harness(triggerRect: DOMRect, menuScrollHeight: number): Harness {
  const isOpen = ref(false)
  let exposed: { menuStyle: Ref<Record<string, unknown>> } | null = null
  const wrapper = mount(defineComponent({
    setup() {
      const trigger = ref<HTMLElement | null>(null)
      const menu = ref<HTMLElement | null>(null)
      const t = document.createElement('button')
      t.getBoundingClientRect = () => triggerRect
      const m = document.createElement('ul')
      Object.defineProperty(m, 'scrollHeight', { value: menuScrollHeight })
      trigger.value = t
      menu.value = m
      exposed = useScreenAwareMenu(trigger, menu, isOpen) as never
      return () => h('div')
    },
  }))
  return { isOpen, style: () => exposed!.menuStyle.value, unmount: () => wrapper.unmount() }
}

describe('useScreenAwareMenu', () => {
  const open: Harness[] = []
  afterEach(() => {
    open.splice(0).forEach((h) => h.unmount())
    document.body.replaceChildren()
    setViewport(768)
  })

  async function openMenu(triggerRect: DOMRect, menuScrollHeight: number): Promise<Harness> {
    const h = harness(triggerRect, menuScrollHeight)
    open.push(h)
    h.isOpen.value = true
    await nextTick()
    await nextTick()
    return h
  }

  it('opens below, as tall as the room down to the screen edge', async () => {
    setViewport(800)
    const h = await openMenu(rect(100, 140), 300)
    // floor 800 - 8 = 792; below = 792 - 140 - 7 = 645
    expect(h.style()).toEqual({ maxHeight: '645px' })
  })

  it('ends at the mascot when it sits above the screen edge', async () => {
    setViewport(800)
    const dock = document.createElement('div')
    dock.className = 'mascot-dock'
    dock.getBoundingClientRect = () => rect(600, 700)
    document.body.appendChild(dock)
    const h = await openMenu(rect(100, 140), 300)
    // floor min(792, 700) = 700; below = 700 - 140 - 7 = 553
    expect(h.style()).toEqual({ maxHeight: '553px' })
  })

  it('flips above when the room below is short and the room above is larger', async () => {
    setViewport(800)
    const h = await openMenu(rect(700, 740), 300)
    // below = 792 - 740 - 7 = 45 (< min(300, 160)); above = 700 - 7 - 8 = 685
    expect(h.style()).toEqual({ top: 'auto', bottom: 'calc(100% + 7px)', maxHeight: '685px' })
  })

  it('stays below when the menu fits, however short the room', async () => {
    setViewport(800)
    const h = await openMenu(rect(700, 740), 30)
    expect(h.style()).toEqual({ maxHeight: '45px' })
  })

  it('clears its style on close and re-places on resize only while open', async () => {
    setViewport(800)
    const h = await openMenu(rect(100, 140), 300)
    setViewport(600)
    window.dispatchEvent(new Event('resize'))
    // floor 592; below = 592 - 140 - 7 = 445
    expect(h.style()).toEqual({ maxHeight: '445px' })
    h.isOpen.value = false
    await nextTick()
    expect(h.style()).toEqual({})
    setViewport(900)
    window.dispatchEvent(new Event('resize'))
    expect(h.style()).toEqual({})
  })
})
