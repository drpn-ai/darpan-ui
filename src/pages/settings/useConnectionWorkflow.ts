import { computed, onBeforeUnmount, ref, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useWorkflowStepMachine, type WorkflowStep } from '../../composables/useWorkflowStepMachine'
import { ApiCallError } from '../../lib/api/client'
import { usePermissionsStore } from '../../stores/permissions'

/**
 * The create wizard's OK button (useWorkflowStepMachine sets it on every card before the last). The connection
 * pages' mascot hints anchor on it, and the route anchor scan (mascotRouteAnchors) reads only a page's direct
 * imports, so it is named here, where every connection wizard imports from.
 */
export const wizardNextTestId = 'wizard-next'

/** Where a save lands, with the server's message; or an error that keeps the user on the page. */
export type ConnectionSaveOutcome = { to: RouteLocationRaw; message?: string } | { error: string }

export interface UseConnectionWorkflowOptions<TStep extends WorkflowStep> {
  /** The record being edited (a route param); blank while creating. */
  configId: () => string
  steps: MaybeRefOrGetter<readonly TStep[]>
  editQuestion: string
  saveTestId: string
  /** The create step whose primary action saves. */
  finalStepId?: string
  /** True while a create step's answer is missing, so OK/Save stays disabled. */
  stepBlocked: (step: TStep) => boolean
  /** Puts the form back to a new record's defaults. */
  resetCreate: () => void
  /**
   * Reads what the page needs, on every route change: the record to edit (when configId is set) and any pickers.
   * Returns a message when the record is not there.
   */
  load: (configId: string, signal: AbortSignal) => Promise<string | void>
  loadFailedMessage: string
  /** Shown when a user who cannot manage connections reaches Save. */
  permissionMessage: string
  save: () => Promise<ConnectionSaveOutcome>
  saveFailedMessage: string
  /** Where Cancel goes from an edit. */
  cancelRoute: () => RouteLocationRaw
}

/**
 * The create/edit wizard every connection settings page runs (NetSuite auth and endpoint, HotWax, Shopify, SFTP):
 * one question per card while creating, one page of fields while editing, Save on the last card. The page supplies
 * its steps, its fields and its reads and writes; this owns the lifecycle around them and the props of
 * WorkflowPage and WorkflowStepForm.
 */
export function useConnectionWorkflow<TStep extends WorkflowStep>(options: UseConnectionWorkflowOptions<TStep>) {
  const route = useRoute()
  const router = useRouter()
  const permissionsStore = usePermissionsStore()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref<string | null>(null)
  const currentStepIndex = ref(0)

  const configId = computed(() => options.configId())
  const isEditing = computed(() => configId.value.length > 0)
  const canManageConnections = computed(() => permissionsStore.canManageConnections)

  const machine = useWorkflowStepMachine<TStep>({
    steps: options.steps,
    currentStepIndex,
    isEditing,
    editQuestion: options.editQuestion,
    finalStepId: options.finalStepId ?? 'description',
    saveTestId: options.saveTestId,
    error,
  })

  const submitDisabled = computed(() => {
    if (!canManageConnections.value || loading.value) return true
    return !isEditing.value && options.stepBlocked(machine.currentCreateStep.value)
  })

  const pageBindings = computed(() => ({
    progressPercent: machine.progressPercent.value,
    centerStage: true,
    editSurface: isEditing.value,
  }))
  const formBindings = computed(() => ({
    class: ['workflow-form--compact', { 'workflow-form--edit-single-page': isEditing.value }],
    question: machine.currentQuestion.value,
    primaryLabel: machine.primaryLabel.value,
    primaryActionVariant: machine.primaryActionVariant.value,
    primaryTestId: machine.primaryTestId.value,
    showEnterHint: !isEditing.value,
    showBack: machine.showBack.value,
    showCancelAction: isEditing.value,
    cancelDisabled: loading.value,
    submitDisabled: submitDisabled.value,
    showPrimaryAction: canManageConnections.value,
  }))

  let loadController: AbortController | null = null
  onBeforeUnmount(() => loadController?.abort())

  async function load(): Promise<void> {
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller

    loading.value = true
    error.value = null
    success.value = null
    if (!isEditing.value) {
      options.resetCreate()
      currentStepIndex.value = 0
    }
    try {
      const missing = await options.load(configId.value, controller.signal)
      if (missing) error.value = missing
    } catch (loadError) {
      if ((loadError as { name?: string })?.name === 'AbortError') return
      error.value = loadError instanceof ApiCallError ? loadError.message : options.loadFailedMessage
    } finally {
      if (loadController === controller) loading.value = false
    }
  }

  async function save(): Promise<void> {
    if (!canManageConnections.value) {
      error.value = options.permissionMessage
      return
    }

    loading.value = true
    error.value = null
    success.value = null
    try {
      const outcome = await options.save()
      if ('error' in outcome) {
        error.value = outcome.error
        return
      }
      success.value = outcome.message ?? null
      await router.push(outcome.to)
    } catch (saveError) {
      error.value = saveError instanceof ApiCallError ? saveError.message : options.saveFailedMessage
    } finally {
      loading.value = false
    }
  }

  async function handlePrimarySubmit(): Promise<void> {
    if (isEditing.value || machine.currentCreateStep.value.id === (options.finalStepId ?? 'description')) {
      await save()
      return
    }
    machine.goNext()
  }

  async function cancelEdit(): Promise<void> {
    if (!isEditing.value || loading.value) return
    await router.push(options.cancelRoute())
  }

  watch(() => route.fullPath, () => {
    void load()
  }, { immediate: true })

  return {
    ...machine,
    configId,
    isEditing,
    canManageConnections,
    loading,
    error,
    success,
    pageBindings,
    formBindings,
    handlePrimarySubmit,
    cancelEdit,
  }
}
