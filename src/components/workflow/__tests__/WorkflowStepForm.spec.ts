import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../../lib/uiEvents'
import WorkflowStepForm from '../WorkflowStepForm.vue'

describe('WorkflowStepForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps edit spacing on the workflow page template instead of all workflow forms', () => {
    const wrapper = mount(WorkflowStepForm, {
      props: {
        question: 'Update the NetSuite auth profile.',
      },
    })

    const source = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const globalSource = readFileSync('src/style.css', 'utf8')

    expect(wrapper.get('form').classes()).toContain('wizard-question-shell')
    expect(source).not.toContain('padding-top: var(--workflow-form-top-offset);')
    expect(globalSource).toContain('.workflow-form--edit-single-page {')
    expect(globalSource).toContain('.workflow-page--edit .workflow-shell {')
    expect(globalSource).toContain('padding-top: var(--workflow-form-top-offset);')
    expect(globalSource).toContain('--workflow-form-top-offset: var(--space-6);')
    expect(globalSource).toContain('--workflow-form-top-offset: var(--space-5);')
  })

  it('keeps popup workflow prompt typography visually twice the modal title size', () => {
    const source = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const globalSource = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('.wizard-question-shell.workflow-form--popup-compact')
    expect(globalSource).toContain('--popup-workflow-title-size: 0.875rem;')
    expect(globalSource).toContain('--popup-workflow-prompt-size: 1.5rem;')
    expect(globalSource).toContain('font-size: var(--popup-workflow-title-size);')
    expect(source).toContain('--workflow-form-question-size: var(--popup-workflow-prompt-size, 1.5rem);')
  })

  it('renders an icon-only cancel action and emits cancel when requested', async () => {
    const wrapper = mount(WorkflowStepForm, {
      props: {
        question: 'Update the NetSuite auth profile.',
        primaryLabel: 'Save',
        primaryActionVariant: 'save',
        showCancelAction: true,
        primaryTestId: 'save-workflow',
        cancelTestId: 'cancel-workflow',
      },
    })

    const source = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const cancelActionSource = readFileSync('src/components/ui/AppCancelAction.vue', 'utf8')

    const cancelButton = wrapper.get('[data-testid="cancel-workflow"]')

    expect(cancelButton.attributes('aria-label')).toBe('Cancel')
    expect(cancelButton.classes()).toContain('app-icon-action')
    expect(cancelButton.classes()).toContain('app-icon-action--large')
    expect(cancelActionSource).toContain('<line x1="5" y1="5" x2="15" y2="15"')
    expect(cancelActionSource).toContain('<line x1="15" y1="5" x2="5" y2="15"')
    expect(source).toContain('<AppCancelAction')
    expect(source.indexOf('<AppSaveAction')).toBeLessThan(source.indexOf('<AppCancelAction'))
    expect(wrapper.findAll('.wizard-actions > *').map((node) => node.attributes('data-testid') || node.classes().join(' '))).toEqual([
      'save-workflow',
      'cancel-workflow',
      'wizard-enter-hint',
    ])

    await cancelButton.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)

    wrapper.unmount()
  })

  it('emits cancel from the shared workflow cancel request when the X action is available', () => {
    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: {
        question: 'Update rules.',
        showCancelAction: true,
        cancelTestId: 'cancel-workflow',
      },
    })
    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })

    document.dispatchEvent(cancelRequest)

    expect(cancelRequest.defaultPrevented).toBe(true)
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    wrapper.unmount()
  })

  it('ignores workflow cancel requests when the X action is disabled', () => {
    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: {
        question: 'Update rules.',
        showCancelAction: true,
        cancelDisabled: true,
        cancelTestId: 'cancel-workflow',
      },
    })
    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })

    document.dispatchEvent(cancelRequest)

    expect(cancelRequest.defaultPrevented).toBe(false)
    expect(wrapper.emitted('cancel')).toBeUndefined()

    wrapper.unmount()
  })

  it('moves focus to the primary action after a file is selected', async () => {
    vi.useFakeTimers()

    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: {
        question: 'Upload the schema file',
        primaryLabel: 'OK',
        primaryTestId: 'wizard-next',
      },
      slots: {
        default: '<label class="wizard-input-shell wizard-file-shell"><input data-testid="upload-file" class="wizard-file-input" type="file"></label>',
      },
    })

    const fileInput = wrapper.get('[data-testid="upload-file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })

    await fileInput.trigger('change')
    await vi.runAllTimersAsync()

    expect((document.activeElement as HTMLElement | null)?.dataset.testid).toBe('wizard-next')

    wrapper.unmount()
  })

  it('submits when Enter is pressed from a workflow checkbox', async () => {
    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: {
        question: 'Verify the schema',
        primaryLabel: 'OK',
        primaryTestId: 'wizard-next',
      },
      slots: {
        default: '<label><input data-testid="required-field" type="checkbox"> Required field</label>',
      },
    })

    await wrapper.get('[data-testid="required-field"]').trigger('keydown.enter')

    expect(wrapper.emitted('submit')).toHaveLength(1)

    wrapper.unmount()
  })

  it('focuses the answer control on mount so the advertised Enter key reaches the form', async () => {
    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: { question: 'Name this run' },
      slots: {
        default: '<label class="wizard-input-shell"><input data-testid="run-name" class="wizard-answer-control"></label>',
      },
    })

    await nextTick()

    expect((document.activeElement as HTMLElement | null)?.dataset.testid).toBe('run-name')

    wrapper.unmount()
  })

  it('returns focus to the answer control when the step changes', async () => {
    // Advancing destroys the control the user typed in and focus falls to <body>, outside this form
    // -- so the next Enter never reached the keydown listener and the wizard could only be driven by
    // clicking OK. Focus parked on Back was worse: Enter re-fired Back and walked the user backwards.
    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: { question: 'Name this run', showBack: true },
      slots: {
        default: '<label class="wizard-input-shell"><input data-testid="answer" class="wizard-answer-control"></label>',
      },
    })

    ;(wrapper.get('.wizard-back').element as HTMLButtonElement).focus()
    expect((document.activeElement as HTMLElement | null)?.className).toContain('wizard-back')

    await wrapper.setProps({ question: 'Which schema describes it?' })
    await nextTick()

    expect((document.activeElement as HTMLElement | null)?.dataset.testid).toBe('answer')

    await wrapper.get('[data-testid="answer"]').trigger('keydown.enter')

    expect(wrapper.emitted('submit')).toHaveLength(1)

    wrapper.unmount()
  })

  it('leaves focus alone on a step that offers no answer control', async () => {
    const wrapper = mount(WorkflowStepForm, {
      attachTo: document.body,
      props: { question: 'How do you want to start?', showPrimaryAction: false },
      slots: {
        default: '<button type="button" class="workflow-shortcut-choice-card">Upload a sample</button>',
      },
    })

    await nextTick()

    expect(document.activeElement).toBe(document.body)

    wrapper.unmount()
  })

})
