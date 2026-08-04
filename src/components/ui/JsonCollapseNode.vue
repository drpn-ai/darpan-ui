<template>
  <div v-if="isContainer">
    <div
      v-if="isEmptyContainer"
      class="json-collapse-viewer__line"
      :style="lineStyle"
    >
      <span v-if="labelText" class="json-collapse-viewer__key">{{ labelText }}</span><span>{{ emptyToken }}</span><span v-if="!isLast">,</span>
    </div>

    <div
      v-else-if="collapsed"
      class="json-collapse-viewer__line"
      :style="lineStyle"
    >
      <button
        type="button"
        class="json-collapse-viewer__toggle"
        data-testid="json-collapse-toggle"
        :aria-label="toggleLabel"
        aria-expanded="false"
        @click="collapsed = false"
      >
        <span class="json-collapse-viewer__caret" aria-hidden="true"></span>
      </button><span v-if="labelText" class="json-collapse-viewer__key">{{ labelText }}</span><span>{{ openToken }}</span><span class="json-collapse-viewer__ellipsis"> ... </span><span>{{ closeToken }}</span><span class="json-collapse-viewer__summary"> {{ summaryText }}</span><span v-if="!isLast">,</span>
    </div>

    <template v-else>
      <div
        class="json-collapse-viewer__line"
        :style="lineStyle"
      >
        <button
          type="button"
          class="json-collapse-viewer__toggle"
          data-testid="json-collapse-toggle"
          :aria-label="toggleLabel"
          aria-expanded="true"
          @click="collapsed = true"
        >
          <span class="json-collapse-viewer__caret json-collapse-viewer__caret--expanded" aria-hidden="true"></span>
        </button><span v-if="labelText" class="json-collapse-viewer__key">{{ labelText }}</span><span>{{ openToken }}</span>
      </div>

      <JsonCollapseNode
        v-for="entry in containerEntries"
        :key="entry.key"
        :value="entry.value"
        :label="entry.label"
        :node-name="entry.nodeName"
        :depth="depth + 1"
        :is-last="entry.isLast"
      />

      <div
        class="json-collapse-viewer__line"
        :style="lineStyle"
      >
        <span>{{ closeToken }}</span><span v-if="!isLast">,</span>
      </div>
    </template>
  </div>

  <div
    v-else
    class="json-collapse-viewer__line"
    :style="lineStyle"
  >
    <span v-if="labelText" class="json-collapse-viewer__key">{{ labelText }}</span><span
      class="json-collapse-viewer__primitive"
      :class="primitiveClass"
    >{{ primitiveText }}</span><span v-if="!isLast">,</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { isRecord } from '../../lib/utils/objects'

defineOptions({
  name: 'JsonCollapseNode',
})

interface JsonEntry {
  key: string
  label: string
  nodeName: string
  value: unknown
  isLast: boolean
}

const props = withDefaults(defineProps<{
  value: unknown
  label?: string
  nodeName?: string
  depth: number
  isLast?: boolean
}>(), {
  label: '',
  nodeName: '',
  isLast: false,
})

const collapsed = ref(true)

const isArrayValue = computed(() => Array.isArray(props.value))
const isObjectValue = computed(() => isRecord(props.value))
const isContainer = computed(() => isArrayValue.value || isObjectValue.value)
const containerEntries = computed<JsonEntry[]>(() => buildContainerEntries(props.value))
const isEmptyContainer = computed(() => isContainer.value && containerEntries.value.length === 0)
const openToken = computed(() => isArrayValue.value ? '[' : '{')
const closeToken = computed(() => isArrayValue.value ? ']' : '}')
const emptyToken = computed(() => isArrayValue.value ? '[]' : '{}')
const summaryText = computed(() => {
  const entryCount = containerEntries.value.length
  const noun = isArrayValue.value
    ? entryCount === 1 ? 'item' : 'items'
    : entryCount === 1 ? 'key' : 'keys'

  return `${entryCount} ${noun}`
})
const labelText = computed(() => props.label ? `${JSON.stringify(props.label)}: ` : '')
const toggleLabel = computed(() => {
  const action = collapsed.value ? 'Expand' : 'Collapse'
  const targetName = props.nodeName || 'JSON'
  const targetKind = isArrayValue.value ? 'array' : 'object'
  return `${action} ${targetName} ${targetKind}`
})
const lineStyle = computed(() => ({
  '--json-depth': String(props.depth),
}) as CSSProperties)
const primitiveText = computed(() => formatPrimitive(props.value))
const primitiveClass = computed(() => {
  if (props.value === null) return 'json-collapse-viewer__primitive--null'
  return `json-collapse-viewer__primitive--${typeof props.value}`
})

function buildContainerEntries(value: unknown): JsonEntry[] {
  if (Array.isArray(value)) {
    return value.map((entryValue, index) => ({
      key: String(index),
      label: '',
      nodeName: `item ${index + 1}`,
      value: entryValue,
      isLast: index === value.length - 1,
    }))
  }

  if (!isRecord(value)) return []

  const entries = Object.entries(value)
  return entries.map(([entryKey, entryValue], index) => ({
    key: entryKey,
    label: entryKey,
    nodeName: entryKey,
    value: entryValue,
    isLast: index === entries.length - 1,
  }))
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value == null) return 'null'

  const serializedValue = JSON.stringify(value)
  return serializedValue ?? String(value)
}
</script>

<style scoped>
.json-collapse-viewer__line {
  min-height: 1.45rem;
  padding-left: calc(var(--json-depth) * 1.2rem);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.json-collapse-viewer__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  min-height: 1rem;
  margin: 0 0.2rem 0 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  vertical-align: -0.12rem;
}

.json-collapse-viewer__toggle:hover {
  background: var(--surface-2);
  color: var(--text);
}

.json-collapse-viewer__toggle:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 64%, white);
  outline-offset: 2px;
}

.json-collapse-viewer__caret {
  width: 0;
  height: 0;
  border-top: 0.26rem solid transparent;
  border-bottom: 0.26rem solid transparent;
  border-left: 0.38rem solid currentColor;
}

.json-collapse-viewer__caret--expanded {
  transform: rotate(90deg);
}

.json-collapse-viewer__key {
  color: var(--text);
}

.json-collapse-viewer__ellipsis,
.json-collapse-viewer__summary {
  color: var(--text-muted);
}

.json-collapse-viewer__primitive--string {
  color: var(--text);
}

.json-collapse-viewer__primitive--number,
.json-collapse-viewer__primitive--boolean,
.json-collapse-viewer__primitive--null {
  color: var(--text-muted);
}
</style>
