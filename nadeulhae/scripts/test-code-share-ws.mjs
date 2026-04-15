import WebSocket from 'ws'

const BASE = process.env.CODE_SHARE_TEST_BASE_URL || 'http://127.0.0.1:3101'
const WS_BASE = process.env.CODE_SHARE_TEST_WS_URL || 'ws://127.0.0.1:3101/ws'

function readSetCookies(response) {
  return typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
}

function toCookieHeader(setCookies) {
  return setCookies
    .map((value) => value.split(';')[0])
    .filter(Boolean)
    .join('; ')
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
  const createResponse = await fetch(`${BASE}/api/code-share/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
    },
    body: JSON.stringify({
      title: 'ws-saved-test',
      language: 'python',
      code: 'print("hello")\n',
    }),
  })

  const ownerCookieHeader = toCookieHeader(readSetCookies(createResponse))
  const createPayload = await createResponse.json()
  if (!createResponse.ok || !createPayload?.session?.sessionId) {
    throw new Error(`session create failed: ${JSON.stringify(createPayload)}`)
  }

  const sessionId = createPayload.session.sessionId

  const wsOwner = new WebSocket(
    WS_BASE,
    ownerCookieHeader ? { headers: { Cookie: ownerCookieHeader } } : undefined
  )
  const wsPeer = new WebSocket(WS_BASE)

  try {
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
    wsOwner.close()
    wsPeer.close()

    await fetch(`${BASE}/api/code-share/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(ownerCookieHeader ? { Cookie: ownerCookieHeader } : {}),
      },
      body: JSON.stringify({ reason: 'test_cleanup' }),
    }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
