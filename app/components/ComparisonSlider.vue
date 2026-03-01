<script setup lang="ts">
defineProps<{
  originalUrl: string
  enhancedUrl: string
}>()

const containerRef = ref<HTMLDivElement>()
const position = ref(50)
let cachedRect: DOMRect | null = null

function getPositionFromEvent(e: MouseEvent | TouchEvent): number {
  if (!cachedRect) return 50
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  return Math.max(0, Math.min(100, ((clientX - cachedRect.left) / cachedRect.width) * 100))
}

function onDrag(e: MouseEvent | TouchEvent) {
  if ('touches' in e) e.preventDefault()
  position.value = getPositionFromEvent(e)
}

function stopDrag() {
  cachedRect = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

function startDrag(e: MouseEvent | TouchEvent) {
  cachedRect = containerRef.value?.getBoundingClientRect() ?? null
  position.value = getPositionFromEvent(e)
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

onUnmounted(stopDrag)
</script>

<template>
  <div
    ref="containerRef"
    class="relative select-none overflow-hidden rounded-2xl shadow-lg cursor-ew-resize"
    style="touch-action: none"
    @mousedown="startDrag"
    @touchstart.prevent="startDrag"
  >
    <!-- Enhanced image (bottom layer) -->
    <img
      :src="enhancedUrl"
      class="block w-full h-full object-contain"
      draggable="false"
      alt="高画質化した写真"
    />

    <!-- Original image (top layer, clipped to left portion) -->
    <div
      class="absolute inset-0"
      :style="{ clipPath: `inset(0 ${100 - position}% 0 0)` }"
    >
      <img
        :src="originalUrl"
        class="block w-full h-full object-contain"
        draggable="false"
        alt="元の写真"
      />
    </div>

    <!-- Slider handle -->
    <div
      class="absolute top-0 bottom-0 z-10"
      :style="{ left: `${position}%` }"
    >
      <div class="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white shadow-md" />
      <div
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center gap-0.5"
      >
        <UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5 text-gray-600" />
        <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-gray-600" />
      </div>
    </div>

    <!-- Labels -->
    <span class="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium">
      元の写真
    </span>
    <span class="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium">
      高画質
    </span>
  </div>
</template>
