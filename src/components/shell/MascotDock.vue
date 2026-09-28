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
      :class="{ 'mascot-say--going': mascot.releasing, 'mascot-say--hint': hintLabelStyling }"
      role="status"
      @pointerenter="onBubbleEnter"
      @pointerleave="onBubbleLeave"
    >
      <!-- A warning speaks in the same bubble as everything else: one surface in the corner,
           so there is still one place to look. Closed it is the sentence; clicking the face
           adds the actions to the same bubble rather than opening a second thing. -->
      <template v-if="warningSpeaking">
        <span
          v-for="warning in visibleWarnings"
          :key="warning.id"
          class="mascot-say-warning"
          data-testid="mascot-warning"
        >
          <span class="mascot-say-lead">{{ warning.title }}</span> — {{ warning.body }}
        </span>
        <!-- One row, because they are one choice. Dismiss sits beside the actions rather than
             under them: "sync or dismiss" is the question, and stacking it read as two. -->
        <span
          v-if="mascot.popupOpen"
          class="mascot-say-actions"
          data-testid="mascot-warning-actions"
        >
          <button
            v-for="action in openActions"
            :key="action.testId"
            type="button"
            class="mascot-say-action"
            :data-testid="action.testId"
            @click="void action.run()"
          >{{ action.label }}</button>
          <button
            ref="dismissEl"
            type="button"
            class="mascot-say-action"
            data-testid="mascot-warning-dismiss"
            @click="void dismissWarnings()"
          >Dismiss</button>
        </span>
      </template>
      <template v-else-if="mascot.mode === 'hint'">
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
      @click="onFaceClick"
      @pointerenter="onFaceEnter"
      @pointerleave="onFaceLeave"
      @focus="mascot.showHint()"
      @blur="mascot.hideHint()"
    >
      <!-- Full detail. The reduction schedule exists for marks under 24px; this one renders at
           ~82px, where dropping the mouth is not a simplification, just a face missing a feature.
           It also had a side effect worth naming: .mascot--speaking animates the mouth, so while
           the dock rendered detail 2 the speaking state had nothing to move. -->
      <DarpanMascot
        :detail="3"
        :listening="mascot.listening"
        :speaking="mascot.isSpeaking"
        :alerting="bursting"
        :alerted="mascot.hasWarnings"
      />
    </button>

    <!-- The jump is the signal for people who can see it. This is the same signal for people
         who cannot: without it a warning would be announced by nothing at all. -->
    <p class="sr-only" role="status" aria-live="polite">{{ liveAnnouncement }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

/* The announced destination has to be true for a screen reader too, not only on hover. */
const fabLabel = computed(() =>
  mascot.hasWarnings
    ? `${mascot.warnings[0]?.title} — open the warning`
    : 'Ask Darpan: search, or rest on a value to have it explained',
)

const liveAnnouncement = computed(() =>
  mascot.hasWarnings ? `${mascot.warnings[0]?.title}. ${mascot.warnings[0]?.body}` : '',
)

/* ── Warnings ──────────────────────────────────────────────────────────────────
   Three hops at 500ms; held a little past the last frame so the class outlives it. */
const BURST_MS = 1600
const bursting = ref(false)
let burstTimer: ReturnType<typeof setTimeout> | null = null

/** No matchMedia (jsdom, SSR) reads as "motion is fine", matching DarpanMascot's own blink. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* Fires on the EDGE into "some warning stands", not per warning: a page raising two
   conditions at once is one event to the reader, and hopping twice reads as a stutter. */
watch(() => mascot.hasWarnings, (standing, wasStanding) => {
  if (!standing) {
    bursting.value = false
    return
  }
  if (wasStanding || prefersReducedMotion()) return
  bursting.value = true
  if (burstTimer) clearTimeout(burstTimer)
  burstTimer = setTimeout(() => { bursting.value = false }, BURST_MS)
})

/* One target, mode-dependent. The posture and the hover line have already announced the
   change of destination, which is how a button that changed its label differentiates itself
   rather than how two buttons do. CMD-K is untouched in App.vue, so navigation is never
   actually removed -- only the pointer route to it is occupied while a warning stands. */
function onFaceClick(): void {
  if (mascot.hasWarnings) {
    mascot.openWarnings()
    return
  }
  emit('open')
}

const dismissEl = ref<HTMLButtonElement | null>(null)

/* Focus lands on the acknowledgement when the actions appear, never on an action: Sync
   replaces the automation's whole source setup and must not be one stray Enter away. */
watch(() => mascot.popupOpen, async (open) => {
  if (!open) return
  await nextTick()
  dismissEl.value?.focus()
})

/* Dismissing must not drop focus onto the document body: a keyboard reader would be
   returned to the top of the page having lost their place. */
async function dismissWarnings(): Promise<void> {
  mascot.dismiss()
  await nextTick()
  dockEl.value?.querySelector<HTMLButtonElement>('.mascot-fab')?.focus()
}

/* An answer somebody asked for still outranks a warning — that is the whole reason warnings
   are orthogonal to `mode` rather than a fifth one. Everything else yields to the warning. */
const warningSpeaking = computed(() => mascot.hasWarnings && mascot.mode !== 'explain')

/* Closed, the bubble carries the first warning; open, it carries all of them with their
   actions. One page really can raise two, so the open state cannot show only one. */
const visibleWarnings = computed(() =>
  mascot.popupOpen ? mascot.warnings : mascot.warnings.slice(0, 1),
)

/* Every standing warning's actions, in one row with Dismiss. A warning that can only be
   acknowledged contributes nothing here, which is what `actions: []` is for. */
const openActions = computed(() => mascot.warnings.flatMap((warning) => warning.actions))

/* A standing warning speaks unprompted, so the bubble is up even at idle. */
const bubbleText = computed(() => mascot.mode !== 'idle' || warningSpeaking.value)

/* .mascot-say--hint is white-space: nowrap, written for the face's own short label. It is a claim
   about the bubble's CONTENT, not about the mode — so it must not ride along when a warning owns
   the content. Hovering the face sets mode 'hint' while warningSpeaking stays true (it steps aside
   only for 'explain'), which laid a whole warning paragraph out on one line. The warning keeps the
   bubble on hover, by design; it just no longer wears a label's styling. */
const hintLabelStyling = computed(() => mascot.mode === 'hint' && !warningSpeaking.value)

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
  if (event.key !== 'Escape') return
  // The popup outranks the bubble: it is the thing with focus in it.
  if (mascot.popupOpen) { void dismissWarnings(); return }
  if (mascot.mode !== 'idle') mascot.clear()
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

function noteActivity(event?: Event): void {
  // A pointer down anywhere outside the dock is a decision to attend to something else.
  if (mascot.popupOpen && event?.type === 'pointerdown') {
    const target = event.target as Node | null
    if (target && dockEl.value && !dockEl.value.contains(target)) void dismissWarnings()
  }
  // Acting is also how you dismiss the offer — it has been answered by doing.
  mascot.clearTip()
  idle.noteActivity()
}

watch(() => props.routeKey, () => {
  mascot.clearTip()
  // Per-visit lifetime, for free: the page raises again on its next mount, so nothing
  // anywhere has to remember that this was dismissed.
  mascot.dismiss()
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
  if (burstTimer) clearTimeout(burstTimer)
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
