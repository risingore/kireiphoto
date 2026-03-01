export type EnhancePhase = 'idle' | 'preparing' | 'enhancing' | 'polishing'

const PHASE_LABELS: Partial<Record<EnhancePhase, string>> = {
  preparing: '画像を準備中...',
  enhancing: 'AIが高画質化処理中...',
  polishing: '仕上げ処理中...',
}

export function useImageEnhance() {
  const progress = ref(0)
  const phase = ref<EnhancePhase>('idle')

  const statusMessage = computed(() => PHASE_LABELS[phase.value] ?? '')

  let timerHandle: ReturnType<typeof setInterval> | null = null

  function startProgressTimer() {
    const startTime = Date.now()
    progress.value = 10

    timerHandle = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      // Asymptotic curve: approaches 90% but never reaches it
      // At 30s → ~63%, at 60s → ~78%, at 120s → ~86%
      progress.value = Math.round(10 + 80 * (1 - Math.exp(-elapsed / 40)))
    }, 500)
  }

  function stopProgressTimer() {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
  }

  async function enhance(file: File): Promise<{
    enhancedUrl: string
    enhancedBlob: Blob
  }> {
    progress.value = 0
    let wakeLock: WakeLockSentinel | null = null

    try {
      // Prevent screen sleep during processing
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen').catch(() => null)
      }

      // Step 1: Resize and convert to base64
      phase.value = 'preparing'
      progress.value = 5
      const dataUri = await fileToDataUri(file)

      // Step 2: Send to server (AI processing + download in one request)
      phase.value = 'enhancing'
      progress.value = 10
      startProgressTimer()

      const aiBlob = await $fetch<Blob>('/api/enhance', {
        method: 'POST',
        body: { image: dataUri },
        responseType: 'blob',
      })

      // Step 3: Canvas post-processing (sharpen + contrast/saturation)
      stopProgressTimer()
      phase.value = 'polishing'
      progress.value = 95
      const enhancedBlob = await postProcess(aiBlob)

      const enhancedUrl = URL.createObjectURL(enhancedBlob)
      progress.value = 100

      return { enhancedUrl, enhancedBlob }
    } finally {
      wakeLock?.release()
      stopProgressTimer()
      phase.value = 'idle'
      progress.value = 0
    }
  }

  function cleanup(...urls: string[]) {
    urls.forEach((url) => URL.revokeObjectURL(url))
  }

  onScopeDispose(stopProgressTimer)

  return {
    enhance,
    cleanup,
    progress,
    phase,
    statusMessage,
  }
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

async function postProcess(blob: Blob): Promise<Blob> {
  const img = await loadImage(blob)
  const { width, height } = img

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Draw with CSS filter: contrast +8%, saturate +12%
  ctx.filter = 'contrast(1.08) saturate(1.12)'
  ctx.drawImage(img, 0, 0)
  ctx.filter = 'none'

  // Unsharp Mask
  applyUnsharpMask(ctx, width, height, 0.4, 1)

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), blob.type || 'image/png', 0.95)
  })
}

function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
  radius: number,
) {
  const original = ctx.getImageData(0, 0, w, h)
  const blurred = ctx.getImageData(0, 0, w, h)

  // Box blur approximation (single pass for speed on large 4x images)
  boxBlur(blurred.data, w, h, radius)

  // Sharpen: original + amount * (original - blurred)
  const src = original.data
  const blur = blurred.data
  for (let i = 0; i < src.length; i += 4) {
    src[i] = clamp(src[i] + amount * (src[i] - blur[i]))
    src[i + 1] = clamp(src[i + 1] + amount * (src[i + 1] - blur[i + 1]))
    src[i + 2] = clamp(src[i + 2] + amount * (src[i + 2] - blur[i + 2]))
  }

  ctx.putImageData(original, 0, 0)
}

function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const size = r * 2 + 1
  const temp = new Uint8ClampedArray(data.length)

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, bb = 0, count = 0
      for (let dx = -r; dx <= r; dx++) {
        const sx = Math.min(w - 1, Math.max(0, x + dx))
        const idx = (y * w + sx) * 4
        rr += data[idx]
        gg += data[idx + 1]
        bb += data[idx + 2]
        count++
      }
      const idx = (y * w + x) * 4
      temp[idx] = rr / count
      temp[idx + 1] = gg / count
      temp[idx + 2] = bb / count
      temp[idx + 3] = data[idx + 3]
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let rr = 0, gg = 0, bb = 0, count = 0
      for (let dy = -r; dy <= r; dy++) {
        const sy = Math.min(h - 1, Math.max(0, y + dy))
        const idx = (sy * w + x) * 4
        rr += temp[idx]
        gg += temp[idx + 1]
        bb += temp[idx + 2]
        count++
      }
      const idx = (y * w + x) * 4
      data[idx] = rr / count
      data[idx + 1] = gg / count
      data[idx + 2] = bb / count
    }
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}
