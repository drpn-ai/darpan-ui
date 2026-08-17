import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowTimeSelect from '../WorkflowTimeSelect.vue'

function mountTimeSelect(modelValue: string) {
  return mount(WorkflowTimeSelect, {
    props: { modelValue, testId: 'schedule-time' },
  })
}

function triggerLabel(wrapper: ReturnType<typeof mountTimeSelect>, part: string): string {
  return wrapper.get(`[data-testid="schedule-time-${part}"] .workflow-select-trigger-label`).text()
}

async function chooseOption(wrapper: ReturnType<typeof mountTimeSelect>, part: string, value: string): Promise<void> {
  await wrapper.get(`[data-testid="schedule-time-${part}"]`).trigger('click')
  await wrapper.get(`[data-testid="workflow-select-option"][data-option-value="${value}"]`).trigger('click')
}

function lastEmitted(wrapper: ReturnType<typeof mountTimeSelect>): string | undefined {
  const events = wrapper.emitted('update:modelValue')
  return events?.at(-1)?.[0] as string | undefined
}

describe('WorkflowTimeSelect', () => {
  it('renders app selects rather than a native time input', () => {
    const wrapper = mountTimeSelect('06:00')

    // The whole point of the component: `<input type="time">` opens Chrome's own picker panel,
    // which no CSS in this app can reach.
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('.workflow-select')).toHaveLength(3)
    expect(wrapper.get('[data-testid="schedule-time-hour"]').attributes('aria-label')).toBe('Hour')
    expect(wrapper.get('[data-testid="schedule-time-minute"]').attributes('aria-label')).toBe('Minute')
    expect(wrapper.get('[data-testid="schedule-time-meridiem"]').attributes('aria-label')).toBe('AM or PM')
  })

  it('shows a 24-hour value in 12-hour parts', () => {
    const wrapper = mountTimeSelect('14:05')

    expect(triggerLabel(wrapper, 'hour')).toBe('02')
    expect(triggerLabel(wrapper, 'minute')).toBe('05')
    expect(triggerLabel(wrapper, 'meridiem')).toBe('PM')
  })

  it('reads midnight and noon as 12, not 00', () => {
    expect(triggerLabel(mountTimeSelect('00:30'), 'hour')).toBe('12')
    expect(triggerLabel(mountTimeSelect('00:30'), 'meridiem')).toBe('AM')
    expect(triggerLabel(mountTimeSelect('12:30'), 'hour')).toBe('12')
    expect(triggerLabel(mountTimeSelect('12:30'), 'meridiem')).toBe('PM')
  })

  it('emits 24-hour HH:mm when a part changes', async () => {
    const wrapper = mountTimeSelect('06:00')

    await chooseOption(wrapper, 'hour', '09')
    expect(lastEmitted(wrapper)).toBe('09:00')

    await wrapper.setProps({ modelValue: '09:00' })
    await chooseOption(wrapper, 'minute', '45')
    expect(lastEmitted(wrapper)).toBe('09:45')

    await wrapper.setProps({ modelValue: '09:45' })
    await chooseOption(wrapper, 'meridiem', 'PM')
    expect(lastEmitted(wrapper)).toBe('21:45')
  })

  it('converts 12 AM to midnight and 12 PM to noon', async () => {
    const wrapper = mountTimeSelect('09:15')

    await chooseOption(wrapper, 'hour', '12')
    // 12 AM is 00:15 — `hour % 12` is what keeps it off 12:15, which would be noon.
    expect(lastEmitted(wrapper)).toBe('00:15')

    await wrapper.setProps({ modelValue: '00:15' })
    await chooseOption(wrapper, 'meridiem', 'PM')
    expect(lastEmitted(wrapper)).toBe('12:15')
  })

  it('still emits a whole value when it was handed an unparseable one', async () => {
    const wrapper = mountTimeSelect('not-a-time')

    expect(triggerLabel(wrapper, 'hour')).toBe('HH')
    expect(triggerLabel(wrapper, 'minute')).toBe('MM')

    await chooseOption(wrapper, 'hour', '08')

    // Blank parts fall back to midnight rather than emitting something the cron helper downstream
    // would have to defend against.
    expect(lastEmitted(wrapper)).toBe('08:00')
  })
})
