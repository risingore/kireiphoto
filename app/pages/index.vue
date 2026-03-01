<script setup lang="ts">
const {
  enhance,
  cleanup,
  progress,
  phase,
  statusMessage,
} = useImageEnhance()

type AppState = 'idle' | 'processing' | 'result'
const state = ref<AppState>('idle')
const fileInputRef = ref<HTMLInputElement>()
const originalUrl = ref('')
const enhancedUrl = ref('')
const enhancedBlob = ref<Blob>()
const errorMessage = ref('')

function selectFile() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  input.value = ''
  errorMessage.value = ''
  state.value = 'processing'

  try {
    originalUrl.value = URL.createObjectURL(file)
    const result = await enhance(file)
    enhancedUrl.value = result.enhancedUrl
    enhancedBlob.value = result.enhancedBlob
    state.value = 'result'
  } catch (err) {
    if (originalUrl.value) cleanup(originalUrl.value)
    originalUrl.value = ''
    errorMessage.value =
      err instanceof Error ? err.message : '処理に失敗しました'
    state.value = 'idle'
  }
}

async function save() {
  if (!enhancedBlob.value) return

  const ext = enhancedBlob.value.type === 'image/png' ? '.png' : '.jpg'
  const fileName = `kirei_${Date.now()}${ext}`

  if (navigator.share) {
    const file = new File([enhancedBlob.value], fileName, {
      type: enhancedBlob.value.type,
    })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'kirei photo' })
        return
      } catch {
        // User cancelled or share failed, fall through to download
      }
    }
  }

  const a = document.createElement('a')
  a.href = enhancedUrl.value
  a.download = fileName
  a.click()
}

function revokeUrls() {
  if (originalUrl.value) cleanup(originalUrl.value, enhancedUrl.value)
}

function reset() {
  revokeUrls()
  originalUrl.value = ''
  enhancedUrl.value = ''
  enhancedBlob.value = undefined
  errorMessage.value = ''
  state.value = 'idle'
}

onUnmounted(revokeUrls)
</script>

<template>
  <div class="flex flex-col items-center" :class="state === 'result' ? 'gap-3' : 'gap-6'">
    <!-- Error message -->
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="w-full"
      close
      @update:open="errorMessage = ''"
    />

    <!-- Upload State -->
    <template v-if="state === 'idle'">
      <button
        class="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex flex-col items-center justify-center gap-3 transition-all hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-gray-750 active:scale-[0.98]"
        @click="selectFile"
      >
        <div
          class="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center"
        >
          <UIcon name="i-lucide-image" class="w-8 h-8 text-primary-500" />
        </div>
        <div class="text-center">
          <p class="text-base font-semibold text-gray-700 dark:text-gray-200">
            写真を選択
          </p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
            タップして写真を選んでください
          </p>
        </div>
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileSelected"
      />
    </template>

    <!-- Processing State -->
    <template v-if="state === 'processing'">
      <div class="w-full flex flex-col items-center gap-4 py-12">
        <!-- Circular progress -->
        <div class="relative w-36 h-36">
          <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="currentColor"
              stroke-width="8"
              class="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="currentColor"
              stroke-width="8"
              stroke-linecap="round"
              class="text-primary-500 transition-all duration-500"
              :stroke-dasharray="2 * Math.PI * 52"
              :stroke-dashoffset="2 * Math.PI * 52 * (1 - progress / 100)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-3xl font-bold text-gray-700 dark:text-gray-200">
              {{ progress }}%
            </span>
          </div>
        </div>
        <!-- Status text -->
        <p class="text-base font-semibold text-gray-700 dark:text-gray-200">
          {{ statusMessage }}
        </p>
      </div>
    </template>

    <!-- Result State -->
    <template v-if="state === 'result'">
      <div class="w-full flex flex-col gap-1" style="max-height: calc(100dvh - 14rem)">
        <ComparisonSlider
          :original-url="originalUrl"
          :enhanced-url="enhancedUrl"
          class="min-h-0 flex-1"
        />
        <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center">
          スライダーを動かして比較
        </p>
      </div>

      <div class="flex gap-5 w-full px-2">
        <button
          class="flex-1 flex items-center justify-center gap-2 py-4 bg-primary-500 text-white text-lg font-semibold rounded-xl active:scale-[0.97] transition-all"
          @click="save"
        >
          <UIcon name="i-lucide-download" class="w-5 h-5" />
          保存
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-lg font-semibold rounded-xl active:scale-[0.97] transition-all"
          @click="reset"
        >
          <UIcon name="i-lucide-refresh-cw" class="w-5 h-5" />
          別の写真
        </button>
      </div>
    </template>

    <!-- Disclaimer -->
    <p
      v-if="state === 'idle'"
      class="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-relaxed"
    >
      本サービスのご利用により、画像がAI処理のためサーバーに送信されることに同意したものとみなします。送信された画像は処理後すぐに削除され、保存・二次利用は一切行いません。
    </p>
  </div>
</template>
