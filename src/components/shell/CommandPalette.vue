<template>
  <Teleport to="body">
    <div v-if="open" class="command-overlay app-popup-backdrop" @click.self="close">
      <section
        :class="['command-panel', { 'command-panel--keyboard': interactionMode === 'keyboard' }]"
        role="dialog"
        aria-modal="true"
        aria-label="Command launcher"
        @keydown="handlePanelKeydown"
      >
        <header class="command-head">
          <label class="sr-only" for="command-palette-search">Search pages and workflows</label>
          <input
            id="command-palette-search"
            ref="searchInput"
            v-model="query"
            type="text"
            name="command-search"
            class="command-input"
            role="combobox"
            aria-autocomplete="list"
            :aria-activedescendant="activeActionDomId"
            :aria-controls="resultsListId"
            aria-describedby="command-palette-hint"
            :aria-expanded="open ? 'true' : 'false'"
            inputmode="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Search pages, workflows, settings, or common terms…"
          />
          <button type="button" class="ghost-btn" @click="close">Close</button>
        </header>

        <p id="command-palette-hint" class="sr-only">
          Up and down arrows move through results, Enter opens the selected one, and typing a
          slash lists commands.
        </p>
        <p class="command-keyline" aria-hidden="true">
          <span>&#8593;&#8595; move</span>
          <span>&#8629; open</span>
          <span>/ commands</span>
        </p>
        <p v-if="showDataSearchLoading" class="mono-copy" role="status">Searching records...</p>
        <p v-if="slashNotice" class="mono-copy" role="status">{{ slashNotice }}</p>

        <div v-if="grouped.length === 0 && !slashNotice" class="empty-state compact">
          <h3>No matching results</h3>
          <p>Try words like compare files, API key, schema upload, or SFTP.</p>
        </div>

        <div v-else :id="resultsListId" class="command-results">
          <div v-for="group in grouped" :key="group.name" class="command-group">
            <p v-if="showGroupLabels" class="command-group-label">{{ group.name }}</p>
            <div class="stack-sm">
              <button
                v-for="row in group.rows"
                :id="getActionDomId(row.id)"
                :key="row.id"
                :ref="setActionRef"
                type="button"
                :aria-current="row.id === activeActionId ? 'true' : undefined"
                :class="['command-item', { 'command-item--active': row.id === activeActionId }]"
                @focus="handleActionFocus(row.id)"
                @mouseenter="handleActionMouseenter(row.id)"
                @click="execute(row)"
              >
                <span>{{ row.label }}</span>
                <span class="muted-copy">{{ row.description }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUpdate, ref, watch, type ComponentPublicInstance } from 'vue'
import { rankCommandActions } from '../../lib/commandSearch'
import {
  DEFAULT_SLASH_COMMANDS,
  resolveSlashResults,
  SLASH_PREFIX,
  type SlashCommandContext,
  type SlashResultRow,
} from '../../lib/slashCommands'
import type { CommandAction } from '../../lib/types/ux'

const props = defineProps<{
  open: boolean
  actions: CommandAction[]
  recentCommandIds?: string[]
  dataSearchLoading?: boolean
  slashContext?: SlashCommandContext
}>()

const emit = defineEmits<{
  close: []
  execute: [action: CommandAction]
  runSlash: [row: SlashResultRow]
}>()

/** A navigation result and a slash result share one list so keyboard nav stays a single code path. */
interface PaletteRow {
  id: string
  label: string
  description: string
  group: string
  kind: 'action' | 'command' | 'option'
  action: CommandAction | null
  slashRow: SlashResultRow | null
}

const EMPTY_SLASH_CONTEXT: SlashCommandContext = { availableTenants: [], activeTenantUserGroupId: null }

const query = ref('')
const activeIndex = ref(-1)
const actionRefs = ref<HTMLButtonElement[]>([])
const searchInput = ref<HTMLInputElement | null>(null)
const interactionMode = ref<'keyboard' | 'pointer'>('keyboard')
const resultsListId = 'command-palette-results'

const slashResolution = computed(() =>
  resolveSlashResults(query.value, DEFAULT_SLASH_COMMANDS, props.slashContext ?? EMPTY_SLASH_CONTEXT),
)
const isSlashMode = computed(() => slashResolution.value.isSlashQuery)
const slashNotice = computed(() => (isSlashMode.value ? slashResolution.value.notice : null))

const rows = computed<PaletteRow[]>(() => {
  if (isSlashMode.value) {
    return slashResolution.value.rows.map((slashRow) => ({
      id: slashRow.id,
      label: slashRow.label,
      description: slashRow.description,
      group: 'Commands',
      kind: slashRow.kind,
      action: null,
      slashRow,
    }))
  }

  return rankCommandActions(props.actions, query.value, props.recentCommandIds ?? []).map((action) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    group: action.group,
    kind: 'action' as const,
    action,
    slashRow: null,
  }))
})

const activeActionId = computed(() => rows.value[activeIndex.value]?.id ?? null)
const activeActionDomId = computed(() => (activeActionId.value ? getActionDomId(activeActionId.value) : undefined))

const grouped = computed(() => {
  const groups: Array<{ name: string; rows: PaletteRow[] }> = []

  for (const row of rows.value) {
    const existing = groups.find((item) => item.name === row.group)
    if (existing) {
      existing.rows.push(row)
    } else {
      groups.push({ name: row.group, rows: [row] })
    }
  }

  return groups
})

const showGroupLabels = computed(() => grouped.value.length > 1)
const showDataSearchLoading = computed(
  () => props.dataSearchLoading === true && query.value.trim().length > 0 && !isSlashMode.value,
)

onBeforeUpdate(() => {
  actionRefs.value = []
})

function setActionRef(element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLButtonElement) {
    actionRefs.value.push(element)
  }
}

function close(): void {
  emit('close')
}

function getActionDomId(actionId: string): string {
  return `command-palette-option-${actionId}`
}

/**
 * The text that typing this row out in full would produce. A command row stops at the trailing
 * space that opens argument mode; an option row spells out its label so Enter can confirm it.
 */
function completionFor(row: PaletteRow): string | null {
  if (!row.slashRow) return null
  const prefix = `${SLASH_PREFIX}${row.slashRow.commandName} `
  return row.kind === 'command' ? prefix : `${prefix}${row.label}`
}

function completeInput(row: PaletteRow): void {
  const completion = completionFor(row)
  if (completion === null) return

  query.value = completion
  void nextTick(() => {
    searchInput.value?.focus()
  })
}

function execute(row: PaletteRow): void {
  if (row.kind === 'action' && row.action) {
    emit('execute', row.action)
    return
  }

  // A command row names a command that still needs its argument, so Enter completes the input to
  // `/name ` and hands the user straight to the argument list. Only option rows run anything.
  if (row.kind === 'command') {
    completeInput(row)
    return
  }

  if (row.slashRow) emit('runSlash', row.slashRow)
}

function resetActiveIndex(): void {
  activeIndex.value = rows.value.length > 0 ? 0 : -1
}

function moveActive(delta: number): void {
  const resultCount = rows.value.length
  if (resultCount === 0) return

  interactionMode.value = 'keyboard'
  const currentIndex = activeIndex.value >= 0 ? activeIndex.value : 0
  activeIndex.value = (currentIndex + delta + resultCount) % resultCount
}

function setActiveIndexById(actionId: string): void {
  const nextIndex = rows.value.findIndex((row) => row.id === actionId)
  if (nextIndex >= 0) {
    activeIndex.value = nextIndex
  }
}

function handleActionFocus(actionId: string): void {
  setActiveIndexById(actionId)
}

function handleActionMouseenter(actionId: string): void {
  interactionMode.value = 'pointer'
  setActiveIndexById(actionId)
}

function focusActiveAction(): void {
  void nextTick(() => {
    actionRefs.value[activeIndex.value]?.focus()
  })
}

function handlePanelKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return

  const target = event.target
  const searchIsFocused = target === searchInput.value
  const actionButtonIsFocused = target instanceof HTMLButtonElement && actionRefs.value.includes(target)

  switch (event.key) {
    case 'ArrowDown':
    case 'Down':
      if (!searchIsFocused && !actionButtonIsFocused) return
      event.preventDefault()
      moveActive(1)
      if (actionButtonIsFocused) focusActiveAction()
      return
    case 'ArrowUp':
    case 'Up':
      if (!searchIsFocused && !actionButtonIsFocused) return
      event.preventDefault()
      moveActive(-1)
      if (actionButtonIsFocused) focusActiveAction()
      return
    case 'Tab':
      // Tab only means "complete" while a slash command is being typed. Outside slash mode it stays
      // the browser's focus key, and Shift+Tab always does, so the palette never traps focus.
      if (!searchIsFocused && !actionButtonIsFocused) return
      if (!isSlashMode.value || event.shiftKey) return
      event.preventDefault()
      completeActive()
      return
    case 'Enter':
      if (!searchIsFocused) return
      event.preventDefault()
      executeActive()
      return
    default:
      return
  }
}

function readActiveRow(): PaletteRow | null {
  return (activeIndex.value >= 0 ? rows.value[activeIndex.value] : rows.value[0]) ?? null
}

function executeActive(): void {
  const activeRow = readActiveRow()
  if (!activeRow) return
  execute(activeRow)
}

function completeActive(): void {
  const activeRow = readActiveRow()
  if (!activeRow) return
  completeInput(activeRow)
}

watch(
  rows,
  (nextRows) => {
    if (nextRows.length === 0) {
      activeIndex.value = -1
      return
    }

    if (activeIndex.value < 0 || activeIndex.value >= nextRows.length) {
      activeIndex.value = 0
    }
  },
  { immediate: true },
)

watch(query, () => {
  interactionMode.value = 'keyboard'
  resetActiveIndex()
})

watch(activeIndex, async (nextIndex) => {
  if (nextIndex < 0) return

  await nextTick()
  actionRefs.value[nextIndex]?.scrollIntoView?.({ block: 'nearest' })
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      query.value = ''
      activeIndex.value = -1
      interactionMode.value = 'keyboard'
      return
    }

    interactionMode.value = 'keyboard'
    resetActiveIndex()
    void nextTick(() => {
      searchInput.value?.focus()
    })
  },
  { immediate: true },
)
</script>
