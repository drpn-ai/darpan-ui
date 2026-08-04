<template>
  <form class="wizard-question-shell" @submit.prevent="emit('submit')" @keydown.enter="handleEnter" @change="handleFileChange">
    <div class="wizard-prompt-row">
      <p class="wizard-question">
        <slot name="question">{{ question }}</slot>
      </p>
    </div>

    <slot></slot>

    <div v-if="hasActions" class="wizard-actions">
      <button v-if="showBack" type="button" class="wizard-back" @click="emit('back')">Back</button>

      <AppSaveAction
        v-if="showPrimaryAction && primaryActionVariant === 'save'"
        data-primary-action="true"
        :disabled="submitDisabled"
        :label="primaryLabel"
        :test-id="primaryTestId"
        @click="emit('submit')"
      />

      <button
        v-else-if="showPrimaryAction"
        type="button"
        class="wizard-next"
        data-primary-action="true"
        :disabled="submitDisabled"
        :data-testid="primaryTestId || undefined"
        @click="emit('submit')"
      >
        {{ primaryLabel }}
      </button>

      <AppCancelAction
        v-if="showCancelAction"
        :disabled="cancelDisabled"
        :label="cancelLabel"
        :test-id="cancelTestId"
        @click="emit('cancel')"
      />

      <span v-if="showPrimaryAction && showEnterHint" class="wizard-enter-hint">press <strong>Enter</strong> ↵</span>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { requestSubmitOnEnter } from '../../lib/keyboard'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import AppCancelAction from '../ui/AppCancelAction.vue'
import AppSaveAction from '../ui/AppSaveAction.vue'

const props = withDefaults(
  defineProps<{
    question: string
    primaryLabel?: string
    submitDisabled?: boolean
    showBack?: boolean
    showEnterHint?: boolean
    showPrimaryAction?: boolean
    primaryActionVariant?: 'default' | 'save'
    allowSelectEnter?: boolean
    allowFileEnter?: boolean
    primaryTestId?: string
    showCancelAction?: boolean
    cancelDisabled?: boolean
    cancelLabel?: string
    cancelTestId?: string
  }>(),
  {
    primaryLabel: 'OK',
    submitDisabled: false,
    showBack: false,
    showEnterHint: true,
    showPrimaryAction: true,
    primaryActionVariant: 'default',
    allowSelectEnter: false,
    allowFileEnter: false,
    primaryTestId: '',
    showCancelAction: false,
    cancelDisabled: false,
    cancelLabel: 'Cancel',
    cancelTestId: '',
  },
)

const emit = defineEmits<{
  submit: []
  back: []
  cancel: []
}>()

let pendingPrimaryFocusTimer: number | null = null

const hasActions = computed(() => (
  props.showBack
  || props.showCancelAction
  || props.showPrimaryAction
))

function handleEnter(event: KeyboardEvent): void {
  requestSubmitOnEnter(event, {
    allowSelect: props.allowSelectEnter,
    allowFile: props.allowFileEnter,
    allowCheckbox: true,
    disabled: props.submitDisabled,
  })
}

function handleWorkflowCancelRequest(event: Event): void {
  if (!props.showCancelAction || props.cancelDisabled) return

  event.preventDefault()
  emit('cancel')
}

function clearPendingPrimaryFocus(): void {
  if (pendingPrimaryFocusTimer === null) return

  window.clearTimeout(pendingPrimaryFocusTimer)
  pendingPrimaryFocusTimer = null
}

function handleFileChange(event: Event): void {
  const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null
  const target = event.target
  if (!form || !(target instanceof HTMLInputElement) || target.type !== 'file' || !target.files?.length) return

  clearPendingPrimaryFocus()
  pendingPrimaryFocusTimer = window.setTimeout(() => {
    pendingPrimaryFocusTimer = null
    const primaryAction = form.querySelector<HTMLButtonElement>('[data-primary-action="true"]')
    if (!primaryAction || primaryAction.disabled) return
    primaryAction.focus()
  }, 0)
}

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleWorkflowCancelRequest)
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleWorkflowCancelRequest)
  clearPendingPrimaryFocus()
})
</script>

<style scoped>
.wizard-question-shell {
  --workflow-form-question-size: var(--workflow-question-size);
  --workflow-form-question-mobile-size: clamp(1.35rem, 6vw, 1.75rem);
  --workflow-form-answer-size: var(--workflow-answer-size);
  --workflow-form-select-size: var(--workflow-select-size);
  --workflow-form-context-label-size: 0.78rem;
  --workflow-form-select-padding-top: 0;
  --workflow-form-select-padding-bottom: 0.35rem;
  --workflow-form-select-line-height: 1.15;
  width: min(var(--workflow-question-width), 100%);
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  align-content: start;
  min-height: 0;
  margin-inline: auto;
}


.wizard-question-shell.workflow-form--popup-compact {
  --workflow-form-question-size: var(--popup-workflow-prompt-size, 1.5rem);
  --workflow-form-question-mobile-size: var(--popup-workflow-prompt-size, 1.5rem);
  --workflow-form-answer-size: clamp(0.88rem, 0.95vw, 0.98rem);
  --workflow-form-select-size: var(--workflow-form-answer-size);
  --workflow-form-context-label-size: 0.68rem;
  width: 100%;
  gap: var(--space-2);
}

.wizard-question-shell.workflow-form--dense-popup {
  --workflow-form-question-size: clamp(1.05rem, 1.2vw, 1.2rem);
  --workflow-form-question-mobile-size: 1.05rem;
  --workflow-form-answer-size: 0.95rem;
  --workflow-form-select-size: var(--workflow-form-answer-size);
  --workflow-form-context-label-size: 0.68rem;
  gap: var(--space-2);
}

.wizard-question-shell.workflow-form--edit-single-page {
  --workflow-form-question-size: 1.85rem;
  --workflow-form-question-mobile-size: 1.5rem;
  --workflow-form-answer-size: clamp(0.89rem, 1.05vw, 1.09rem);
  --workflow-form-select-size: var(--workflow-form-answer-size);
  --workflow-form-context-label-size: 0.76rem;
}

.wizard-prompt-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.wizard-question {
  margin: 0;
  font-size: var(--workflow-form-question-size);
  line-height: 1.22;
  letter-spacing: var(--tracking-tight);
  white-space: normal;
  font-weight: 400;
}

.wizard-question :deep(strong) {
  font-weight: 400;
}

.wizard-question-shell :deep(.wizard-input-shell),
.wizard-question-shell :deep(.workflow-context-block) {
  width: 100%;
  margin-top: 0.35rem;
  display: grid;
  gap: var(--space-1);
}

.wizard-question-shell :deep(.workflow-context-label) {
  margin: 0;
  color: color-mix(in oklab, var(--text) 55%, transparent);
  font-size: var(--workflow-form-context-label-size);
}

.wizard-question-shell :deep(.wizard-answer-control) {
  width: 100%;
  min-height: auto;
  /* Contains a value below --space-00 (0.2rem). Under 2.5px these are optical nudges rather than spacing, and the scale deliberately stops above them. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding: 0.15rem 0 var(--space-1-5);
  border: 0;
  border-bottom: 1px solid var(--workflow-underline);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--text);
  font-size: var(--workflow-form-answer-size);
  line-height: 1.2;
  letter-spacing: var(--tracking-tight);
  text-align: left;
  appearance: none;
  font-weight: 400;
}

.wizard-question-shell :deep(select.wizard-answer-control) {
  padding-top: var(--workflow-form-select-padding-top);
  padding-bottom: var(--workflow-form-select-padding-bottom);
  font-size: var(--workflow-form-select-size);
  line-height: var(--workflow-form-select-line-height);
  letter-spacing: var(--tracking-title);
  color-scheme: light dark;
}

.wizard-question-shell :deep(.wizard-answer-control::placeholder) {
  color: color-mix(in oklab, var(--text) 20%, transparent);
}

.wizard-question-shell :deep(.wizard-answer-control.empty:not(select)) {
  color: color-mix(in oklab, var(--text) 24%, transparent);
}

.wizard-question-shell :deep(.wizard-answer-control:focus-visible) {
  outline: none;
  border-bottom-color: var(--text);
}

.wizard-question-shell :deep(.wizard-or) {
  margin: 0;
  color: color-mix(in oklab, var(--text) 55%, transparent);
  font-size: var(--type-meta-size);
}

.wizard-question-shell :deep(.wizard-secondary-link) {
  color: var(--text);
  text-decoration: none;
  font-size: var(--type-tile-size);
  letter-spacing: var(--tracking-tight);
}

.wizard-question-shell :deep(.wizard-file-shell) {
  position: relative;
  cursor: pointer;
}

.wizard-question-shell :deep(.wizard-file-input) {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.wizard-question-shell :deep(.wizard-file-answer) {
  display: block;
  cursor: pointer;
}

.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  margin-top: 0.85rem;
}

.wizard-back {
  background: transparent;
  border-style: solid;
}

.wizard-next {
  min-width: var(--workflow-action-min-width);
  min-height: var(--workflow-action-min-height);
  padding-inline: var(--space-2);
  background: var(--workflow-action-bg);
  color: var(--text);
  border-color: var(--workflow-action-border);
  font-size: var(--type-action-size);
  font-weight: 400;
  box-shadow: none;
}

.wizard-next:hover {
  background: color-mix(in oklab, var(--surface-2) 86%, var(--surface));
  border-color: color-mix(in oklab, var(--text) 14%, transparent);
}

.wizard-enter-hint {
  color: color-mix(in oklab, var(--text) 50%, transparent);
  font-size: var(--type-table-head-size);
}

.wizard-enter-hint strong {
  color: var(--text);
  font-weight: 400;
}

@media (max-width: 768px) {
  .wizard-question-shell {
    width: 100%;
    padding-top: 0;
  }

  .wizard-prompt-row {
    width: 100%;
  }

  .wizard-question {
    font-size: var(--workflow-form-question-mobile-size);
    white-space: normal;
  }
}
</style>
