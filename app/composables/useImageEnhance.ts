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
      // At 60s → ~71%, at 120s → ~83%, at 300s → ~89.5%, at 600s → ~89.99%
      progress.value = Math.round(10 + 80 * (1 - Math.exp(-elapsed / 60)))
    }, 500)
  }

  function stopProgressTimer() {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
  }

  async function enhance(file: File): Promise<{
    originalUrl: string
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

      // Step 1: Normalize the input — apply EXIF orientation and strip metadata
      // so HF Space (PIL, which ignores EXIF) and the browser agree on the
      // pixel grid. Without this, iPhone portrait photos arrive as raw
      // landscape pixels and the AI's 4x output gets stretched into the wrong
      // aspect ratio during the canvas downscale.
      phase.value = 'preparing'
      progress.value = 5
      const { dataUri, originalUrl, width: originalWidth, height: originalHeight } =
        await normalizeImage(file)

      // Step 2: Start AI job, then long-poll the NDJSON stream until complete.
      phase.value = 'enhancing'
      progress.value = 10
      startProgressTimer()

      const { eventId } = await $fetch<{ eventId: string }>('/api/enhance', {
        method: 'POST',
        body: { image: dataUri },
      })

      const aiBlob = await pollForResult(eventId)

      // Step 3: Canvas post-processing (downscale to original size + sharpen)
      stopProgressTimer()
      phase.value = 'polishing'
      progress.value = 95
      const enhancedBlob = await postProcess(aiBlob, originalWidth, originalHeight)

      const enhancedUrl = URL.createObjectURL(enhancedBlob)
      progress.value = 100

      return { originalUrl, enhancedUrl, enhancedBlob }
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

// Open a single long-polling stream that the server holds for the entire job.
// The stream emits NDJSON heartbeats so the connection stays alive past
// Cloudflare's 100s edge timeout. On `complete` we fetch the actual image from
// the download endpoint (the server cached the URL in KV).
async function pollForResult(eventId: string): Promise<Blob> {
  const res = await fetch(`/api/enhance/result?id=${encodeURIComponent(eventId)}`)
  if (!res.ok || !res.body) {
    throw new Error(await extractErrorMessage(res))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false

  try {
    while (!completed) {
      const { done, value } = await reader.read()
      if (done) {
        if (!completed) throw new Error('AI処理が予期せず終了しました')
        break
      }
      buffer += decoder.decode(value, { stream: true })

      let nlIdx: number
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nlIdx).trim()
        buffer = buffer.slice(nlIdx + 1)
        if (!line) continue

        let evt: { event?: string; message?: string }
        try {
          evt = JSON.parse(line)
        } catch {
          continue
        }

        if (evt.event === 'error') {
          throw new Error(evt.message || 'AI処理に失敗しました')
        }
        if (evt.event === 'complete') {
          completed = true
          break
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  const imgRes = await fetch(`/api/enhance/download?id=${encodeURIComponent(eventId)}`)
  if (!imgRes.ok) {
    throw new Error(await extractErrorMessage(imgRes))
  }
  return await imgRes.blob()
}

// Translate a non-2xx Response into a short, user-safe message. Cloudflare
// edge errors and HTML bodies are collapsed to a generic status string so the
// raw page never leaks into the UI.
async function extractErrorMessage(res: Response): Promise<string> {
  const fallback = `サーバーエラー (HTTP ${res.status})`
  let text = ''
  try {
    text = await res.text()
  } catch {
    return fallback
  }
  const trimmed = text.trim()
  if (!trimmed) return fallback
  if (trimmed.startsWith('<')) return fallback
  try {
    const json = JSON.parse(trimmed)
    return json.statusMessage || json.message || fallback
  } catch {
    return trimmed.length > 200 ? fallback : trimmed
  }
}

// Re-encode the file through a canvas so EXIF orientation is baked into the
// pixels and the metadata is stripped. This ensures the AI sees the same
// pixel grid the browser displays, eliminating the aspect-ratio mismatch that
// would otherwise stretch the AI output during the final downscale.
async function normalizeImage(file: File): Promise<{
  dataUri: string
  originalUrl: string
  width: number
  height: number
}> {
  const img = await loadImage(new Blob([file], { type: file.type }))
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const dataUri = canvas.toDataURL('image/jpeg', 0.92)
  const originalUrl = URL.createObjectURL(file)
  return { dataUri, originalUrl, width: img.width, height: img.height }
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

async function postProcess(blob: Blob, targetWidth: number, targetHeight: number): Promise<Blob> {
  const img = await loadImage(blob)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!

  // Downscale 4x AI output to original size + contrast +8%, saturate +12%
  ctx.filter = 'contrast(1.08) saturate(1.12)'
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
  ctx.filter = 'none'

  // Unsharp Mask
  applyUnsharpMask(ctx, targetWidth, targetHeight, 0.4, 1)

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

  // Sharpen: original + amount * (original - blurred). Channels cached
  // locally — hot loop runs WxHx4 times on a 4x upscale.
  const src = original.data
  const blur = blurred.data
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]!, g = src[i + 1]!, b = src[i + 2]!
    const br = blur[i]!, bg = blur[i + 1]!, bb = blur[i + 2]!
    src[i] = clamp(r + amount * (r - br))
    src[i + 1] = clamp(g + amount * (g - bg))
    src[i + 2] = clamp(b + amount * (b - bb))
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
        rr += data[idx]!
        gg += data[idx + 1]!
        bb += data[idx + 2]!
        count++
      }
      const idx = (y * w + x) * 4
      temp[idx] = rr / count
      temp[idx + 1] = gg / count
      temp[idx + 2] = bb / count
      temp[idx + 3] = data[idx + 3]!
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let rr = 0, gg = 0, bb = 0, count = 0
      for (let dy = -r; dy <= r; dy++) {
        const sy = Math.min(h - 1, Math.max(0, y + dy))
        const idx = (sy * w + x) * 4
        rr += temp[idx]!
        gg += temp[idx + 1]!
        bb += temp[idx + 2]!
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
