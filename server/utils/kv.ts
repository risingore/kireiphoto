import type { H3Event } from 'h3'

export interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export function getEnhanceKV(event: H3Event): KVNamespace | null {
  const env = event.context.cloudflare?.env as Record<string, unknown> | undefined
  const kv = env?.ENHANCE_KV
  if (kv && typeof kv === 'object' && 'get' in kv && 'put' in kv) {
    return kv as KVNamespace
  }
  return null
}
