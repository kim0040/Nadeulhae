import { WebSocketServer } from "ws"
import type { IncomingMessage } from "node:http"
import { WebSocket } from "ws"
import { addClient, removeClient, broadcast } from "@/lib/websocket/broadcast"
import { getSessionTokenHash } from "@/lib/auth/session"
import { findUserBySessionTokenHash } from "@/lib/auth/repository"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"

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

export function createWebSocketServer(server: import("node:http").Server) {
  const wss = new WebSocketServer({ server, path: "/ws" })

  wss.on("connection", async (ws, req) => {
    const userId = await authenticateWs(req)
    addClient(ws, userId)

    ws.on("close", () => {
      removeClient(ws)
    })

    ws.on("error", () => {
      removeClient(ws)
    })

    broadcast("user_count", { count: wss.clients.size })
  })

  return wss
}

export { broadcast } from "@/lib/websocket/broadcast"
export { addClient, removeClient, getConnectedCount } from "@/lib/websocket/broadcast"