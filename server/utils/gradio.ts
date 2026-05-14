import type { H3Event } from 'h3'

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

export async function startGradioJob(
  spaceUrl: string,
  imageBase64: string
): Promise<string> {
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
  return eventId
}

export type PollResult =
  | { status: 'complete'; url: string }
  | { status: 'error'; message: string }
  | { status: 'pending' }

export const SSE_BUFFER_LIMIT = 1_000_000

export function parseSseEvent(rawEvent: string): PollResult | null {
  let eventName = ''
  const dataLines: string[] = []
  for (const line of rawEvent.split('\n')) {
    const clean = line.replace(/\r$/, '')
    if (clean.startsWith('event: ')) eventName = clean.slice(7).trim()
    else if (clean.startsWith('data: ')) dataLines.push(clean.slice(6))
  }
  const data = dataLines.join('\n')

  if (eventName === 'complete') {
    const parsed = JSON.parse(data)
    const output = parsed[0]
    if (typeof output === 'string') return { status: 'complete', url: output }
    if (output?.url) return { status: 'complete', url: output.url }
    return { status: 'error', message: 'AI処理の出力形式が不正です' }
  }
  if (eventName === 'error') {
    return { status: 'error', message: data || 'AI処理でエラーが発生しました' }
  }
  return null
}
