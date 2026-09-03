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
        Click me, or <span class="mascot-key">&#8984;K</span> if you’re in a hurry.
      </template>
      <template v-else-if="mascot.mode === 'tip'">
        {{ mascot.tipText }}
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
      <!-- Full detail. The reduction schedule exists for marks under 24px; this one renders at
           ~82px, where dropping the mouth is not a simplification, just a face missing a feature.
           It also had a side effect worth naming: .mascot--speaking animates the mouth, so while
           the dock rendered detail 2 the speaking state had nothing to move. -->
      <DarpanMascot :detail="3" :listening="mascot.listening" :speaking="mascot.isSpeaking" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DarpanMascot from './DarpanMascot.vue'
import { useMascotStore } from '../../stores/mascot'
import { createDwellController, type DwellController } from '../../composables/useMascotDwell'
import { createIdleHintController } from '../../composables/useIdleHints'
import { resolveExplainTarget } from '../../lib/mascotTargets'
import { hintsFor } from '../../lib/mascotHints'

/**
 * The route arrives as a prop rather than through useRoute(): the dock is shell furniture
 * that its own tests mount on their own, and reaching for the router from in here made
 * every one of them depend on a router they have no reason to build.
 */
const props = withDefaults(defineProps<{ routeName?: string | null, routeKey?: string | null }>(), {
  routeName: null,
  routeKey: null,
})

const emit = defineEmits<{ (event: 'open'): void }>()

const mascot = useMascotStore()
const dockEl = ref<HTMLElement | null>(null)

const fabLabel = 'Ask Darpan: search, or rest on a value to have it explained'

const bubbleText = computed(() => mascot.mode !== 'idle')

const leadText = computed(() => (mascot.isStumped ? 'Drawing a blank' : (mascot.entry?.title ?? '')))
const bodyText = computed(() =>
  mascot.isStumped ? '— nobody has taught me this one yet.' : `— ${mascot.entry?.body ?? ''}`,
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

/* ── App-wide hover help ───────────────────────────────────────────────────────
   One delegated listener rather than a directive on every element. Hand-wiring did
   not scale past the page being edited, which is why the first cut covered a single
   column header and read as broken. Anything the label index or the timestamp shape
   recognises is explainable, on every page, with no markup changes. */
let hovered: HTMLElement | null = null
let controller: DwellController | null = null

/* Hover is a fine-pointer affordance. Without the guard, :hover latches after a tap
   on touch and the answer has no way to be dismissed. */
function hasFinePointer(): boolean {
  if (typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function stopWatching(): void {
  controller?.cancel()
  controller = null
  hovered = null
}

function onPointerOver(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || !hasFinePointer()) return
  const target = resolveExplainTarget(event.target as Element | null)

  if (!target) {
    // Left everything explainable: release whatever is on screen, if anything.
    if (hovered) {
      controller?.leave()
      hovered = null
      controller = null
    }
    return
  }

  // An element already marked by v-explain owns its own dwell; do not double-drive it.
  if (target.el.classList.contains('is-explainable')) return
  if (target.el === hovered) return

  stopWatching()
  hovered = target.el
  // No standing mark is applied any more. When only a few counts answered, a help cursor
  // was a useful signal; now that every value, heading and control does, it would follow
  // the reader across the whole page and read as hesitancy rather than help. The bubble
  // itself is the affordance.
  controller = createDwellController({
    onListen: () => mascot.listen(),
    onSpeak: () => mascot.explain(target.term, target.detail),
    onRelease: () => mascot.clear(),
  })
  controller.enter()
}

function onPointerOut(event: PointerEvent): void {
  if (!hovered || !controller) return
  // relatedTarget still inside the same element is a move between its children.
  const to = event.relatedTarget as Node | null
  if (to && hovered.contains(to)) return
  controller.leave()
  hovered = null
  controller = null
}

/* ── Unprompted hints ──────────────────────────────────────────────────────────
   If a page sits untouched, offer something it can do. Activity means acting —
   clicking, typing, editing — not moving the pointer while reading; counting movement
   would mean the hint only ever reached someone who had left the screen. */
const idle = createIdleHintController({
  // Evaluated when the offer is due, not on arrival: a hint is filtered by what is on
  // screen at that moment, so a page that finished loading meanwhile is read correctly.
  getHints: () => hintsFor(props.routeName, document),
  // Never talk over an answer somebody asked for.
  canOffer: () => mascot.mode === 'idle',
  onOffer: (hint) => { mascot.offerTip(hint) },
  onExpire: () => { mascot.clearTip() },
})

function noteActivity(): void {
  // Acting is also how you dismiss the offer — it has been answered by doing.
  mascot.clearTip()
  idle.noteActivity()
}

watch(() => props.routeKey, () => {
  mascot.clearTip()
  idle.enter()
})

onMounted(() => {
  window.addEventListener('pointermove', trackGaze, { passive: true })
  window.addEventListener('keydown', onEscape)
  document.addEventListener('pointerover', onPointerOver, { passive: true })
  document.addEventListener('pointerout', onPointerOut, { passive: true })
  document.addEventListener('pointerdown', noteActivity, { passive: true })
  document.addEventListener('keydown', noteActivity, { passive: true })
  document.addEventListener('input', noteActivity, { passive: true })
  idle.enter()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', trackGaze)
  window.removeEventListener('keydown', onEscape)
  document.removeEventListener('pointerover', onPointerOver)
  document.removeEventListener('pointerout', onPointerOut)
  document.removeEventListener('pointerdown', noteActivity)
  document.removeEventListener('keydown', noteActivity)
  document.removeEventListener('input', noteActivity)
  idle.stop()
  stopWatching()
  mascot.clear()
})
</script>
