<template>
  <!-- DAR-BE-264: the ten codes are in this reply only, so Copy and Download sit beside them. When the browser
       refuses the copy, the codes are selected so the person's own Cmd/Ctrl+C works. -->
  <div class="stack-md" data-testid="two-factor-recovery-codes">
    <ol ref="codeList" class="two-factor-codes" aria-label="Recovery codes">
      <li v-for="code in codes" :key="code" data-testid="two-factor-recovery-code">{{ code }}</li>
    </ol>
    <div class="action-row">
      <button type="button" data-testid="two-factor-codes-copy" @click="copyCodes">Copy</button>
      <button type="button" data-testid="two-factor-codes-download" @click="downloadCodes">Download</button>
      <span v-if="copyNote" class="section-note" role="status" data-testid="two-factor-codes-copy-note">{{ copyNote }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { copyText, recoveryCodesFileText } from '../../lib/twoFactor'
import { downloadTextFile } from '../../lib/utils/download'

const props = defineProps<{
  codes: readonly string[]
  username?: string | null
}>()

const codeList = ref<HTMLOListElement | null>(null)
const copyNote = ref<string | null>(null)

async function copyCodes(): Promise<void> {
  if (await copyText(props.codes.join('\n'))) {
    copyNote.value = 'Copied.'
    return
  }
  selectCodes()
  copyNote.value = 'Selected. Press Ctrl+C or ⌘C.'
}

function selectCodes(): void {
  const list = codeList.value
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  if (!list || !selection) return
  const range = document.createRange()
  range.selectNodeContents(list)
  selection.removeAllRanges()
  selection.addRange(range)
}

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
