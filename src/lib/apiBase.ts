const DEFAULT_API_BASE = '/api/v1'
const RENDER_API_BASE = 'https://studyhubai-bar8.onrender.com/api/v1'

export function resolveApiBase(configured: string | undefined, production: boolean): string {
  const value = configured?.trim()
  if (!value) return DEFAULT_API_BASE
  if (production && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(value)) {
    return DEFAULT_API_BASE
  }
  return value.replace(/\/$/, '')
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD)

// A direct WSS connection avoids relying on the CDN's support for WebSocket upgrades.
export const REALTIME_BASE = (
  import.meta.env.VITE_REALTIME_BASE_URL?.trim() ||
  (import.meta.env.PROD ? RENDER_API_BASE : API_BASE)
).replace(/\/$/, '')
