<template>
  <!-- DAR-UI-126. The settings-page facts strip: one bordered row of equal cells, a small label over each value. A
       changeable fact is itself the button (no Change text) and opens its popup; a read-only one is plain text. -->
  <!-- DAR-UI-146. The frame measures the strip's own width (a narrow column on a wide screen, beside the agent), so the
       cells go 2 x 2 instead of splitting words. -->
  <div class="static-fact-frame">
    <div
      class="static-fact-strip"
      :class="{ 'static-fact-strip--many': facts.length >= 4, 'static-fact-strip--three': facts.length === 3 }"
      :style="{ '--static-fact-count': facts.length }"
      :data-testid="testId"
    >
      <component
        :is="fact.interactive ? 'button' : 'div'"
        v-for="fact in facts"
        :key="fact.key"
        :type="fact.interactive ? 'button' : undefined"
        class="static-fact"
        :class="{ 'static-fact--button': fact.interactive }"
        :aria-label="fact.interactive ? (fact.ariaLabel || `${fact.label}: ${fact.value}`) : undefined"
        :disabled="fact.interactive && fact.disabled ? true : undefined"
        :data-testid="fact.testId"
        @click="fact.interactive && !fact.disabled && emit('open', fact.key)"
      >
        <span v-explain="fact.explain ?? ''" class="static-page-summary-label">{{ fact.label }}</span>
        <span class="static-fact__value">{{ fact.value }}</span>
        <span v-if="fact.sub" class="static-fact__sub">{{ fact.sub }}</span>
      </component>
    </div>
  </div>
</template>

<script setup lang="ts">
import { vExplain } from '../../directives/vExplain'

export interface StaticFact {
  key: string
  label: string
  value: string
  /** A dim second line under the value. */
  sub?: string
  /** Glossary key the mascot answers the label with. */
  explain?: string
  /** The cell is a button that emits open; otherwise it is plain text. */
  interactive?: boolean
  /** Held while something else is in flight: still a button, for now not pressable. */
  disabled?: boolean
  /** The button's accessible name; defaults to "Label: value". */
  ariaLabel?: string
  testId?: string
}

defineProps<{
  facts: readonly StaticFact[]
  testId?: string
}>()

const emit = defineEmits<{ open: [key: string] }>()
</script>

<style scoped>
/* The frame is the flex item now. The strip's overflow: hidden drops a flex item's content-sized minimum, so a
   fixed-height flex column (the audit finding detail) squeezed the strip to its labels and clipped the values. */
.static-fact-frame {
  container-type: inline-size;
  flex-shrink: 0;
}

.static-fact-strip {
  display: grid;
  grid-template-columns: repeat(var(--static-fact-count, 4), minmax(0, 1fr));
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
}

/* Every cell the same height: the label on top, the value taking the middle, the dim line at the bottom. */
.static-fact {
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-content: start;
  gap: var(--space-00);
  min-width: 0;
  min-height: 4.6rem;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--static-tile-text-size);
  font-weight: 400;
  text-align: left;
}

.static-fact + .static-fact {
  border-left: 1px solid var(--static-tile-border);
}

.static-fact--button {
  cursor: pointer;
}

.static-fact--button:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.static-fact--button:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

/* In flight, a fact still reads; it is not greyed out, only inert. */
.static-fact--button:disabled {
  opacity: 1;
  cursor: default;
}

.static-fact__value {
  overflow-wrap: anywhere;
}

.static-fact__sub {
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

/* Two across: on a phone, and wherever a cell would fall under ~8.5rem (four or more facts under 34rem, three under
   25.5rem), so a word like "Fulfillment" stays whole. */
@media (max-width: 768px) {
  .static-fact-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .static-fact + .static-fact {
    border-left: 0;
  }

  .static-fact:nth-child(even) {
    border-left: 1px solid var(--static-tile-border);
  }

  .static-fact:nth-child(n + 3) {
    border-top: 1px solid var(--static-tile-border);
  }
}

@container (max-width: 34rem) {
  .static-fact-strip--many {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .static-fact-strip--many .static-fact + .static-fact {
    border-left: 0;
  }

  .static-fact-strip--many .static-fact:nth-child(even) {
    border-left: 1px solid var(--static-tile-border);
  }

  .static-fact-strip--many .static-fact:nth-child(n + 3) {
    border-top: 1px solid var(--static-tile-border);
  }
}

@container (max-width: 25.5rem) {
  .static-fact-strip--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .static-fact-strip--three .static-fact + .static-fact {
    border-left: 0;
  }

  .static-fact-strip--three .static-fact:nth-child(even) {
    border-left: 1px solid var(--static-tile-border);
  }

  .static-fact-strip--three .static-fact:nth-child(n + 3) {
    border-top: 1px solid var(--static-tile-border);
  }
}
</style>
