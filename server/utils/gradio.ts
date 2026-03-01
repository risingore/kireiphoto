export function getSpaceUrl(event: H3Event): string {
  const url =
    useRuntimeConfig(event).hfSpaceUrl ||
    (event.context.cloudflare?.env as Record<string, string> | undefined)
      ?.NUXT_HF_SPACE_URL
  if (!url) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Hugging Face SpaceのURLが未設定です。環境変数 NUXT_HF_SPACE_URL を設定してください。',
    })
  }
  return url.replace(/\/+$/, '')
}

export async function callGradioPredict(
  spaceUrl: string,
  imageBase64: string
): Promise<string> {
  // Step 1: Call Gradio API to start the job
  const callRes = await $fetch<{ event_id: string }>(
    `${spaceUrl}/gradio_api/call/predict`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        data: [{ url: imageBase64, meta: { _type: 'gradio.FileData' } }],
      },
    }
  )

  const eventId = callRes.event_id
  if (!eventId) {
    throw createError({ statusCode: 502, statusMessage: 'AI処理の開始に失敗しました' })
  }

  // Step 2: Poll SSE endpoint for result
  const sseRes = await fetch(`${spaceUrl}/gradio_api/call/predict/${eventId}`)
  if (!sseRes.ok || !sseRes.body) {
    throw createError({ statusCode: 502, statusMessage: 'AI処理の結果取得に失敗しました' })
  }

  const text = await sseRes.text()
  const lines = text.split('\n')

  // Parse SSE: find the "complete" event's data line
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('event: complete')) {
      const dataLine = lines[i + 1]
      if (dataLine?.startsWith('data: ')) {
        const json = JSON.parse(dataLine.slice(6))
        const output = json[0]
        // Gradio returns either a URL or a file object with url property
        if (typeof output === 'string') return output
        if (output?.url) return output.url
        throw createError({ statusCode: 502, statusMessage: 'AI処理の出力形式が不正です' })
      }
    }
    if (lines[i].startsWith('event: error')) {
      const dataLine = lines[i + 1]
      const errorMsg = dataLine?.startsWith('data: ')
        ? dataLine.slice(6)
        : 'AI処理でエラーが発生しました'
      throw createError({ statusCode: 502, statusMessage: errorMsg })
    }
  }

  throw createError({ statusCode: 504, statusMessage: 'AI処理がタイムアウトしました' })
}
