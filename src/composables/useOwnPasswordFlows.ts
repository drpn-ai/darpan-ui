// DAR-BE-028, DAR-OPS-029 U09. The User Settings page's two password-guarded step popups: change password (current,
// new, new again) and recovery email (current password, then the address; the backend re-checks the password on save,
// so a session token alone cannot redirect reset codes). Each popup stays open on a refusal, so refusals go to the
// workflow hint on top of it: a page-level note would sit behind the popup's scrim.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { passwordRulesFor } from '../lib/passwordPolicy'
import { WORKFLOW_HINT_REQUEST_EVENT, type WorkflowHintRequestDetail } from '../lib/uiEvents'
import { useAuthStore } from '../stores/auth'

function warn(message: string): void {
  document.dispatchEvent(new CustomEvent<WorkflowHintRequestDetail>(WORKFLOW_HINT_REQUEST_EVENT, {
    detail: { message, tone: 'warning', durationMs: 5000 },
  }))
}

const PASSWORD_STEPS = [
  { name: 'currentPassword', label: 'Current Password', question: 'Enter your current password.', autocomplete: 'current-password' },
  { name: 'newPassword', label: 'New Password', question: 'Enter your new password.', autocomplete: 'new-password' },
  { name: 'newPasswordVerify', label: 'Verify Password', question: 'Enter your new password again.', autocomplete: 'new-password' },
] as const

const RECOVERY_STEPS = [
  { name: 'currentPassword', label: 'Current Password', question: 'Enter your current password.', type: 'password',
    autocomplete: 'current-password' },
  { name: 'emailAddress', label: 'Recovery Email', question: 'Where should password reset codes go?', type: 'email',
    autocomplete: 'email' },
] as const

const emptyPasswordForm = () => ({ currentPassword: '', newPassword: '', newPasswordVerify: '' })
const emptyRecoveryForm = () => ({ currentPassword: '', emailAddress: '' })

export function usePasswordChange() {
  const authStore = useAuthStore()
  const router = useRouter()
  const isOpen = ref(false)
  const stepIndex = ref(0)
  const form = ref(emptyPasswordForm())
  const isVerifying = ref(false)
  const isChanging = ref(false)

  const step = computed(() => PASSWORD_STEPS[stepIndex.value] ?? PASSWORD_STEPS[0])
  const stepValue = computed({
    get: () => form.value[step.value.name],
    set: (value: string) => { form.value = { ...form.value, [step.value.name]: value } },
  })
  const primaryLabel = computed(() => {
    if (step.value.name === 'currentPassword' && isVerifying.value) return 'Checking'
    return stepIndex.value === PASSWORD_STEPS.length - 1 ? (isChanging.value ? 'Changing' : 'Change') : 'OK'
  })
  // S99-106: the new password is checked against the policy as it is typed (passwordPolicy, as on the sign-in page).
  const rules = computed(() => passwordRulesFor(form.value.newPassword))
  const showsRules = computed(() => step.value.name === 'newPassword')
  const isStepBlocked = computed(() => isChanging.value || isVerifying.value || stepValue.value.trim().length === 0
    || (showsRules.value && !rules.value.every((rule) => rule.met)))

  function open(): void {
    isOpen.value = true
    stepIndex.value = 0
  }

  function close(): void {
    isOpen.value = false
    stepIndex.value = 0
    form.value = emptyPasswordForm()
  }

  function back(): void {
    stepIndex.value = Math.max(0, stepIndex.value - 1)
  }

  async function verifyCurrent(): Promise<boolean> {
    if (isVerifying.value) return false
    isVerifying.value = true
    try {
      if (await authStore.verifyOwnPassword(form.value.currentPassword)) return true
      warn(authStore.error || 'Password incorrect.')
      return false
    } finally {
      isVerifying.value = false
    }
  }

  async function change(): Promise<void> {
    if (isChanging.value) return
    if (form.value.newPassword !== form.value.newPasswordVerify) {
      warn('New passwords do not match.')
      return
    }
    isChanging.value = true
    try {
      const changed = await authStore.changeOwnPassword({ ...form.value })
      if (!changed) {
        warn(authStore.error || 'Unable to change password.')
        return
      }
      // D17: the change ended this session everywhere, this tab included; the sign-in page says why.
      close()
      await router.replace({ name: 'login' })
    } finally {
      isChanging.value = false
    }
  }

  async function submit(): Promise<void> {
    // Enter submits the form whatever the button says, so the gate is checked here too.
    if (isStepBlocked.value) return
    if (step.value.name === 'currentPassword' && !(await verifyCurrent())) return
    if (stepIndex.value < PASSWORD_STEPS.length - 1) {
      stepIndex.value += 1
      return
    }
    await change()
  }

  return { isOpen, stepIndex, step, stepValue, primaryLabel, isStepBlocked, rules, showsRules, open, close, back, submit }
}

export function useRecoveryEmail() {
  const authStore = useAuthStore()
  const isOpen = ref(false)
  const stepIndex = ref(0)
  const form = ref(emptyRecoveryForm())
  const isVerifying = ref(false)
  const isSaving = ref(false)

  const step = computed(() => RECOVERY_STEPS[stepIndex.value] ?? RECOVERY_STEPS[0])
  const stepValue = computed({
    get: (): string => form.value[step.value.name],
    set: (value: string): void => { form.value = { ...form.value, [step.value.name]: value } },
  })
  const primaryLabel = computed(() => {
    if (stepIndex.value < RECOVERY_STEPS.length - 1) return 'OK'
    return isSaving.value ? 'Saving' : 'Save'
  })
  const isStepBlocked = computed(() => isSaving.value || isVerifying.value || stepValue.value.trim().length === 0)

  function open(): void {
    form.value = emptyRecoveryForm()
    stepIndex.value = 0
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    stepIndex.value = 0
    form.value = emptyRecoveryForm()
  }

  function back(): void {
    stepIndex.value = 0
  }

  async function submit(): Promise<void> {
    if (step.value.name === 'currentPassword') {
      if (isVerifying.value) return
      isVerifying.value = true
      try {
        if (!(await authStore.verifyOwnPassword(form.value.currentPassword))) {
          warn(authStore.error || 'Password incorrect.')
          return
        }
      } finally {
        isVerifying.value = false
      }
      stepIndex.value = 1
      return
    }

    if (isSaving.value) return
    isSaving.value = true
    try {
      if (!(await authStore.saveRecoveryEmail(form.value.emailAddress.trim(), form.value.currentPassword))) {
        warn(authStore.error || 'Unable to save the recovery email.')
        return
      }
      close()
    } finally {
      isSaving.value = false
    }
  }

  return { isOpen, stepIndex, step, stepValue, primaryLabel, isStepBlocked, open, close, back, submit }
}
