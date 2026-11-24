<template>
  <!-- DAR-UI-140. A level as a monochrome pill: P0 filled, P1 outlined, P2 light border, Known dashed. -->
  <span class="audit-mark" :class="`audit-mark--${level.toLowerCase()}`" :aria-label="`Priority ${LEVEL_LABEL[level]}`" data-testid="audit-mark">{{ LEVEL_LABEL[level] }}</span>
</template>

<script setup lang="ts">
import { LEVEL_LABEL, type AuditLevel } from '../../lib/api/auditTypes'

defineProps<{ level: AuditLevel }>()
</script>

<style scoped>
.audit-mark {
  display: inline-block;
  padding: 0 var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  font-size: var(--type-eyebrow-size);
  font-weight: 400;
  line-height: 1.5;
  white-space: nowrap;
  color: var(--text-muted);
  background: transparent;
}
.audit-mark--p0 {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.audit-mark--p1 {
  border-color: var(--text);
  color: var(--text);
}
.audit-mark--known {
  border-style: dashed;
}
</style>
