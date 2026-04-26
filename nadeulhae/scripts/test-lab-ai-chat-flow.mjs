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

function buildProfilePayload() {
  return {
    displayName: "Lab Chat Tester",
    nickname: "labchattester",
    ageBand: "30_39",
    primaryRegion: "jeonju",
    interestTags: ["walking", "cafe"],
    interestOther: "",
    preferredTimeSlot: "afternoon",
    weatherSensitivity: ["rain"],
    marketingAccepted: false,
    analyticsAccepted: true,
    labEnabled: true,
  }
}

async function main() {
  console.log(`Lab AI chat smoke test against ${baseUrl}`)

  const jar = createJar()
  const email = `lab-ai-chat-smoke-${randomUUID()}@example.com`
  let registered = false

  try {
    const registerResult = await request("/api/auth/register", {
      method: "POST",
      jar,
      json: {
        ...buildProfilePayload(),
        email,
        password: "nadeulhae2026",
        termsAccepted: true,
        privacyAccepted: true,
        ageConfirmed: true,
      },
    })
    assertCondition(registerResult.status === 201, "Register should return 201 for lab AI chat smoke test")
    registered = true
    logStep("Registered a temporary test user")

    const profileResult = await request("/api/auth/profile", {
      method: "PATCH",
      jar,
      json: buildProfilePayload(),
    })
    assertCondition(profileResult.status === 200, "Profile update should return 200 when enabling lab access")
    assertCondition(profileResult.json?.user?.labEnabled === true, "Profile update should enable lab access")
    logStep("Enabled lab access on the temporary test user")

    const initialState = await request("/api/lab/ai-chat", { jar })
    assertCondition(initialState.status === 200, "GET /api/lab/ai-chat should return 200")
    assertCondition(Array.isArray(initialState.json?.models), "Lab AI chat state should include models")
    assertCondition(initialState.json.models.length >= 7, "Lab AI chat should expose at least seven allowed models")
    logStep("Loaded lab AI chat state and allowed models")

    const chatResult = await request("/api/lab/ai-chat", {
      method: "POST",
      jar,
      json: {
        locale: "ko",
        modelId: initialState.json.defaultModelId,
        message: "연결 테스트용으로 한 문장만 답해줘.",
      },
    })

    assertCondition(chatResult.status === 200, "POST /api/lab/ai-chat should return 200")
    const messages = chatResult.json?.messages ?? []
    const lastMessage = messages[messages.length - 1]
    assertCondition(lastMessage?.role === "assistant", "Lab AI chat should end with an assistant message")
    assertCondition(typeof lastMessage?.content === "string" && lastMessage.content.length > 0, "Assistant reply should contain content")
    logStep("Received a lab AI assistant response")

    console.log("Allowed models:", initialState.json.models.map((item) => item.label).join(", "))
    console.log("Default model:", initialState.json.defaultModelId)
    console.log("Reply preview:", lastMessage.content.slice(0, 120))
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
