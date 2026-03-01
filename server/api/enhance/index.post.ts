export default defineEventHandler(async (event) => {
  const spaceUrl = getSpaceUrl(event)

  const body = await readBody<{ image: string }>(event)
  if (!body?.image?.startsWith('data:image/')) {
    throw createError({
      statusCode: 400,
      statusMessage: '有効な画像データが必要です',
    })
  }

  // Call HF Space Gradio API → get internal file URL
  const outputUrl = await callGradioPredict(spaceUrl, body.image)

  // Download image server-side (client never sees HF Space URL)
  const response = await fetch(outputUrl)
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: '処理済み画像のダウンロードに失敗しました',
    })
  }

  const contentType = response.headers.get('Content-Type') || 'image/png'
  setResponseHeader(event, 'Content-Type', contentType)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  return send(event, await response.arrayBuffer())
})
