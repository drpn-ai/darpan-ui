<template>
  <!-- DAR-BE-264: the last step wherever two-factor turns on or new codes are made. The codes are in this reply only,
       so Copy and Download sit beside them. -->
  <WorkflowStepForm
    question="Save your recovery codes."
    primary-label="I saved them"
    :show-enter-hint="false"
    primary-test-id="two-factor-codes-saved"
    @submit="emit('done')"
  >
    <div class="stack-md" data-testid="two-factor-recovery-codes">
      <ol ref="codeList" class="two-factor-codes" aria-label="Recovery codes">
        <li v-for="code in codes" :key="code" data-testid="two-factor-recovery-code">{{ code }}</li>
      </ol>
      <div class="action-row">
        <button type="button" data-testid="two-factor-codes-copy" @click="copy(codes.join('\n'), codeList)">Copy</button>
        <button type="button" data-testid="two-factor-codes-download" @click="downloadCodes">Download</button>
        <span class="section-note" role="status" data-testid="two-factor-codes-copy-note">{{ note }}</span>
      </div>
    </div>
  </WorkflowStepForm>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import { useCopy } from '../../composables/useCopy'
import { recoveryCodesFileText } from '../../lib/twoFactor'
import { downloadTextFile } from '../../lib/utils/download'

const props = defineProps<{
  codes: readonly string[]
  username?: string | null
}>()

const emit = defineEmits<{
  /** "I saved them". */
  done: []
}>()

const codeList = ref<HTMLOListElement | null>(null)
const { note, copy } = useCopy()

function downloadCodes(): void {
  downloadTextFile('darpan-recovery-codes.txt', recoveryCodesFileText(props.codes, props.username))
}
</script>

<style scoped>
/* Two columns of fixed-width codes, read like a printed card. Monochrome, regular weight: the codes carry no
   emphasis beyond being the content. */
.two-factor-codes {
  margin: 0;
  padding: var(--space-3);
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  font-variant-numeric: tabular-nums;
  user-select: all;
}

@media (max-width: 420px) {
  .two-factor-codes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
