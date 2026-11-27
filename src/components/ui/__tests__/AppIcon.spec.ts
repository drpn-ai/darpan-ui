import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../AppIcon.vue'
import { ICONS, type IconName } from '../../../lib/icons'

describe('AppIcon', () => {
  it('draws the gear as the design system does: stroked on a 24-unit box at 1.8, with its hub', () => {
    const svg = mount(AppIcon, { props: { name: 'settings' } }).get('svg')
    expect(svg.attributes()).toMatchObject({
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', 'data-icon': 'settings',
    })
    expect(svg.findAll('path')).toHaveLength(1)
    expect(svg.get('circle').attributes()).toMatchObject({ cx: '12', cy: '12', r: '3' })
    expect(svg.get('circle').attributes('fill')).toBeUndefined()
  })

  it('draws a filled icon on a 20-unit box with its nudge', () => {
    const svg = mount(AppIcon, { props: { name: 'trash' } }).get('svg')
    expect(svg.attributes()).toMatchObject({ viewBox: '0 0 20 20', fill: 'currentColor' })
    expect(svg.attributes('stroke')).toBeUndefined()
    expect(svg.get('path').attributes('transform')).toBe('translate(0 0.75)')
  })

  it("keeps a solid part solid inside a stroked icon (the eye's pupil)", () => {
    const pupil = mount(AppIcon, { props: { name: 'eye' } }).get('circle')
    expect(pupil.attributes()).toMatchObject({ fill: 'currentColor', stroke: 'none' })
  })

  it('passes the caller’s class through to the svg, where the context sizes it', () => {
    const svg = mount(AppIcon, { props: { name: 'chevronLeft' }, attrs: { class: 'toggle-icon toggle-icon--collapsed' } }).get('svg')
    expect(svg.classes()).toEqual(['toggle-icon', 'toggle-icon--collapsed'])
  })

  it('draws every icon in its family: filled on 20, stroked on 20 or 24 with a weight', () => {
    for (const [name, icon] of Object.entries(ICONS) as [IconName, (typeof ICONS)[IconName]][]) {
      if (icon.paint === 'fill') expect([name, icon.box, 'strokeWidth' in icon]).toEqual([name, 20, false])
      else expect([name, [20, 24].includes(icon.box), typeof icon.strokeWidth]).toEqual([name, true, 'number'])
      expect(mount(AppIcon, { props: { name } }).findAll('path, circle, rect').length, name).toBeGreaterThan(0)
    }
  })
})
