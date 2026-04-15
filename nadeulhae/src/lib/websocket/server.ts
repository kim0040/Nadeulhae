import { WebSocketServer, WebSocket } from "ws"
import type { IncomingMessage } from "node:http"
import {
  addClient,
  removeClient,
  broadcast,
  getConnectedCount,
  isMaxConnectionsReached,
  isAllowedClientMessage,
} from "@/lib/websocket/broadcast"
import { getSessionTokenHash } from "@/lib/auth/session"
import { findUserBySessionTokenHash } from "@/lib/auth/repository"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const PING_INTERVAL_MS = 30_000
const PING_TIMEOUT_MS = 60_000
const WS_ORIGIN_ALLOWLIST = new Set([
  process.env.APP_BASE_URL,
  "https://nadeulhae.space",
  "https://www.nadeulhae.space",
  "http://localhost:3000",
].filter(Boolean))

function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookieHeader) return result
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq > 0) {
      result[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
    }
  }
  return result
}

function validateOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  return WS_ORIGIN_ALLOWLIST.has(origin)
}

async function authenticateWs(req: IncomingMessage): Promise<string | null> {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  const cookies = parseCookie(cookieHeader)
  const token = cookies[AUTH_COOKIE_NAME]
  if (!token) return null

  try {
    const tokenHash = getSessionTokenHash(token)
    const session = await findUserBySessionTokenHash(tokenHash)
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

function setupHeartbeat(ws: WebSocket) {
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  const pingTimer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(pingTimer)
      clearTimers()
      return
    }

    try {
      ws.ping()
      clearTimers()
      timeoutTimer = setTimeout(() => {
        ws.terminate()
      }, PING_TIMEOUT_MS)
    } catch {
      ws.terminate()
      clearInterval(pingTimer)
      clearTimers()
    }
  }, PING_INTERVAL_MS)

  ws.on("pong", () => {
    clearTimers()
  })

  ws.on("close", () => {
    clearInterval(pingTimer)
    clearTimers()
  })

  ws.on("error", () => {
    clearInterval(pingTimer)
    clearTimers()
  })
}

export function createWebSocketServer(server: import("node:http").Server) {
  const wss = new WebSocketServer({ server, path: "/ws" })

  wss.on("connection", (ws, req) => {
    if (!validateOrigin(req)) {
      ws.close(4403, "Forbidden origin")
      return
    }

    if (isMaxConnectionsReached()) {
      ws.close(4429, "Too many connections")
      return
    }

    let userId: string | null = null

    authenticateWs(req)
      .then((id) => {
        userId = id
        if (ws.readyState !== WebSocket.OPEN) {
          return
        }

        const added = addClient(ws, userId)
        if (!added) {
          ws.close(4429, "Too many connections")
          return
        }

        broadcast("user_count", { count: getConnectedCount() })
      })
      .catch(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(4500, "Auth failed")
        }
      })

    setupHeartbeat(ws)

    ws.on("message", (data) => {
      const str = typeof data === "string" ? data : data.toString("utf-8")
      if (!isAllowedClientMessage(str)) {
        return
      }

      try {
        const parsed = JSON.parse(str)
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", payload: { ts: Date.now() } }))
        }
      } catch {}
    })

    ws.on("close", () => {
      removeClient(ws)
      broadcast("user_count", { count: getConnectedCount() })
    })

    ws.on("error", () => {
      removeClient(ws)
      broadcast("user_count", { count: getConnectedCount() })
    })
  })

  return wss
}

export { broadcast } from "@/lib/websocket/broadcast"
export { addClient, removeClient, getConnectedCount } from "@/lib/websocket/broadcast"
