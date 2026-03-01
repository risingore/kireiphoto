<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
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
