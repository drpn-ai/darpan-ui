<template>
  <!--
    The mark is built from flat fills only — no stroke. A stroked version needs its
    weight re-tuned at every size and goes muddy under 24px. The face takes
    currentColor, so one copy works on every surface and in both themes.

    Three things carry the species: ears set wide and tilted out, a broad fluffy
    head, and the tear stripes running from each eye to the jaw. Drafts that shrank
    the ears or added brow spots read as a bear and a mouse respectively.

    The viewBox is deliberately larger than the artwork's own 0-64 grid. Measured, the
    ears run from -4.8 to 68.8, so on a plain 0 0 64 64 box both were sliced flat down
    their outer edges — invisible while a pill sat behind them, obvious the moment the
    character stood on its own. The margin also leaves room for the ears to rotate when
    listening without clipping at the extremes.
  -->
  <svg
    class="mascot"
    :class="[`mascot--d${detail}`, { 'mascot--listening': listening, 'mascot--speaking': speaking }]"
    viewBox="-6 -9 76 76"
    focusable="false"
    aria-hidden="true"
  >
    <g class="mascot-ear mascot-ear--l">
      <ellipse class="mascot-ear-out" cx="11" cy="17" rx="11.5" ry="12" transform="rotate(-28 11 17)" />
      <ellipse
        v-if="detail >= 2"
        class="mascot-ear-in"
        cx="11.5"
        cy="18.5"
        rx="5.6"
        ry="6"
        transform="rotate(-28 11.5 18.5)"
      />
    </g>
    <g class="mascot-ear mascot-ear--r">
      <ellipse class="mascot-ear-out" cx="53" cy="17" rx="11.5" ry="12" transform="rotate(28 53 17)" />
      <ellipse
        v-if="detail >= 2"
        class="mascot-ear-in"
        cx="52.5"
        cy="18.5"
        rx="5.6"
        ry="6"
        transform="rotate(28 52.5 18.5)"
      />
    </g>

    <path
      class="mascot-head"
      d="M32 16c-12 0-21.5 5-24 14-1.5 5 .5 7-1 9.5-1.2 2.5 2 4 2.5 6.5.7 3.5 5.5 5 8.5 7 4 2.5 9 3.5 14 3.5s10-1 14-3.5c3-2 7.8-3.5 8.5-7 .5-2.5 3.7-4 2.5-6.5-1.5-2.5.5-4.5-1-9.5-2.5-9-12-14-24-14Z"
    />

    <path class="mascot-stripe" d="M21.4 40.2c-.6 3.8-2 7-3.8 9.4l-2.4-1.4c1.9-2.6 3.2-6 3.7-9.6z" />
    <path class="mascot-stripe" d="M42.6 40.2c.6 3.8 2 7 3.8 9.4l2.4-1.4c-1.9-2.6-3.2-6-3.7-9.6z" />

    <ellipse class="mascot-eye" cx="23.5" cy="36" rx="3.3" ry="3.7" />
    <ellipse class="mascot-eye" cx="40.5" cy="36" rx="3.3" ry="3.7" />
    <!-- The glints are the whole reason it reads as alive rather than drawn: the dock
         translates them toward the pointer through --mascot-gaze-x/y. -->
    <circle class="mascot-glint" cx="24.6" cy="34.9" r="1.05" />
    <circle class="mascot-glint" cx="41.6" cy="34.9" r="1.05" />

    <ellipse v-if="detail >= 2" class="mascot-nose" cx="32" cy="45.2" rx="3" ry="2.2" />
    <ellipse v-if="detail >= 3" class="mascot-mouth" cx="32" cy="49" rx="1.9" ry=".55" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /**
     * Detail drops on a schedule rather than by shrinking the full mark: 3 keeps
     * everything, 2 loses the mouth, 1 keeps only ears, head, eyes and stripes.
     * Under 24px a smudge reads worse than a simpler shape.
     */
    detail?: 1 | 2 | 3
    listening?: boolean
    speaking?: boolean
  }>(),
  { detail: 3, listening: false, speaking: false },
)
</script>

<style scoped>
/* --mascot-ink, not --text: on the light ground the character is drawn a step softer than
   the reading colour, or it lands as a solid dark mass and its own markings stop reading.
   Still a single colour taken through currentColor, so one copy of the mark works on every
   surface and in both themes — that property is what the fallback preserves. */
.mascot {
  display: block;
  width: 100%;
  height: 100%;
  color: var(--mascot-ink, var(--text));
  /* Pivot near the chin rather than the middle of the box, so listening reads as a head
     cocking on a neck instead of the whole drawing spinning. */
  transform-origin: 50% 84%;
  transition: transform 200ms ease;
}

/* Leaning in. The rotation is on the svg element, deliberately not on a group inside it:
   the artwork already runs to the edges of the viewBox — the ears span -4.8 to 68.8 of a
   -6..70 box — so rotating within it slices whichever ear swings outward. Rotating the
   element takes the viewport with the content and nothing clips.

   Counter-clockwise because the dock sits in the bottom-right corner: the page, and the term
   being explained, are up and to the left, so this tips the head toward what it is attending
   to. Tilting the other way reads as turning away from it.

   6deg, well under the 20 the motion sketch called for. At that size a small angle is the
   whole effect: it is enough to notice out of the corner of the eye, and it keeps the mark
   inside the fab, where the larger angles swung the raised ear out over the bubble. */
.mascot--listening {
  transform: rotate(-6deg);
}

.mascot-head,
.mascot-ear-out {
  fill: currentColor;
}

/* The one place in the product that carries a hue. Every other marking is the
   page's own ground, so the face works on any surface without a second copy. */
.mascot-ear-in,
.mascot-stripe {
  fill: var(--mascot-rust);
}

/* The dark features are knocked out in whatever sits behind the face. That is the page
   ground by default, but a filled button overrides --mascot-ground so the eyes do not
   disappear into a surface the same colour as they are. */
.mascot-eye,
.mascot-nose,
.mascot-mouth {
  fill: var(--mascot-ground, var(--bg));
}

.mascot-glint {
  fill: currentColor;
  transform: translate(
    calc(var(--mascot-gaze-x, 0) * 1.5px),
    calc(var(--mascot-gaze-y, 0) * 1.3px)
  );
  transition: transform 90ms linear;
}

/* It moves when you move, and while it is listening. Never on its own — a face
   that animates at rest pulls the eye off the data permanently. */
.mascot-ear {
  transform-box: fill-box;
  transform-origin: center bottom;
  transition: transform 200ms ease;
}

.mascot--listening .mascot-ear--l {
  transform: rotate(-9deg) translateY(-1.5%);
}

.mascot--listening .mascot-ear--r {
  transform: rotate(9deg) translateY(-1.5%);
}

.mascot-mouth {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 160ms ease;
}

.mascot--speaking .mascot-mouth {
  transform: scaleY(2.1);
}

/* The states still land, they just stop being animated into — same treatment the ears and
   mouth already had. A tilt that snaps is still a tilt; one that sweeps is motion someone
   has explicitly asked not to see. */
@media (prefers-reduced-motion: reduce) {
  .mascot,
  .mascot-glint,
  .mascot-ear,
  .mascot-mouth {
    transition: none;
  }
}
</style>
