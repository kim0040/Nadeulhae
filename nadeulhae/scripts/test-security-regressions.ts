import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  hashPassword,
  verifyPassword,
  verifyPasswordAgainstDummy,
} from "../src/lib/auth/password"
import { resolveTrustedClientIp } from "../src/lib/request/client-ip"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function readSource(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8")
}

function assertSseLockTransfer(relativePath: string) {
  const source = readSource(relativePath)
  const responseIndex = source.indexOf("const response = new Response(stream")
  const lockTransferIndex = source.indexOf("lockReleased = true", responseIndex)
  const returnIndex = source.indexOf("return response", lockTransferIndex)

  assert.ok(responseIndex >= 0, `${relativePath}: SSE response must be constructed`)
  assert.ok(lockTransferIndex > responseIndex, `${relativePath}: stream must take lock ownership after response creation`)
  assert.ok(returnIndex > lockTransferIndex, `${relativePath}: outer handler must return only after lock ownership transfers`)
}

async function run() {
  // A proxy-verified header is the only IP input accepted for rate limits.
  assert.equal(
    resolveTrustedClientIp(
      new Headers({
        "cf-connecting-ip": "198.51.100.2",
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "192.0.2.3, 192.0.2.4",
      }),
      { trustProxyHeaders: true }
    ),
    "203.0.113.10"
  )
  assert.equal(
    resolveTrustedClientIp(new Headers({ "x-real-ip": "203.0.113.10" }), { trustProxyHeaders: false }),
    "anonymous"
  )
  assert.equal(
    resolveTrustedClientIp(
      new Headers({ "x-forwarded-for": "203.0.113.10, 192.0.2.1" }),
      { trustProxyHeaders: true, headerName: "x-forwarded-for" }
    ),
    "203.0.113.10"
  )
  assert.equal(
    resolveTrustedClientIp(new Headers({ "x-real-ip": "203.0.113.10" }), { trustProxyHeaders: true, headerName: "bad header" }),
    "anonymous"
  )

  // Password operations stay asynchronous while preserving verification semantics.
  const password = "security-regression-password"
  const credentials = await hashPassword(password)
  assert.equal(await verifyPassword(password, credentials.hash, credentials.salt), true)
  assert.equal(await verifyPassword("wrong-password", credentials.hash, credentials.salt), false)
  assert.equal(await verifyPasswordAgainstDummy(password), false)

  assertSseLockTransfer("src/app/api/chat/route.ts")
  assertSseLockTransfer("src/app/api/lab/ai-chat/route.ts")

  const chatSource = readSource("src/app/api/chat/route.ts")
  assert.ok(
    chatSource.indexOf("const reservation = await reserveDailyChatRequest")
      < chatSource.indexOf("await compactUserMemory"),
    "Daily chat budget must be checked before any optional LLM memory compaction"
  )

  const createSource = readSource("src/app/api/code-share/sessions/route.ts")
  assert.match(createSource, /CODE_SHARE_CREATE_DAILY_WINDOW_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(createSource, /cleanupRateLimitMap\(dailyMap, CODE_SHARE_CREATE_DAILY_WINDOW_MS, nowMs\)/)

  const detailSource = readSource("src/app/api/code-share/sessions/[sessionId]/route.ts")
  assert.match(detailSource, /DELETE_DAILY_WINDOW_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(detailSource, /cleanupRateLimitMap\(deleteDailyMap, DELETE_DAILY_WINDOW_MS, nowMs\)/)

  const codeShareRepositorySource = readSource("src/lib/code-share/repository.ts")
  assert.match(codeShareRepositorySource, /SELECT session_id\s+FROM code_share_sessions/)
  assert.ok(!codeShareRepositorySource.includes("owner_actor_id = ? OR owner_user_id = ?"))

  const kakaoSource = readSource("src/app/api/places/kakao-config/route.ts")
  assert.match(kakaoSource, /validateSameOriginRequest\(request\)/)
  assert.match(kakaoSource, /createBlindIndex\(getTrustedClientIp\(request\.headers\)/)
  assert.match(kakaoSource, /request_count = IF\(request_count < \?, request_count \+ 1, request_count\)/)

  const websocketSource = readSource("src/lib/websocket/server.ts")
  assert.match(websocketSource, /maxPayload: WS_MAX_PAYLOAD_BYTES/)
  assert.match(websocketSource, /WS_MESSAGE_LIMIT_PER_WINDOW/)
  assert.match(websocketSource, /reserveTrustedClientConnection\(clientIp\)/)

  const schedulerSource = readSource("src/lib/jeonju-scheduler.ts")
  assert.match(schedulerSource, /let _generationInFlight: Promise<void> \| null = null/)
  assert.match(schedulerSource, /if \(_generationInFlight\) \{[\s\S]+return _generationInFlight/)

  console.log("Security and stability regression tests passed")
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
