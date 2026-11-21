<template>
  <!-- DAR-UI-135. One conclusion condition. At rest it reads as a plain sentence; clicking it turns just this line into
       an aligned edit row: connector, what is checked, the test, what it is tested against, done, remove. Presence-only
       lines ("the record is missing") are record subjects with no field. -->
  <button
    v-if="!editing"
    type="button"
    class="conclusion-line"
    :disabled="disabled"
    :aria-label="`Change this line: ${text}`"
    data-testid="conclusion-line"
    @click="emit('edit')"
  >
    <span class="conclusion-line__conn">{{ connector }}</span>
    <span class="conclusion-line__text">
      <template v-for="(part, index) in parts" :key="index">
        <span v-if="part.test" class="conclusion-line__test">{{ part.text }}</span>
        <template v-else>{{ part.text }}</template>
      </template>
    </span>
  </button>

  <div v-else class="conclusion-line-edit" data-testid="conclusion-line-edit">
    <span class="conclusion-line__conn conclusion-line__conn--edit">{{ connector }}</span>

    <div class="conclusion-line-edit__subject">
      <AppSelect
        v-if="showQuantifier"
        class="conclusion-line-edit__small"
        :model-value="quantifierValue"
        :options="quantifierOptions"
        :disabled="disabled"
        test-id="conclusion-line-quantifier"
        @update:model-value="chooseQuantifier"
      />
      <AppSelect
        v-if="showPresence"
        class="conclusion-line-edit__small conclusion-line-edit__presence"
        :model-value="condition.presence ?? 'ANY'"
        :options="PRESENCE_OPTIONS"
        :disabled="disabled"
        test-id="conclusion-line-presence"
        @update:model-value="choosePresence"
      />
      <template v-if="typingPath">
        <AppSelect
          v-if="!context.evaluate"
          class="conclusion-line-edit__small"
          :model-value="condition.subject"
          :options="sideOptions"
          :disabled="disabled"
          test-id="conclusion-line-side"
          @update:model-value="chooseSide"
        />
        <input
          v-model="pathDraft"
          class="conclusion-line-edit__input"
          type="text"
          placeholder="field path"
          aria-label="Field path"
          :disabled="disabled"
          data-testid="conclusion-line-path-input"
          @input="emitPath"
          @keydown.enter.prevent
        />
      </template>
      <AppSelect
        v-else
        class="conclusion-line-edit__grow"
        :model-value="subjectValue"
        :options="subjectOptions"
        placeholder="Pick what to check"
        searchable
        search-placeholder="Search fields"
        :disabled="disabled"
        test-id="conclusion-line-subject"
        @update:model-value="chooseSubject"
      />
    </div>

    <AppSelect
      :model-value="testValue"
      :options="testOptions"
      :disabled="disabled"
      test-id="conclusion-line-test"
      @update:model-value="chooseTest"
    />

    <div
      class="conclusion-line-edit__against"
      :class="{ 'conclusion-line__against--missing': valueMissing }"
    >
      <div v-if="valueKind === 'list'" class="conclusion-line-tags">
        <span v-for="value in condition.values" :key="value" class="conclusion-line-tag">
          {{ value }}
          <button
            type="button"
            class="conclusion-line-tag__remove"
            :aria-label="`Remove ${value}`"
            :disabled="disabled"
            @click="removeValue(value)"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </span>
        <input
          v-model="draft"
          class="conclusion-line-tags__input"
          type="text"
          placeholder="add a value"
          aria-label="Add a value"
          :disabled="disabled"
          data-testid="conclusion-line-tag-input"
          @keydown.enter.prevent="flushDraft"
          @keydown="onDraftKey"
          @blur="flushDraft"
        />
      </div>
      <div v-else-if="valueKind === 'number'" class="conclusion-line-number">
        <input
          :value="condition.values[0] ?? ''"
          class="conclusion-line-edit__input"
          :class="{ 'conclusion-line-edit__input--short': condition.operator === 'WITHIN_HOURS' }"
          type="text"
          inputmode="decimal"
          :placeholder="condition.operator === 'WITHIN_HOURS' ? '24' : 'number'"
          :aria-label="condition.operator === 'WITHIN_HOURS' ? 'Hours' : 'Number'"
          :disabled="disabled"
          data-testid="conclusion-line-number-input"
          @input="emitNumber"
          @keydown.enter.prevent
        />
        <span v-if="condition.operator === 'WITHIN_HOURS'" class="conclusion-line-number__unit">hours</span>
      </div>
      <span v-else class="conclusion-line-none">–</span>
    </div>

    <button
      type="button"
      class="app-icon-action conclusion-line-edit__action"
      aria-label="Done with this line"
      title="Done with this line"
      @click="emit('done')"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
        <path d="M4 10l4 4 8-8" />
      </svg>
    </button>
    <button
      type="button"
      class="app-icon-action conclusion-line-edit__action"
      aria-label="Remove this line"
      title="Remove this line"
      :disabled="disabled"
      @click="emit('remove')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import type { ConclusionOperator, RunConclusionCondition } from '../../lib/api/authoringTypes'
import type { CatalogField } from '../../lib/conclusionFieldCatalog'
import { conditionIncomplete, describeCondition, type LineContext } from '../../lib/conclusionLines'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'

const props = defineProps<{
  condition: RunConclusionCondition
  context: LineContext
  fields: CatalogField[]
  connector: 'when' | 'and'
  editing: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [condition: RunConclusionCondition]
  edit: []
  done: []
  remove: []
}>()

type Side = RunConclusionCondition['subject']
type ValueKind = 'list' | 'number' | 'none'

const PATH_VALUE = '__path__'
const NOTE = 'arrives with the new rules'

const QUANTIFIER_OPTIONS: AppSelectOption[] = [
  { value: 'ANY', label: 'any' },
  { value: 'ALL', label: 'every' },
  { value: 'NONE', label: 'no' },
]
const PRESENCE_OPTIONS: AppSelectOption[] = [
  { value: 'ANY', label: 'any' },
  { value: 'KEPT', label: 'is there' },
  { value: 'ABSENT', label: 'is missing' },
  { value: 'EXCLUDED', label: 'was set aside' },
]
const RECORD_TESTS: AppSelectOption[] = [
  { value: 'KEPT', label: 'is there' },
  { value: 'ABSENT', label: 'is missing' },
  { value: 'EXCLUDED', label: 'was set aside' },
]
const FIELD_TESTS: AppSelectOption[] = [
  { value: 'IN', label: 'is one of' },
  { value: 'NOT_IN', label: 'is not one of' },
  { value: 'GT', label: 'is more than' },
  { value: 'LT', label: 'is less than' },
  { value: 'GT_ZERO', label: 'is more than 0' },
  { value: 'WITHIN_HOURS', label: 'is within … hours' },
  { value: 'BLANK', label: 'is empty' },
  { value: 'NOT_BLANK', label: 'is not empty' },
  { value: 'FIELD_EQ', label: `equals another field · ${NOTE}`, disabled: true },
  { value: 'FIELD_NE', label: `differs from another field · ${NOTE}`, disabled: true },
  { value: 'FIELD_LT', label: `is less than another field · ${NOTE}`, disabled: true },
  { value: 'FIELD_GT', label: `is more than another field · ${NOTE}`, disabled: true },
]

const text = computed(() => describeCondition(props.condition, props.context))

// The test words stay dim so the subject and the values carry the sentence.
const TEST_WORDS = /\b(is not one of|is one of|is more than 0|is more than|is less than|is within|is not empty|is empty|is there|is missing|was set aside)\b/g
const parts = computed(() => {
  const out: { text: string; test: boolean }[] = []
  let cursor = 0
  for (const match of text.value.matchAll(TEST_WORDS)) {
    const at = match.index ?? 0
    if (at > cursor) out.push({ text: text.value.slice(cursor, at), test: false })
    out.push({ text: match[0], test: true })
    cursor = at + match[0].length
  }
  if (cursor < text.value.length) out.push({ text: text.value.slice(cursor), test: false })
  return out
})

const typingPath = ref(false)
const pathDraft = ref(props.condition.field ?? '')
const draft = ref('')
watch(() => props.condition.field, (field) => {
  if ((field ?? '') !== pathDraft.value) pathDraft.value = field ?? ''
})
watch(() => props.editing, (now) => {
  if (now) return
  typingPath.value = false
  draft.value = ''
})

const isRecord = computed(() => !props.condition.operator)
const sideName = (side: Side): string => (side === 'FILE_1' ? props.context.file1 : props.context.file2)
const sideOptions = computed<AppSelectOption[]>(() => [
  { value: 'FILE_1', label: props.context.file1 },
  { value: 'FILE_2', label: props.context.file2 },
])

const subjectOptions = computed<AppSelectOption[]>(() => {
  const options: AppSelectOption[] = props.fields.map((f) => ({ value: f.value, label: f.label }))
  const c = props.condition
  const loadedField = (c.field ?? '').trim()
  if (c.operator && loadedField) {
    const value = `${c.subject}:${loadedField}`
    if (!options.some((o) => o.value === value)) options.push({ value, label: `${sideName(c.subject)} › ${loadedField}` })
  }
  const sides: Side[] = props.context.evaluate ? ['FILE_1'] : ['FILE_1', 'FILE_2']
  for (const side of sides) {
    const name = props.context.evaluate ? '' : `${sideName(side)} `
    options.push({ value: `record:${side}:FULL`, label: `${name}record` })
    if (props.context.firstKeyField) {
      options.push({ value: `record:${side}:FIRST_FIELD`, label: `${name}${props.context.firstKeyField} record` })
    }
  }
  options.push({ value: PATH_VALUE, label: 'Type a path…' })
  return options
})

const subjectValue = computed(() => {
  const c = props.condition
  if (isRecord.value) return `record:${c.subject}:${c.keyScope === 'FIRST_FIELD' ? 'FIRST_FIELD' : 'FULL'}`
  const field = (c.field ?? '').trim()
  return field ? `${c.subject}:${field}` : ''
})

const firstSegment = computed(() => {
  const field = (props.condition.field ?? '').trim().replace(/\[[^\]]*\]/g, '')
  const dot = field.indexOf('.')
  return dot > 0 ? field.slice(0, dot) : ''
})
const showQuantifier = computed(() => !isRecord.value && firstSegment.value !== '' && props.context.listPaths.has(firstSegment.value))
const quantifierValue = computed(() => {
  const c = props.condition
  if (c.quantifier === 'ANY') return 'ANY'
  return c.operator === 'NOT_IN' ? 'NONE' : 'ALL'
})
const inNone = computed(() => showQuantifier.value && quantifierValue.value === 'NONE')
// "no" only makes sense over a list test (is one of / is not one of).
const quantifierOptions = computed(() => {
  const listTest = props.condition.operator === 'IN' || props.condition.operator === 'NOT_IN'
  return listTest ? QUANTIFIER_OPTIONS : QUANTIFIER_OPTIONS.filter((o) => o.value !== 'NONE')
})
const showPresence = computed(() => !isRecord.value && (props.condition.presence ?? 'ANY') !== 'ANY')

// Inside "no" the only test is "is one of"; the quantifier alone says "no".
const testOptions = computed(() => (isRecord.value ? RECORD_TESTS : inNone.value ? FIELD_TESTS.filter((o) => o.value === 'IN') : FIELD_TESTS))
const testValue = computed(() => {
  const c = props.condition
  if (isRecord.value) return c.presence && c.presence !== 'ANY' ? c.presence : ''
  // "no line's status is one of X" is stored as every + NOT_IN and reads "is one of".
  if (inNone.value) return 'IN'
  return c.operator ?? ''
})

function kindOf(operator: ConclusionOperator | null | undefined): ValueKind {
  if (operator === 'IN' || operator === 'NOT_IN') return 'list'
  if (operator === 'GT' || operator === 'LT' || operator === 'WITHIN_HOURS') return 'number'
  return 'none'
}
const valueKind = computed(() => kindOf(props.condition.operator))
const valueMissing = computed(() => {
  const c = props.condition
  if (valueKind.value === 'none') return false
  return conditionIncomplete({ ...c, field: c.field || 'x' })
})

function change(patch: Partial<RunConclusionCondition>): void {
  emit('update', { ...props.condition, ...patch })
}

function chooseSubject(value: string): void {
  const c = props.condition
  if (value === PATH_VALUE) {
    typingPath.value = true
    pathDraft.value = isRecord.value ? '' : (c.field ?? '')
    if (isRecord.value) change({ field: '', operator: 'IN', presence: 'ANY', keyScope: 'FULL', values: [] })
    return
  }
  if (value.startsWith('record:')) {
    const [, side, scope] = value.split(':')
    change({
      subject: side as Side,
      keyScope: scope === 'FIRST_FIELD' ? 'FIRST_FIELD' : 'FULL',
      presence: isRecord.value ? (c.presence && c.presence !== 'ANY' ? c.presence : 'KEPT') : 'KEPT',
      field: null,
      operator: null,
      values: [],
    })
    return
  }
  const picked = props.fields.find((f) => f.value === value)
  const colon = value.indexOf(':')
  const subject = (picked?.subject ?? value.slice(0, colon)) as Side
  const field = picked?.field ?? value.slice(colon + 1)
  change({
    subject,
    field,
    keyScope: 'FULL',
    presence: !isRecord.value && (c.presence ?? 'ANY') !== 'ANY' ? c.presence : 'ANY',
    operator: c.operator ?? 'IN',
    values: c.operator ? c.values : [],
  })
}

function chooseSide(value: string): void {
  change({ subject: value as Side })
}

function emitPath(): void {
  const c = props.condition
  change({ field: pathDraft.value, operator: c.operator ?? 'IN', keyScope: 'FULL', presence: isRecord.value ? 'ANY' : c.presence })
}

function choosePresence(value: string): void {
  change({ presence: value })
}

function chooseQuantifier(value: string): void {
  const c = props.condition
  const leavingNone = inNone.value
  if (value === 'NONE') {
    if (c.operator === 'IN' || c.operator === 'NOT_IN') change({ quantifier: 'ALL', operator: 'NOT_IN' })
    return
  }
  change({ quantifier: value === 'ANY' ? 'ANY' : 'ALL', ...(leavingNone ? { operator: 'IN' as const } : {}) })
}

function chooseTest(value: string): void {
  const c = props.condition
  if (isRecord.value) {
    change({ presence: value, field: null, operator: null })
    return
  }
  if (inNone.value) return
  const operator = value as ConclusionOperator
  const keep = kindOf(operator) === kindOf(c.operator) && (operator === 'WITHIN_HOURS') === (c.operator === 'WITHIN_HOURS')
  change({ operator, values: keep ? c.values : [] })
}

function splitValues(raw: string): string[] {
  return raw.split(',').map((v) => v.trim()).filter((v) => v)
}

function flushDraft(): void {
  const added = splitValues(draft.value)
  draft.value = ''
  if (added.length === 0) return
  const next = [...props.condition.values]
  for (const value of added) if (!next.includes(value)) next.push(value)
  change({ values: next })
}

// A comma ends a tag the way Enter does. The key event for "," is matched by key, not keyCode, since layouts differ.
function onDraftKey(event: KeyboardEvent): void {
  if (event.key !== ',') return
  event.preventDefault()
  flushDraft()
}

function removeValue(value: string): void {
  change({ values: props.condition.values.filter((v) => v !== value) })
}

function emitNumber(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  change({ values: raw.trim() ? [raw] : [] })
}
</script>

<style scoped>
.conclusion-line {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  /* Read-plain hover is a tint and nothing else (playbook: Motion). */
  transition: background-color var(--motion-base) var(--ease-out);
}

.conclusion-line:hover:not(:disabled),
.conclusion-line:focus-visible {
  background: color-mix(in oklab, var(--text) 5%, transparent);
}

.conclusion-line:disabled {
  cursor: default;
}

.conclusion-line__conn {
  flex: none;
  width: 2.6rem;
  color: var(--text-muted);
}

.conclusion-line__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.conclusion-line__test {
  color: var(--text-muted);
}

.conclusion-line-edit {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 17rem) 10.5rem minmax(0, 1fr) 2rem 2rem;
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.conclusion-line__conn--edit {
  padding-top: var(--space-2);
}

.conclusion-line-edit__subject,
.conclusion-line-tags,
.conclusion-line-number {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  min-width: 0;
}

.conclusion-line-edit__grow {
  flex: 1 1 auto;
  min-width: 0;
}

.conclusion-line-edit__small {
  flex: none;
  width: 6rem;
}

.conclusion-line-edit__input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 2.55rem;
}

.conclusion-line-edit__input--short {
  flex: none;
  width: 5.5rem;
}

.conclusion-line-edit__against {
  min-width: 0;
  border-bottom: 1px solid transparent;
}

/* An empty required value: dashed underline, no colour. */
.conclusion-line__against--missing {
  border-bottom: 1px dashed var(--text-muted);
}

.conclusion-line-tags {
  flex-wrap: wrap;
  min-height: 2.55rem;
  padding: var(--space-1) var(--space-1-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.conclusion-line-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-1) 0 var(--space-2);
  min-height: 1.8rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.conclusion-line-tag__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  min-height: 1.3rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.conclusion-line-tag__remove svg {
  width: 0.7rem;
  height: 0.7rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.conclusion-line-tags__input {
  flex: 1 1 6rem;
  min-width: 5rem;
  min-height: 1.8rem;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
}

.conclusion-line-number__unit,
.conclusion-line-none {
  color: var(--text-muted);
}

.conclusion-line-none {
  display: flex;
  align-items: center;
  min-height: 2.55rem;
}

.conclusion-line-edit__action {
  margin-top: var(--space-1);
}

@media (max-width: 760px) {
  .conclusion-line-edit {
    grid-template-columns: 1fr 2rem 2rem;
  }

  .conclusion-line__conn--edit,
  .conclusion-line-edit__subject,
  .conclusion-line-edit > :nth-child(3),
  .conclusion-line-edit__against {
    grid-column: 1 / -1;
  }

  .conclusion-line__conn--edit {
    padding-top: 0;
  }
}
</style>
