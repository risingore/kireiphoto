// Fire-and-forget ping to the HF Space root, so the Python process is ready
// by the time the user actually submits an image. Cold-starts can otherwise
// push processing past the per-request budget and lose the result.
export default defineEventHandler(async (event) => {
  const spaceUrl = getSpaceUrl(event)
  const startedAt = Date.now()
  try {
    const res = await fetch(spaceUrl + '/config', {
      signal: AbortSignal.timeout(8000),
    })
    return { ok: res.ok, elapsed: Date.now() - startedAt }
  } catch {
    return { ok: false, elapsed: Date.now() - startedAt }
  }
})
