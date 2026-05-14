// Long-polling endpoint: holds a single SSE consumer connection to the HF Space
// for the entire job duration, streaming NDJSON heartbeats to the client. The
// heartbeats keep bytes flowing so Cloudflare's edge proxy doesn't drop the
// connection (524 after ~100s of silence). When the result event arrives we
// cache the file URL in KV (so a brief reconnect window survives) and emit a
// final `complete` line; the client then fetches the image via /download.
const HEARTBEAT_INTERVAL_MS = 5_000
const KV_TTL_SECONDS = 120

export default defineEventHandler(async (event) => {
  const spaceUrl = getSpaceUrl(event)
  const { id } = getQuery(event)
  if (typeof id !== 'string' || !id) {
    throw createError({ statusCode: 400, statusMessage: 'eventId が必要です' })
  }

  const kv = getEnhanceKV(event)
  if (!kv) {
    throw createError({ statusCode: 503, statusMessage: 'KV namespace ENHANCE_KV が未設定です' })
  }

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }
      const heartbeat = () => controller.enqueue(encoder.encode('\n'))
      const errorMessage = (e: unknown) =>
        e instanceof Error ? e.message : String(e ?? 'unknown')

      let sseRes: Response
      try {
        sseRes = await fetch(`${spaceUrl}/gradio_api/call/predict/${id}`)
      } catch (e) {
        send({ event: 'error', message: `SSE接続失敗: ${errorMessage(e)}` })
        controller.close()
        return
      }

      if (!sseRes.ok || !sseRes.body) {
        send({ event: 'error', message: 'AI処理の結果取得に失敗しました' })
        controller.close()
        return
      }

      const reader = sseRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const startedAt = Date.now()

      // ReadableStream allows only one pending read at a time; preserve it
      // across heartbeat iterations so the timer can fire repeatedly without
      // discarding bytes that arrived during the previous wait.
      let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null

      try {
        while (true) {
          if (!pendingRead) pendingRead = reader.read()

          let timerId: ReturnType<typeof setTimeout> | undefined
          const heartbeatPromise = new Promise<'heartbeat'>((r) => {
            timerId = setTimeout(() => r('heartbeat'), HEARTBEAT_INTERVAL_MS)
          })
          const winner = await Promise.race([pendingRead, heartbeatPromise])
          if (timerId !== undefined) clearTimeout(timerId)

          if (winner === 'heartbeat') {
            heartbeat()
            continue
          }

          pendingRead = null
          const { done, value } = winner
          if (done) {
            send({ event: 'error', message: 'AI処理がストリーム終了前に完了しませんでした' })
            controller.close()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          if (buffer.length > SSE_BUFFER_LIMIT) {
            send({ event: 'error', message: 'AI処理のレスポンスが大きすぎます' })
            controller.close()
            return
          }

          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const evt of events) {
            const result = parseSseEvent(evt)
            if (!result || result.status === 'pending') continue

            if (result.status === 'error') {
              console.log(`[wait] id=${id.slice(0, 8)} sse error: ${result.message}`)
              send({ event: 'error', message: result.message })
              controller.close()
              return
            }

            console.log(`[wait] id=${id.slice(0, 8)} complete elapsed=${Date.now() - startedAt}ms`)
            await kv.put(`r:${id}`, result.url, { expirationTtl: KV_TTL_SECONDS })
            send({ event: 'complete' })
            controller.close()
            return
          }
        }
      } catch (e) {
        send({ event: 'error', message: errorMessage(e) })
        controller.close()
      }
    },
  })

  return sendStream(event, stream)
})
