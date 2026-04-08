import { randomUUID } from "node:crypto"

const baseUrlArg = process.argv.find((arg) => arg.startsWith("--base-url="))
const baseUrl = (baseUrlArg?.split("=")[1] ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const origin = new URL(baseUrl).origin
const clientIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`

function createJar() {
  return { cookies: new Map() }
}

function getCookieHeader(jar) {
  return Array.from(jar.cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

function getCookieValue(jar, name) {
  return jar.cookies.get(name) ?? ""
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
    headers: response.headers,
    text,
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
    displayName: "Auth Tester",
    email,
    password: "nadeulhae2026",
    ageBand: "30_39",
    primaryRegion: "jeonju",
    interestTags: ["walking", "other"],
    interestOther: "야경 산책",
    preferredTimeSlot: "sunset_evening",
    weatherSensitivity: ["rain", "fine_dust"],
    termsAccepted: true,
    privacyAccepted: true,
    ageConfirmed: true,
    marketingAccepted: true,
    analyticsAccepted: true,
  }
}

function buildProfilePayload() {
  return {
    displayName: "Auth Tester Updated",
    ageBand: "40_49",
    primaryRegion: "current_location",
    interestTags: ["nature", "other"],
    interestOther: "실내 전시",
    preferredTimeSlot: "afternoon",
    weatherSensitivity: ["heat", "fine_dust"],
    marketingAccepted: false,
    analyticsAccepted: false,
  }
}

async function main() {
  console.log(`Auth smoke test against ${baseUrl}`)

  const anonJar = createJar()
  const primaryJar = createJar()
  const loginJar = createJar()
  const analyticsJar = createJar()
  const email = `auth-smoke-${randomUUID()}@example.com`
  const rateLimitEmail = `auth-rate-${randomUUID()}@example.com`

  const meWithoutLogin = await request("/api/auth/me", { jar: anonJar })
  assertCondition(meWithoutLogin.status === 401, "GET /api/auth/me should return 401 without a session")
  logStep("Unauthenticated session check returned 401")

  const profileWithoutLogin = await request("/api/auth/profile", {
    method: "PATCH",
    jar: anonJar,
    json: buildProfilePayload(),
  })
  assertCondition(profileWithoutLogin.status === 401, "PATCH /api/auth/profile should return 401 without a session")
  logStep("Unauthenticated profile edit returned 401")

  const badOriginLogin = await request("/api/auth/login", {
    method: "POST",
    jar: anonJar,
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
  })
  assertCondition(badOriginLogin.status === 403, "Cross-origin login should be rejected with 403")
  logStep("Cross-origin login request returned 403")

  const nonJsonRegister = await request("/api/auth/register", {
    method: "POST",
    jar: anonJar,
    headers: {
      Origin: origin,
      "Content-Type": "text/plain",
    },
    body: "plain-text-body",
  })
  assertCondition(nonJsonRegister.status === 415, "Non-JSON register request should return 415")
  logStep("Non-JSON register request returned 415")

  const registerResult = await request("/api/auth/register", {
    method: "POST",
    jar: primaryJar,
    json: buildRegisterPayload(email),
  })
  assertCondition(registerResult.status === 201, "Valid register request should return 201")
  assertCondition(Boolean(getCookieValue(primaryJar, "nadeulhae_auth")), "Register should set an auth cookie")
  assertCondition(getCookieValue(primaryJar, "nadeulhae_analytics_consent") === "allow", "Register should sync the analytics consent cookie")
  assertCondition(registerResult.json?.user?.email === email, "Register response should include the created user")
  assertCondition(
    (registerResult.headers.get("set-cookie") ?? "").includes("Expires="),
    "Register should return a persistent cookie with Expires"
  )
  logStep("Register returned 201 and issued a persistent auth cookie")

  const duplicateRegister = await request("/api/auth/register", {
    method: "POST",
    jar: anonJar,
    json: buildRegisterPayload(email),
  })
  assertCondition(duplicateRegister.status === 409, "Duplicate register should return 409")
  logStep("Duplicate register returned 409")

  const meAfterRegister = await request("/api/auth/me", { jar: primaryJar })
  assertCondition(meAfterRegister.status === 200, "GET /api/auth/me should return 200 after register")
  assertCondition(meAfterRegister.json?.user?.email === email, "Session lookup should return the registered user")
  logStep("Session lookup returned 200 after register")

  const invalidProfile = await request("/api/auth/profile", {
    method: "PATCH",
    jar: primaryJar,
    json: {
      ...buildProfilePayload(),
      interestTags: ["other"],
      interestOther: "",
    },
  })
  assertCondition(invalidProfile.status === 400, "Invalid profile update should return 400")
  logStep("Invalid profile update returned 400")

  const validProfile = await request("/api/auth/profile", {
    method: "PATCH",
    jar: primaryJar,
    json: buildProfilePayload(),
  })
  assertCondition(validProfile.status === 200, "Valid profile update should return 200")
  assertCondition(validProfile.json?.user?.displayName === "Auth Tester Updated", "Profile update should persist the new name")
  assertCondition(validProfile.json?.user?.analyticsAccepted === false, "Profile update should persist analytics consent changes")
  assertCondition(getCookieValue(primaryJar, "nadeulhae_analytics_consent") === "essential", "Profile update should downgrade the analytics consent cookie")
  logStep("Valid profile update returned 200")

  const logoutResult = await request("/api/auth/logout", {
    method: "POST",
    jar: primaryJar,
  })
  assertCondition(logoutResult.status === 200, "Logout should return 200")
  assertCondition(!getCookieValue(primaryJar, "nadeulhae_auth"), "Logout should clear the auth cookie")
  logStep("Logout returned 200 and cleared the cookie")

  const meAfterLogout = await request("/api/auth/me", { jar: primaryJar })
  assertCondition(meAfterLogout.status === 401, "GET /api/auth/me should return 401 after logout")
  logStep("Session check returned 401 after logout")

  const wrongPasswordLogin = await request("/api/auth/login", {
    method: "POST",
    jar: loginJar,
    json: { email, password: "wrong-password" },
  })
  assertCondition(wrongPasswordLogin.status === 401, "Wrong-password login should return 401")
  logStep("Wrong-password login returned 401")

  const loginResult = await request("/api/auth/login", {
    method: "POST",
    jar: loginJar,
    json: { email, password: "nadeulhae2026" },
  })
  assertCondition(loginResult.status === 200, "Correct login should return 200")
  assertCondition(Boolean(getCookieValue(loginJar, "nadeulhae_auth")), "Correct login should set an auth cookie")
  assertCondition(getCookieValue(loginJar, "nadeulhae_analytics_consent") === "essential", "Login should restore the saved analytics consent preference")
  logStep("Correct login returned 200 and issued a cookie")

  const consentResult = await request("/api/analytics/consent", {
    method: "POST",
    jar: analyticsJar,
    json: {
      preference: "allow",
      locale: "ko",
    },
  })
  assertCondition(consentResult.status === 200, "Analytics consent route should return 200")
  assertCondition(getCookieValue(analyticsJar, "nadeulhae_analytics_consent") === "allow", "Analytics consent route should issue a consent cookie")
  logStep("Analytics consent route returned 200 and issued a consent cookie")

  const pageViewResult = await request("/api/analytics/page-view", {
    method: "POST",
    jar: analyticsJar,
    json: {
      path: "/dashboard",
      locale: "ko",
      theme: "dark",
      viewportBucket: "desktop",
      timeZone: "Asia/Seoul",
      referrerHost: "google.com",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "spring-open",
      pageLoadMs: 321,
    },
  })
  assertCondition(pageViewResult.status === 200, "Analytics page-view route should return 200")
  logStep("Analytics page-view route returned 200")

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const failure = await request("/api/auth/login", {
      method: "POST",
      jar: anonJar,
      json: { email: rateLimitEmail, password: "wrong-password" },
    })
    assertCondition(failure.status === 401, `Rate-limit setup attempt ${attempt} should return 401`)
  }

  const blockedLogin = await request("/api/auth/login", {
    method: "POST",
    jar: anonJar,
    json: { email: rateLimitEmail, password: "wrong-password" },
  })
  assertCondition(blockedLogin.status === 429, "Fifth failed login for the same email should return 429")
  logStep("Login rate limit returned 429 on the fifth failed attempt")

  const badDelete = await request("/api/auth/account", {
    method: "DELETE",
    jar: loginJar,
    json: { confirmText: "DELETE NOW" },
  })
  assertCondition(badDelete.status === 400, "Delete without the exact confirmation text should return 400")
  logStep("Delete with wrong confirmation text returned 400")

  const deleteResult = await request("/api/auth/account", {
    method: "DELETE",
    jar: loginJar,
    json: { confirmText: "DELETE" },
  })
  assertCondition(deleteResult.status === 200, "Account delete should return 200")
  assertCondition(!getCookieValue(loginJar, "nadeulhae_auth"), "Account delete should clear the auth cookie")
  logStep("Account delete returned 200 and cleared the cookie")

  const meAfterDelete = await request("/api/auth/me", { jar: loginJar })
  assertCondition(meAfterDelete.status === 401, "GET /api/auth/me should return 401 after account deletion")
  logStep("Session check returned 401 after account deletion")

  const loginAfterDelete = await request("/api/auth/login", {
    method: "POST",
    jar: loginJar,
    json: { email, password: "nadeulhae2026" },
  })
  assertCondition(loginAfterDelete.status === 401, "Deleted account should no longer be able to log in")
  logStep("Deleted account login returned 401")

  console.log("Auth smoke test passed")
}

main().catch((error) => {
  console.error("Auth smoke test failed")
  console.error(error)
  process.exitCode = 1
})
