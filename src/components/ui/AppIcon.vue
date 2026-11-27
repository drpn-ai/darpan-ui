<template>
  <svg
    :viewBox="`0 0 ${icon.box} ${icon.box}`"
    aria-hidden="true"
    focusable="false"
    :data-icon="name"
    v-bind="paint"
  >
    <path v-for="d in icon.paths" :key="d" :d="d" :transform="icon.transform" />
    <circle
      v-for="circle in icon.circles ?? []"
      :key="`${circle.cx},${circle.cy},${circle.r}`"
      :cx="circle.cx"
      :cy="circle.cy"
      :r="circle.r"
      v-bind="circle.solid ? SOLID : {}"
    />
    <rect
      v-for="rect in icon.rects ?? []"
      :key="`${rect.x},${rect.y},${rect.width},${rect.height}`"
      :x="rect.x"
      :y="rect.y"
      :width="rect.width"
      :height="rect.height"
      :rx="rect.rx"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconDrawing, type IconName } from '../../lib/icons'

// DAR-UI-158. The one place the app draws an icon: a page names it, this draws it as src/lib/icons.ts says. Size comes
// from the context's CSS (1rem in an icon action, 1.35rem in a large one); colour is always currentColor.
const props = defineProps<{ name: IconName }>()

const icon = computed<IconDrawing>(() => ICONS[props.name])
const paint = computed<Record<string, string | number | undefined>>(() => icon.value.paint === 'fill'
  ? { fill: 'currentColor' }
  : {
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': icon.value.strokeWidth,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
const SOLID = { fill: 'currentColor', stroke: 'none' }
</script>
