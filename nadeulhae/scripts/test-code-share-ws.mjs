import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'

const BASE = process.env.CODE_SHARE_TEST_BASE_URL || 'http://127.0.0.1:3101'
const WS_BASE = process.env.CODE_SHARE_TEST_WS_URL || 'ws://127.0.0.1:3101/ws'
const ORIGIN = new URL(BASE).origin

function createJar() {
  return { cookies: new Map() }
}

function getCookieHeader(jar) {
  return Array.from(jar.cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function readSetCookies(response) {
  return typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
}

function updateJarFromHeaders(jar, response) {
  for (const value of readSetCookies(response)) {
    const [pair] = value.split(';')
    if (!pair) continue

    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) continue

    const name = pair.slice(0, separatorIndex).trim()
    const cookieValue = pair.slice(separatorIndex + 1).trim()
    if (!name || !cookieValue) continue

    jar.cookies.set(name, cookieValue)
  }
}

async function request(path, options = {}) {
  const jar = options.jar ?? createJar()
  const headers = new Headers(options.headers ?? {})
  headers.set('Accept', 'application/json')
  headers.set('Accept-Language', 'en')

  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()) && !headers.has('Origin')) {
    headers.set('Origin', ORIGIN)
  }

  let body = options.body
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.json)
  }

  const cookieHeader = getCookieHeader(jar)
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader)
  }

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    redirect: 'manual',
  })

  updateJarFromHeaders(jar, response)
  const json = await response.json().catch(() => null)
  return { response, status: response.status, json, jar }
}

function buildRegisterPayload(email) {
  return {
    displayName: 'Code Share Tester',
    nickname: 'codesharetester',
    email,
    password: 'nadeulhae2026',
    ageBand: '30_39',
    primaryRegion: 'jeonju',
    interestTags: ['walking', 'cafe'],
    interestOther: '',
    preferredTimeSlot: 'afternoon',
    weatherSensitivity: ['rain'],
    termsAccepted: true,
    privacyAccepted: true,
    ageConfirmed: true,
    marketingAccepted: false,
    analyticsAccepted: true,
  }
}

function buildProfilePayload() {
  return {
    displayName: 'Code Share Tester',
    nickname: 'codesharetester',
    ageBand: '30_39',
    primaryRegion: 'jeonju',
    interestTags: ['walking', 'cafe'],
    interestOther: '',
    preferredTimeSlot: 'afternoon',
    weatherSensitivity: ['rain'],
    marketingAccepted: false,
    analyticsAccepted: true,
    labEnabled: true,
  }
}

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ws open timeout')), 5000)
    ws.on('open', () => {
      clearTimeout(timer)
      resolve()
    })
    ws.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function waitForMessage(ws, predicate, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage)
      reject(new Error('message timeout'))
    }, timeoutMs)

    const onMessage = (raw) => {
      try {
        const text = typeof raw === 'string' ? raw : raw.toString('utf-8')
        const parsed = JSON.parse(text)
        if (!predicate(parsed)) {
          return
        }

        clearTimeout(timer)
        ws.off('message', onMessage)
        resolve(parsed)
      } catch {
        // ignore invalid payloads
      }
    }

    ws.on('message', onMessage)
  })
}

async function main() {
  const jar = createJar()
  const email = `code-share-ws-${randomUUID()}@example.com`
  let registered = false
  let sessionId = null
  let wsOwner = null
  let wsPeer = null

  try {
    const registerResult = await request('/api/auth/register', {
      method: 'POST',
      jar,
      json: buildRegisterPayload(email),
    })
    if (registerResult.status !== 201) {
      throw new Error(`register failed: ${JSON.stringify(registerResult.json)}`)
    }
    registered = true

    const profileResult = await request('/api/auth/profile', {
      method: 'PATCH',
      jar,
      json: buildProfilePayload(),
    })
    if (profileResult.status !== 200) {
      throw new Error(`profile update failed: ${JSON.stringify(profileResult.json)}`)
    }

    const createResult = await request('/api/code-share/sessions', {
      method: 'POST',
      jar,
      json: {
        title: 'ws-saved-test',
        language: 'python',
        code: 'print("hello")\n',
      },
    })

    const ownerCookieHeader = getCookieHeader(jar)
    const createPayload = createResult.json
    if (createResult.status !== 201 || !createPayload?.session?.sessionId) {
      throw new Error(`session create failed: ${JSON.stringify(createPayload)}`)
    }

    sessionId = createPayload.session.sessionId

    const guestDeleteResponse = await fetch(`${BASE}/api/code-share/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en',
        Origin: ORIGIN,
      },
      body: JSON.stringify({ reason: 'guest_delete_attempt' }),
    })
    if (![401, 403].includes(guestDeleteResponse.status)) {
      throw new Error(`guest delete should be rejected, got ${guestDeleteResponse.status}`)
    }

    wsOwner = new WebSocket(
      WS_BASE,
      ownerCookieHeader ? { headers: { Cookie: ownerCookieHeader } } : undefined
    )
    wsPeer = new WebSocket(WS_BASE)

    await Promise.all([waitForOpen(wsOwner), waitForOpen(wsPeer)])

    wsOwner.send(JSON.stringify({ type: 'code_share_subscribe', payload: { sessionId } }))
    wsPeer.send(JSON.stringify({ type: 'code_share_subscribe', payload: { sessionId } }))

    await waitForMessage(
      wsPeer,
      (message) => message.type === 'code_share_presence' && message.payload?.sessionId === sessionId && message.payload?.count >= 2,
      7000
    )

    const patchResponse = await fetch(`${BASE}/api/code-share/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en',
        ...(ownerCookieHeader ? { Cookie: ownerCookieHeader } : {}),
      },
      body: JSON.stringify({
        title: 'ws-saved-test-updated',
        language: 'markdown',
        code: '# synced\n\nfrom websocket signal\n',
        version: createPayload.session.version,
      }),
    })

    const patchPayload = await patchResponse.json()
    if (!patchResponse.ok || !patchPayload?.session?.version) {
      throw new Error(`patch failed: ${JSON.stringify(patchPayload)}`)
    }

    wsOwner.send(
      JSON.stringify({
        type: 'code_share_saved',
        payload: {
          sessionId,
          version: patchPayload.session.version,
        },
      })
    )

    const savedMessage = await waitForMessage(
      wsPeer,
      (message) => message.type === 'code_share_saved' && message.payload?.sessionId === sessionId,
      7000
    )

    const detailResponse = await fetch(`${BASE}/api/code-share/sessions/${sessionId}`, {
      headers: {
        ...(ownerCookieHeader ? { Cookie: ownerCookieHeader } : {}),
      },
    })
    const detailPayload = await detailResponse.json()

    if (!detailResponse.ok || detailPayload?.session?.language !== 'markdown') {
      throw new Error(`detail check failed: ${JSON.stringify(detailPayload)}`)
    }

    if (!String(detailPayload?.session?.code ?? '').includes('websocket signal')) {
      throw new Error('updated code was not persisted')
    }

    console.log(JSON.stringify({
      ok: true,
      base: BASE,
      sessionId,
      presenceCount: 2,
      savedVersion: savedMessage.payload?.version ?? null,
      latestLanguage: detailPayload.session.language,
    }))
  } finally {
    wsOwner?.close()
    wsPeer?.close()

    if (sessionId) {
      await request(`/api/code-share/sessions/${sessionId}`, {
        method: 'DELETE',
        jar,
        json: { reason: 'test_cleanup' },
      }).catch(() => {})
    }

    if (registered) {
      await request('/api/auth/account', {
        method: 'DELETE',
        jar,
        json: { confirmText: 'DELETE' },
      }).catch(() => {})
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
