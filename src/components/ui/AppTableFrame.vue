<template>
  <div class="app-table-shell">
    <table class="app-table">
      <colgroup v-if="showColGroup">
        <col v-for="column in columns" :key="column.key" :class="column.colClass" :style="column.colStyle" />
      </colgroup>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" :class="column.headerClass">
            <div
              :class="[
                'app-table__header-slot',
                { 'app-table__header-slot--action': column.headerAlign === 'end' },
              ]"
            >
              <slot :name="`header-${column.key}`" :column="column">
                <!-- An empty explain key is a no-op in the directive, so every table
                     keeps its current markup until a column opts in. -->
                <span v-explain="column.explain ?? ''">{{ column.label }}</span>
              </slot>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="resolveRowKey(row)"
          :data-testid="rowTestId"
          :class="{ 'app-table__row--action': isRowActionable(row, index) }"
          :role="isRowActionable(row, index) ? 'link' : undefined"
          :tabindex="isRowActionable(row, index) ? 0 : undefined"
          :aria-label="resolveRowActionLabel(row, index) ?? undefined"
          @click="triggerRowAction(row, index)"
          @keydown="handleRowActionKeydown($event, row, index)"
        >
          <td v-for="column in columns" :key="column.key" :class="column.cellClass">
            <slot :name="`cell-${column.key}`" :row="row" :column="column" :index="index">
              {{ String(row[column.key] ?? '') }}
            </slot>
          </td>
        </tr>
        <slot name="append-row" :column-count="columns.length" :row-count="rows.length" />
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, type StyleValue } from 'vue'
import { vExplain } from '../../directives/vExplain'

interface TableColumn {
  key: string
  label: string
  headerAlign?: 'start' | 'end'
  colClass?: string
  colStyle?: StyleValue
  headerClass?: string
  cellClass?: string
  /**
   * Glossary key the mascot should explain when someone rests on this column's
   * header. Headers are the right home for this and cells are not: a header is one
   * phrase amortised over every row beneath it, while a cell would be a phrase
   * written two hundred times and read none.
   */
  explain?: string
}

const props = defineProps<{
  columns: TableColumn[]
  rows: Array<Record<string, unknown>>
  rowKey?: string
  rowTestId?: string
  rowActionLabel?: (row: Record<string, unknown>, index: number) => string | null | undefined
}>()
const emit = defineEmits<{
  rowAction: [payload: { row: Record<string, unknown>, index: number }]
}>()

const showColGroup = computed(() => props.columns.some((column) => Boolean(column.colClass || column.colStyle)))
const fallbackRowKeys = new WeakMap<Record<string, unknown>, string>()
let nextFallbackRowKey = 0

function resolveRowKey(row: Record<string, unknown>): string {
  if (props.rowKey) {
    const explicitKey = row[props.rowKey]
    if (explicitKey !== null && explicitKey !== undefined && String(explicitKey).trim()) {
      return String(explicitKey)
    }
  }

  const existingKey = fallbackRowKeys.get(row)
  if (existingKey) return existingKey

  const nextKey = `app-table-row-${nextFallbackRowKey}`
  nextFallbackRowKey += 1
  fallbackRowKeys.set(row, nextKey)
  return nextKey
}

function resolveRowActionLabel(row: Record<string, unknown>, index: number): string | null {
  const label = props.rowActionLabel?.(row, index)?.trim()
  return label || null
}

function isRowActionable(row: Record<string, unknown>, index: number): boolean {
  return Boolean(resolveRowActionLabel(row, index))
}

function triggerRowAction(row: Record<string, unknown>, index: number): void {
  if (!isRowActionable(row, index)) return
  emit('rowAction', { row, index })
}

function handleRowActionKeydown(event: KeyboardEvent, row: Record<string, unknown>, index: number): void {
  if (!isRowActionable(row, index)) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  triggerRowAction(row, index)
}
</script>

<style scoped>
.app-table__row--action {
  cursor: pointer;
}

.app-table__row--action:hover {
  background: color-mix(in oklab, var(--surface-2) 88%, var(--text) 12%);
}

.app-table__row--action:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 62%, transparent);
  outline-offset: -2px;
}
</style>
