// Vite development uses the local FastAPI server. Production defaults to the
// same deployment origin, where Vercel serves the FastAPI function at /api.
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || (import.meta.env?.DEV ? 'http://127.0.0.1:8001' : '')
export const TOOLLOOP_AUTH_SESSION_KEY = 'toolloop_supabase_session'
let accessToken = null

function getSessionStorage() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage
}

export function getStoredAuthSession() {
  try {
    const storedSession = getSessionStorage()?.getItem(TOOLLOOP_AUTH_SESSION_KEY)
    if (!storedSession) return null
    const session = JSON.parse(storedSession)
    if (!session?.accessToken || typeof session.accessToken !== 'string') {
      getSessionStorage()?.removeItem(TOOLLOOP_AUTH_SESSION_KEY)
      return null
    }
    return session
  } catch {
    getSessionStorage()?.removeItem(TOOLLOOP_AUTH_SESSION_KEY)
    return null
  }
}

export function restoreAccessToken() {
  accessToken = getStoredAuthSession()?.accessToken ?? null
  return accessToken
}

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token, refreshToken = null, expiresAt = null) {
  accessToken = token
  try {
    getSessionStorage()?.setItem(TOOLLOOP_AUTH_SESSION_KEY, JSON.stringify({ accessToken: token, refreshToken, expiresAt }))
  } catch {
    // The current page can still use the in-memory Supabase access token if
    // sessionStorage is unavailable (for example, strict browser privacy mode).
  }
}

export function clearAccessToken() {
  accessToken = null
  try {
    getSessionStorage()?.removeItem(TOOLLOOP_AUTH_SESSION_KEY)
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export async function apiClient(path, options = {}) {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) clearAccessToken()
    const error = new Error(data?.detail || 'Unable to complete this request.')
    error.status = response.status
    throw error
  }
  return data
}