export default defineEventHandler(async (event) => {
  const { id } = getQuery(event)
  if (typeof id !== 'string' || !id) {
    throw createError({ statusCode: 400, statusMessage: 'eventId が必要です' })
  }

  const kv = getEnhanceKV(event)
  if (!kv) {
    throw createError({ statusCode: 503, statusMessage: 'KV namespace ENHANCE_KV が未設定です' })
  }

  const url = await kv.get(`r:${id}`)
  if (!url) {
    throw createError({
      statusCode: 410,
      statusMessage: '結果が見つからないか有効期限が切れました。お手数ですがもう一度お試しください。',
    })
  }

  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw createError({ statusCode: 502, statusMessage: '処理済み画像のダウンロードに失敗しました' })
  }

  setResponseHeader(event, 'Content-Type', response.headers.get('Content-Type') || 'image/png')
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return sendStream(event, response.body)
})
