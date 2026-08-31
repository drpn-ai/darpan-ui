<template>
  <!--
    Replaces the "Ask Darpan" command bubble. One object in the corner: the mascot is
    the launcher AND the help, so there is one place to look and one thing to learn.

    The bubble beside the face does two jobs from the same slot — the mascot's own
    label when you hover it, and an explanation when you rest on a value elsewhere on
    the page. Nothing else ever appears here.
  -->
  <div ref="dockEl" class="mascot-dock">
    <p
      v-if="bubbleText"
      class="mascot-say"
      :class="{ 'mascot-say--going': mascot.releasing, 'mascot-say--hint': mascot.mode === 'hint' }"
      role="status"
      @pointerenter="onBubbleEnter"
      @pointerleave="onBubbleLeave"
    >
      <template v-if="mascot.mode === 'hint'">
        Click or <span class="mascot-key">&#8984;K</span> to search
      </template>
      <template v-else>
        <span class="mascot-say-lead">{{ leadText }}</span> {{ bodyText }}
      </template>
    </p>

    <button
      type="button"
      class="mascot-fab"
      :aria-label="fabLabel"
      @click="emit('open')"
      @pointerenter="onFaceEnter"
      @pointerleave="onFaceLeave"
      @focus="mascot.showHint()"
      @blur="mascot.hideHint()"
    >
      <DarpanMascot :detail="2" :listening="mascot.listening" :speaking="mascot.isSpeaking" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DarpanMascot from './DarpanMascot.vue'
import { useMascotStore } from '../../stores/mascot'

const emit = defineEmits<{ (event: 'open'): void }>()

const mascot = useMascotStore()
const dockEl = ref<HTMLElement | null>(null)

const fabLabel = 'Ask Darpan: search, or rest on a value to have it explained'

const bubbleText = computed(() => mascot.mode !== 'idle')

const leadText = computed(() => (mascot.isStumped ? 'Nothing written yet' : (mascot.entry?.title ?? '')))
const bodyText = computed(() =>
  mascot.isStumped ? '— no one has explained this field to me yet.' : `— ${mascot.entry?.body ?? ''}`,
)

function onFaceEnter(event: PointerEvent): void {
  // Touch has no hover, and a tap would otherwise latch the label open with no way
  // to dismiss it. The tap still opens the launcher through @click.
  if (event.pointerType !== 'mouse') return
  mascot.showHint()
}

function onFaceLeave(): void {
  mascot.hideHint()
}

/* Moving onto the bubble cancels the release: otherwise a three-line answer starts
   dissolving the moment you reach toward it to read. */
function onBubbleEnter(): void {
  if (mascot.mode === 'explain') mascot.releasing = false
}

function onBubbleLeave(): void {
  if (mascot.mode === 'explain') mascot.clear()
}

/**
 * The glints follow the pointer. One listener, two CSS custom properties, no
 * per-frame DOM writes — the transform lives in the mascot's own stylesheet.
 */
function trackGaze(event: PointerEvent): void {
  const el = dockEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
  const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
  const magnitude = Math.max(1, Math.hypot(dx, dy))
  el.style.setProperty('--mascot-gaze-x', (dx / magnitude).toFixed(2))
  el.style.setProperty('--mascot-gaze-y', (dy / magnitude).toFixed(2))
}

function onEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && mascot.mode !== 'idle') mascot.clear()
}

onMounted(() => {
  window.addEventListener('pointermove', trackGaze, { passive: true })
  window.addEventListener('keydown', onEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', trackGaze)
  window.removeEventListener('keydown', onEscape)
  mascot.clear()
})
</script>
