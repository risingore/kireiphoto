<script setup lang="ts">
const { public: pub } = useRuntimeConfig()
const buildLabel = computed(() => {
  const d = new Date(pub.buildTime)
  if (Number.isNaN(d.getTime())) return pub.buildSha
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pub.buildSha} · ${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
    <div
      class="fixed top-1 left-2 text-[10px] font-mono text-gray-400 dark:text-gray-600 select-none pointer-events-none z-50"
      :title="pub.buildTime"
    >
      {{ buildLabel }}
    </div>
    <header class="pt-3 pb-1 text-center">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
        kirei photo
      </h1>
      <p class="text-xs text-gray-400 dark:text-gray-500">
        写真を美しく高画質に
      </p>
    </header>

    <main class="max-w-lg mx-auto px-4 py-3">
      <slot />
    </main>
  </div>
</template>
