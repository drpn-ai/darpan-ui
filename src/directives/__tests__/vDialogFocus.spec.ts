import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { vDialogFocus } from '../vDialogFocus'

// DAR-OPS-029 U16a (U08's handoff). A popup that never takes focus hears an Esc bound on itself only after the
// person tabs in, and closing it drops focus to the page. The directive moves focus in on open and back on close.
const Host = defineComponent({
  directives: { dialogFocus: vDialogFocus },
  props: { withAutofocus: { type: Boolean, default: false } },
  emits: ['escape'],
  setup() {
    return { open: ref(false) }
  },
  template: `
    <div>
      <button class="opener" @click="open = true">Open</button>
      <div v-if="open" v-dialog-focus class="dialog" role="dialog" @keydown.esc="$emit('escape'); open = false">
        <button class="close">Close</button>
        <input v-if="withAutofocus" class="note" autofocus />
      </div>
    </div>`,
})

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function openFromOpener(withAutofocus = false) {
  wrapper = mount(Host, { props: { withAutofocus }, attachTo: document.body })
  const opener = wrapper.get('.opener').element as HTMLButtonElement
  opener.focus()
  await wrapper.get('.opener').trigger('click')
  await nextTick()
  return opener
}

describe('v-dialog-focus', () => {
  it('takes focus on open, so an Esc bound on the dialog works without a tab first', async () => {
    await openFromOpener()
    const dialog = wrapper!.get('.dialog')
    expect(document.activeElement).toBe(dialog.element)
    // Focusable without joining the tab order.
    expect(dialog.attributes('tabindex')).toBe('-1')

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper!.emitted('escape')).toHaveLength(1)
  })

  it('never lands on a close or delete button: the dialog itself, or the control marked autofocus', async () => {
    await openFromOpener(true)
    expect(document.activeElement).toBe(wrapper!.get('.note').element)
  })

  it('hands focus back to the control that opened it when it closes', async () => {
    const opener = await openFromOpener()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper!.find('.dialog').exists()).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('leaves focus alone on close when the person already moved it elsewhere on the page', async () => {
    await openFromOpener()
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    elsewhere.focus()
    ;(wrapper!.vm as unknown as { open: boolean }).open = false
    await nextTick()
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })
})
