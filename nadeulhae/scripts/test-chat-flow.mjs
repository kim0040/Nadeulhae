import { randomUUID } from "node:crypto"

const baseUrlArg = process.argv.find((arg) => arg.startsWith("--base-url="))
const baseUrl = (baseUrlArg?.split("=")[1] ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const origin = new URL(baseUrl).origin
const clientIp = `198.51.100.${Math.floor(Math.random() * 150) + 30}`

function createJar() {
  return { cookies: new Map() }
}

function getCookieHeader(jar) {
  return Array.from(jar.cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

function updateJarFromHeaders(jar, response) {
  const headerValues = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean)

  for (const value of headerValues) {
    const [pair] = value.split(";")
    if (!pair) continue

    const separatorIndex = pair.indexOf("=")
    if (separatorIndex === -1) continue

    const name = pair.slice(0, separatorIndex).trim()
    const cookieValue = pair.slice(separatorIndex + 1).trim()
    if (!name) continue

    const expiresMatch = value.match(/Expires=([^;]+)/i)
    const expiresAt = expiresMatch ? new Date(expiresMatch[1]) : null
    const isExpired = expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()

    if (!cookieValue || isExpired) {
      jar.cookies.delete(name)
      continue
    }

    jar.cookies.set(name, cookieValue)
  }
}

async function request(path, options = {}) {
  const jar = options.jar ?? createJar()
  const headers = new Headers(options.headers ?? {})

  headers.set("Accept", "application/json")
  headers.set("Accept-Language", "ko")
  headers.set("X-Real-IP", clientIp)
  headers.set("X-Forwarded-For", clientIp)

  if (options.method && !["GET", "HEAD"].includes(options.method.toUpperCase()) && !headers.has("Origin")) {
    headers.set("Origin", origin)
  }

  let body = options.body
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.json)
  }

  const cookieHeader = getCookieHeader(jar)
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    redirect: "manual",
  })

  updateJarFromHeaders(jar, response)

  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return {
    response,
    status: response.status,
    json,
    jar,
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function logStep(message) {
  console.log(`- ${message}`)
}

function buildRegisterPayload(email) {
  return {
    displayName: "Chat Tester",
    nickname: "chattester",
    email,
    password: "nadeulhae2026",
    ageBand: "30_39",
    primaryRegion: "jeonju",
    interestTags: ["walking", "cafe"],
    interestOther: "",
    preferredTimeSlot: "afternoon",
    weatherSensitivity: ["rain"],
    termsAccepted: true,
    privacyAccepted: true,
    ageConfirmed: true,
    marketingAccepted: false,
    analyticsAccepted: true,
  }
}

async function main() {
  console.log(`Chat smoke test against ${baseUrl}`)

  const jar = createJar()
  const email = `chat-smoke-${randomUUID()}@example.com`
  let registered = false

  try {
    const registerResult = await request("/api/auth/register", {
      method: "POST",
      jar,
      json: buildRegisterPayload(email),
    })
    assertCondition(registerResult.status === 201, "Register should return 201 for chat smoke test")
    registered = true
    logStep("Registered a temporary test user")

    const initialState = await request("/api/chat", { jar })
    assertCondition(initialState.status === 200, "GET /api/chat should return 200")
    assertCondition(initialState.json?.usage?.requestCount === 0, "Initial chat usage should be zero")
    logStep("Initial chat state loaded")

    for (let index = 1; index <= 7; index += 1) {
      const chatResult = await request("/api/chat", {
        method: "POST",
        jar,
        json: {
          locale: "ko",
          message: `테스트 대화 ${index}회차입니다. 전주 나들이 추천을 짧게 정리해줘.`,
        },
      })

      assertCondition(chatResult.status === 200, `POST /api/chat attempt ${index} should return 200`)
      const messages = chatResult.json?.messages ?? []
      const lastMessage = messages[messages.length - 1]
      assertCondition(lastMessage?.role === "assistant", `Chat attempt ${index} should end with an assistant message`)
      logStep(`Chat request ${index} returned 200`)
    }

    const compactedState = await request("/api/chat", { jar })
    assertCondition(compactedState.status === 200, "GET /api/chat should still return 200 after multiple turns")
    assertCondition(compactedState.json?.usage?.requestCount === 7, "Chat usage should record seven requests")
    assertCondition(typeof compactedState.json?.memory?.summary === "string" && compactedState.json.memory.summary.length > 0, "Chat memory summary should be created after compaction")
    logStep("Chat memory compaction was recorded")
  } finally {
    if (registered) {
      const deleteResult = await request("/api/auth/account", {
        method: "DELETE",
        jar,
        json: { confirmText: "DELETE" },
      })
      assertCondition(deleteResult.status === 200, "Cleanup account deletion should return 200")
      logStep("Temporary user account deleted")
    }
  }
}

await main()
