import test from 'node:test'
import assert from 'node:assert/strict'

const storage = new Map()
globalThis.window = {
  sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}

const {
  TOOLLOOP_AUTH_SESSION_KEY,
  clearAccessToken,
  getAccessToken,
  getStoredAuthSession,
  restoreAccessToken,
  setAccessToken,
} = await import('./apiClient.js')

test('persists a Supabase-issued session token without storing credentials', () => {
  clearAccessToken()
  setAccessToken('supabase-access-token', 'supabase-refresh-token', 1790000000)

  assert.equal(getAccessToken(), 'supabase-access-token')
  assert.deepEqual(getStoredAuthSession(), {
    accessToken: 'supabase-access-token',
    refreshToken: 'supabase-refresh-token',
    expiresAt: 1790000000,
  })

  const rawSession = storage.get(TOOLLOOP_AUTH_SESSION_KEY)
  assert.equal(rawSession.includes('password'), false)
})

test('restores and clears the persisted authentication session', () => {
  accessTokenResetForRefreshSimulation()
  assert.equal(restoreAccessToken(), 'supabase-access-token')

  clearAccessToken()
  assert.equal(getAccessToken(), null)
  assert.equal(getStoredAuthSession(), null)
})

function accessTokenResetForRefreshSimulation() {
  // Re-importing an ES module is cached in Node, so clearing its private
  // in-memory value through the public API best represents a fresh page load.
  clearAccessToken()
  storage.set(TOOLLOOP_AUTH_SESSION_KEY, JSON.stringify({ accessToken: 'supabase-access-token', refreshToken: 'supabase-refresh-token', expiresAt: 1790000000 }))
}