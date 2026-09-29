import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CommandPalette from '../CommandPalette.vue'
import type { CommandAction } from '../../../lib/types/ux'

const actions: CommandAction[] = [
  {
    id: 'navigate-dashboard',
    label: 'Go to Dashboard',
    description: 'Open the main workspace.',
    group: 'Navigate',
    to: '/',
    aliases: ['home', 'dashboard'],
  },
  {
    id: 'navigate-ai-settings',
    label: 'Open AI Settings',
    description: 'Manage providers and API keys.',
    group: 'Navigate',
    to: '/settings/ai',
    aliases: ['ai', 'openai', 'api key'],
  },
  {
    id: 'navigate-run-reconciliation',
    label: 'Run Reconciliation',
    description: 'Compare two files and review the result.',
    group: 'Navigate',
    to: '/reconciliation/diff',
    aliases: ['compare files', 'reconcile'],
  },
]

describe('CommandPalette', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  function searchValue(wrapper: ReturnType<typeof mount<typeof CommandPalette>>): string {
    return (wrapper.get('#command-palette-search').element as HTMLInputElement).value
  }

  async function triggerSearchKey(
    wrapper: ReturnType<typeof mount<typeof CommandPalette>>,
    key: string,
  ): Promise<void> {
    await wrapper.get('#command-palette-search').trigger('keydown', { key })
  }

  it('moves the active result down with arrow keys and executes that result on Enter', async () => {
    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
      props: {
        open: true,
        actions,
      },
    })

    await wrapper.vm.$nextTick()

    const input = wrapper.get('#command-palette-search')
    const hint = wrapper.get('#command-palette-hint')
    expect(hint.classes()).toContain('sr-only')
    expect(hint.text()).toContain('Up and down arrows move through results')
    const keyline = wrapper.get('.command-keyline')
    expect(keyline.attributes('aria-hidden')).toBe('true')
    expect(keyline.text()).toContain('↑↓ move')
    expect(keyline.text()).toContain('↵ open')
    expect(keyline.text()).toContain('/ commands')
    expect(input.attributes('aria-activedescendant')).toBe('command-palette-option-navigate-dashboard')
    expect(wrapper.findAll('.command-item')[0]?.classes()).toContain('command-item--active')

    await triggerSearchKey(wrapper, 'ArrowDown')

    const items = wrapper.findAll('.command-item')
    expect(items[1]?.classes()).toContain('command-item--active')
    expect(items[0]?.classes()).not.toContain('command-item--active')
    expect(wrapper.get('#command-palette-search').attributes('aria-activedescendant')).toBe(
      'command-palette-option-navigate-ai-settings',
    )

    await triggerSearchKey(wrapper, 'Enter')

    expect(wrapper.emitted('execute')?.[0]?.[0]).toMatchObject({ id: 'navigate-ai-settings' })
  })

  it('moves the active result up from the first item to the last visible item', async () => {
    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
      props: {
        open: true,
        actions,
      },
    })

    await wrapper.vm.$nextTick()

    await triggerSearchKey(wrapper, 'ArrowUp')

    const items = wrapper.findAll('.command-item')
    expect(items[2]?.classes()).toContain('command-item--active')
    expect(wrapper.get('#command-palette-search').attributes('aria-activedescendant')).toBe(
      'command-palette-option-navigate-run-reconciliation',
    )

    await triggerSearchKey(wrapper, 'Enter')

    expect(wrapper.emitted('execute')?.[0]?.[0]).toMatchObject({ id: 'navigate-run-reconciliation' })
  })

  it('suppresses stale hover highlighting after arrow-key navigation changes the active result', async () => {
    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
      props: {
        open: true,
        actions,
      },
    })

    await wrapper.vm.$nextTick()

    const items = wrapper.findAll('.command-item')
    await items[0]!.trigger('mouseenter')

    expect(wrapper.get('.command-panel').classes()).not.toContain('command-panel--keyboard')
    expect(items[0]!.classes()).toContain('command-item--active')

    await triggerSearchKey(wrapper, 'ArrowDown')

    const updatedItems = wrapper.findAll('.command-item')
    expect(wrapper.get('.command-panel').classes()).toContain('command-panel--keyboard')
    expect(updatedItems[1]!.classes()).toContain('command-item--active')
    expect(updatedItems[0]!.classes()).not.toContain('command-item--active')
  })

  it('uses the shared blurred popup backdrop for modal overlays', () => {
    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
      props: {
        open: true,
        actions,
      },
    })
    const styleSource = readFileSync('src/style.css', 'utf8')

    expect(wrapper.get('.command-overlay').classes()).toContain('app-popup-backdrop')
    expect(styleSource).toContain('--popup-background-blur: 3px;')
    expect(styleSource).toContain('--popup-background-opacity: 0.5;')
    expect(styleSource).toContain('.app-shell--popup-open {')
    expect(styleSource).toContain('filter: blur(var(--popup-background-blur));')
    expect(styleSource).toContain('opacity: var(--popup-background-opacity);')
  })
  describe('slash commands', () => {
    const slashContext = {
      availableTenants: [
        { userGroupId: 'ACME_RETAIL', label: 'Acme Retail' },
        { userGroupId: 'GORJANA', label: 'Gorjana' },
      ],
      activeTenantUserGroupId: 'GORJANA',
    }

    function mountPalette() {
      return mount(CommandPalette, {
        attachTo: document.body,
        global: { stubs: { teleport: true } },
        props: { open: true, actions, slashContext },
      })
    }

    it('lists the slash commands instead of navigation results once the query opens with a slash', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/')

      const items = wrapper.findAll('.command-item')
      expect(items.map((item) => item.get('span').text())).toEqual([
        '/switch-tenant',
        '/light',
        '/dark',
        '/logout',
      ])
      expect(wrapper.text()).not.toContain('Go to Dashboard')
    })

    it('runs a command that takes no argument on Enter instead of completing the input', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/logout')

      await triggerSearchKey(wrapper, 'Enter')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('runSlash')?.[0]?.[0]).toMatchObject({
        commandName: 'logout',
        kind: 'run',
      })
    })

    it('completes a no-argument command on Tab without the space that would open argument mode', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/logo')

      await triggerSearchKey(wrapper, 'Tab')
      await wrapper.vm.$nextTick()

      expect(searchValue(wrapper)).toBe('/logout')
      expect(wrapper.emitted('runSlash')).toBeUndefined()
    })

    it('completes the input rather than running when Enter lands on a command row', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/swi')

      await triggerSearchKey(wrapper, 'Enter')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('runSlash')).toBeUndefined()
      expect(searchValue(wrapper)).toBe('/switch-tenant ')
      expect(wrapper.findAll('.command-item')[0]?.text()).toContain('Acme Retail')
    })

    it('runs the chosen option on Enter and names the command and value', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/switch-tenant acme')

      await triggerSearchKey(wrapper, 'Enter')

      expect(wrapper.emitted('runSlash')?.[0]?.[0]).toMatchObject({
        commandName: 'switch-tenant',
        value: 'ACME_RETAIL',
        label: 'Acme Retail',
      })
    })

    it('moves between option rows with arrow keys', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/switch-tenant ')

      await triggerSearchKey(wrapper, 'ArrowDown')

      expect(wrapper.get('#command-palette-search').attributes('aria-activedescendant')).toBe(
        'command-palette-option-slash-switch-tenant-ACME_RETAIL',
      )
    })

    it('completes the highlighted command on Tab without running it', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/swi')

      await triggerSearchKey(wrapper, 'Tab')
      await wrapper.vm.$nextTick()

      expect(searchValue(wrapper)).toBe('/switch-tenant ')
      expect(wrapper.emitted('runSlash')).toBeUndefined()
    })

    it('fills the highlighted option into the input on Tab so Enter can confirm it', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/switch-tenant ac')

      await triggerSearchKey(wrapper, 'Tab')
      await wrapper.vm.$nextTick()

      expect(searchValue(wrapper)).toBe('/switch-tenant Acme Retail')
      expect(wrapper.emitted('runSlash')).toBeUndefined()

      await triggerSearchKey(wrapper, 'Enter')

      expect(wrapper.emitted('runSlash')?.[0]?.[0]).toMatchObject({ value: 'ACME_RETAIL' })
    })

    it('completes the option the arrow keys moved to, not the first one', async () => {
      const wrapper = mount(CommandPalette, {
        attachTo: document.body,
        global: { stubs: { teleport: true } },
        props: {
          open: true,
          actions,
          slashContext: {
            availableTenants: [
              { userGroupId: 'ACME_RETAIL', label: 'Acme Retail' },
              { userGroupId: 'RAILS', label: 'Rails' },
            ],
            activeTenantUserGroupId: 'GORJANA',
          },
        },
      })
      await wrapper.get('#command-palette-search').setValue('/switch-tenant ')

      await triggerSearchKey(wrapper, 'ArrowDown')
      await triggerSearchKey(wrapper, 'Tab')
      await wrapper.vm.$nextTick()

      expect(searchValue(wrapper)).toBe('/switch-tenant Rails')
    })

    it('leaves Tab to the browser outside slash mode', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('api key')

      await triggerSearchKey(wrapper, 'Tab')
      await wrapper.vm.$nextTick()

      expect(searchValue(wrapper)).toBe('api key')
    })

    it('shows why a slash result is empty instead of the generic search advice', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('/switch-tenant gorjana')

      expect(wrapper.findAll('.command-item')).toHaveLength(0)
      expect(wrapper.text()).toContain('Already on Gorjana.')
      expect(wrapper.text()).not.toContain('Try words like compare files')
    })

    it('leaves plain searches on the navigation actions', async () => {
      const wrapper = mountPalette()
      await wrapper.get('#command-palette-search').setValue('api key')

      expect(wrapper.findAll('.command-item')[0]?.text()).toContain('Open AI Settings')
    })
  })

  describe('mixed Navigate and Data results', () => {
    // Ranking is group-blind, so a Data hit can outrank a Navigate hit and land between two of
    // them. The DOM then buckets them back into groups, which is a different order.
    const mixedActions: CommandAction[] = [
      {
        id: 'navigate-alpha-page',
        label: 'Alpha Page',
        description: 'A navigation target.',
        group: 'Navigate',
        to: '/alpha',
        aliases: [],
      },
      {
        id: 'navigate-zzz',
        label: 'Zzz Alpha',
        description: 'Another navigation target.',
        group: 'Navigate',
        to: '/zzz',
        aliases: [],
      },
      {
        id: 'data-alpha',
        label: 'Alpha',
        description: 'A saved record.',
        group: 'Data',
        to: '/data/alpha',
        aliases: [],
      },
      {
        id: 'data-alpha-two-long-label',
        label: 'Alpha Two Extra Long Label',
        description: 'Another saved record.',
        group: 'Data',
        to: '/data/alpha-two',
        aliases: [],
      },
    ]

    function mountMixed() {
      return mount(CommandPalette, {
        attachTo: document.body,
        global: { stubs: { teleport: true } },
        props: { open: true, actions: mixedActions },
      })
    }

    function activeId(wrapper: ReturnType<typeof mountMixed>): string | undefined {
      return wrapper.get('#command-palette-search').attributes('aria-activedescendant')
    }

    it('scrolls to the row it highlights when both groups are on screen', async () => {
      const scrolledInto: HTMLElement[] = []
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: function scrollIntoViewSpy(this: HTMLElement) {
          scrolledInto.push(this)
        },
      })

      const wrapper = mountMixed()
      await wrapper.get('#command-palette-search').setValue('alpha')
      await wrapper.vm.$nextTick()

      // Both groups render, so DOM order and rank order can disagree.
      expect(wrapper.findAll('.command-group-label').map((label) => label.text())).toEqual(['Data', 'Navigate'])

      for (let step = 0; step < 4; step += 1) {
        await triggerSearchKey(wrapper, 'ArrowDown')
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()

        const activeItem = wrapper.get('.command-item--active').element
        expect(scrolledInto[scrolledInto.length - 1], `step ${step + 1} scrolled to the wrong row`).toBe(activeItem)
      }
    })

    it('walks the results in the order they are drawn', async () => {
      const wrapper = mountMixed()
      await wrapper.get('#command-palette-search').setValue('alpha')
      await wrapper.vm.$nextTick()

      const domIds = wrapper.findAll('.command-item').map((item) => item.attributes('id'))
      expect(domIds).toHaveLength(4)

      const walked: Array<string | undefined> = [activeId(wrapper)]
      for (let step = 0; step < 3; step += 1) {
        await triggerSearchKey(wrapper, 'ArrowDown')
        walked.push(activeId(wrapper))
      }

      expect(walked).toEqual(domIds)
    })
  })
})
