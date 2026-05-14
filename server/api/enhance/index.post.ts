export default defineEventHandler(async (event) => {
  const spaceUrl = getSpaceUrl(event)

  const body = await readBody<{ image: string }>(event)
  if (!body?.image?.startsWith('data:image/')) {
    throw createError({
      statusCode: 400,
      statusMessage: '有効な画像データが必要です',
    })
  }

  const eventId = await startGradioJob(spaceUrl, body.image)
  console.log(`[enhance] started job: ${eventId.slice(0, 8)}`)
  return { eventId }
})
