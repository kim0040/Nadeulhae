import { randomUUID } from "node:crypto"
import { WebSocketServer, WebSocket } from "ws"
import type { IncomingMessage } from "node:http"
import {
  addClient,
  removeClient,
  updateClientMeta,
  broadcast,
  broadcastToRoom,
  getConnectedCount,
  isMaxConnectionsReached,
  joinRoom,
  leaveRoom,
  parseAllowedClientMessage,
} from "@/lib/websocket/broadcast"
import { getSessionTokenHash } from "@/lib/auth/session"
import { findUserBySessionTokenHash } from "@/lib/auth/repository"
import { isValidCodeShareSessionId, toCodeShareRoomName } from "@/lib/code-share/constants"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const CODE_SHARE_ACTOR_COOKIE_NAME = process.env.CODE_SHARE_ACTOR_COOKIE_NAME ?? "nadeulhae_code_share_actor"
const CODE_SHARE_ALIAS_COOKIE_NAME = process.env.CODE_SHARE_ALIAS_COOKIE_NAME ?? "nadeulhae_code_share_alias"
const PING_INTERVAL_MS = 30_000
const PING_TIMEOUT_MS = 60_000
const CODE_SHARE_TYPING_TIMEOUT_MS = 7_500
const WS_ORIGIN_ALLOWLIST = new Set([
  process.env.APP_BASE_URL,
  "https://nadeulhae.space",
  "https://www.nadeulhae.space",
  "http://localhost:3000",
].filter(Boolean))

type CodeSharePresenceActor = {
  actorId: string
  alias: string
  connections: number
  typing: boolean
}

const codeSharePresenceBySession = new Map<string, Map<string, CodeSharePresenceActor>>()
const codeShareTypingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

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
  // WebSocket does not use CORS preflight. Origin allowlist is explicit server-side protection.
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

function getActorIdFromRequest(req: IncomingMessage) {
  const cookieHeader = req.headers.cookie
  const cookies = parseCookie(cookieHeader)
  const actorId = cookies[CODE_SHARE_ACTOR_COOKIE_NAME]
  if (typeof actorId !== "string") {
    return null
  }

  const normalized = actorId.trim()
  if (!/^[a-f0-9-]{36}$/i.test(normalized)) {
    return null
  }

  return normalized
}

function getActorAliasFromRequest(req: IncomingMessage) {
  const cookieHeader = req.headers.cookie
  const cookies = parseCookie(cookieHeader)
  const alias = cookies[CODE_SHARE_ALIAS_COOKIE_NAME]
  if (typeof alias !== "string") {
    return null
  }

  const normalized = alias.trim()
  if (!/^[A-Za-z0-9가-힣\-_\s]{2,40}$/.test(normalized)) {
    return null
  }

  return normalized
}

function getTypingTimeoutKey(sessionId: string, actorId: string) {
  return `${sessionId}:${actorId}`
}

function clearTypingTimeout(sessionId: string, actorId: string) {
  const key = getTypingTimeoutKey(sessionId, actorId)
  const timeout = codeShareTypingTimeouts.get(key)
  if (timeout) {
    clearTimeout(timeout)
    codeShareTypingTimeouts.delete(key)
  }
}

function getOrCreatePresenceMap(sessionId: string) {
  if (!codeSharePresenceBySession.has(sessionId)) {
    codeSharePresenceBySession.set(sessionId, new Map())
  }
  return codeSharePresenceBySession.get(sessionId)!
}

function joinCodeSharePresence(sessionId: string, actorId: string, alias: string) {
  const presenceMap = getOrCreatePresenceMap(sessionId)
  const existing = presenceMap.get(actorId)

  if (existing) {
    // Same actor may open multiple tabs; track connection count per actor.
    existing.connections += 1
    existing.alias = alias
    return
  }

  presenceMap.set(actorId, {
    actorId,
    alias,
    connections: 1,
    typing: false,
  })
}

function leaveCodeSharePresence(sessionId: string, actorId: string) {
  const presenceMap = codeSharePresenceBySession.get(sessionId)
  if (!presenceMap) {
    return
  }

  const existing = presenceMap.get(actorId)
  if (!existing) {
    return
  }

  existing.connections -= 1
  if (existing.connections <= 0) {
    presenceMap.delete(actorId)
    clearTypingTimeout(sessionId, actorId)
  }

  if (presenceMap.size === 0) {
    codeSharePresenceBySession.delete(sessionId)
  }
}

function setCodeShareTyping(sessionId: string, actorId: string, isTyping: boolean) {
  const presenceMap = codeSharePresenceBySession.get(sessionId)
  if (!presenceMap) {
    return
  }

  const existing = presenceMap.get(actorId)
  if (!existing) {
    return
  }

  if (!isTyping) {
    existing.typing = false
    clearTypingTimeout(sessionId, actorId)
    return
  }

  existing.typing = true
  clearTypingTimeout(sessionId, actorId)

  const timeoutKey = getTypingTimeoutKey(sessionId, actorId)
  // Auto-clear typing status if client disconnects abruptly without sending isTyping=false.
  const timeout = setTimeout(() => {
    const latestMap = codeSharePresenceBySession.get(sessionId)
    const latest = latestMap?.get(actorId)
    if (!latest) {
      codeShareTypingTimeouts.delete(timeoutKey)
      return
    }

    latest.typing = false
    codeShareTypingTimeouts.delete(timeoutKey)
    broadcastCodeSharePresence(sessionId)
  }, CODE_SHARE_TYPING_TIMEOUT_MS)

  codeShareTypingTimeouts.set(timeoutKey, timeout)
}

function buildCodeSharePresencePayload(sessionId: string) {
  const actors = codeSharePresenceBySession.get(sessionId)
  if (!actors) {
    return {
      sessionId,
      count: 0,
      participants: [] as Array<{
        actorId: string
        alias: string
        typing: boolean
      }>,
    }
  }

  const participants = [...actors.values()]
    .sort((a, b) => a.alias.localeCompare(b.alias))
    .map((actor) => ({
      actorId: actor.actorId,
      alias: actor.alias,
      typing: actor.typing,
    }))

  // Count tracks active socket connections (not unique actors) to mirror "currently connected tabs".
  const count = [...actors.values()].reduce((sum, actor) => sum + Math.max(0, actor.connections), 0)

  return {
    sessionId,
    count,
    participants,
  }
}

function broadcastCodeSharePresence(sessionId: string) {
  const room = toCodeShareRoomName(sessionId)
  broadcastToRoom(room, "code_share_presence", buildCodeSharePresencePayload(sessionId))
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

    const actorId = getActorIdFromRequest(req) ?? `guest-${randomUUID()}`
    const actorAlias = getActorAliasFromRequest(req) ?? `Guest-${actorId.slice(-4)}`
    const subscribedCodeShareSessions = new Set<string>()
    let cleanedUp = false

    // Register client immediately so room joins work even before async auth completes.
    // userId is set to null here and updated once authenticateWs resolves.
    const added = addClient(ws, null, actorId, actorAlias)
    if (!added) {
      ws.close(4429, "Too many connections")
      return
    }

    broadcast("user_count", { count: getConnectedCount() })

    const cleanup = () => {
      if (cleanedUp) {
        return
      }
      cleanedUp = true

      const affectedSessionIds = [...subscribedCodeShareSessions]
      for (const sessionId of affectedSessionIds) {
        leaveCodeSharePresence(sessionId, actorId)
      }

      removeClient(ws)
      broadcast("user_count", { count: getConnectedCount() })

      for (const sessionId of affectedSessionIds) {
        broadcastCodeSharePresence(sessionId)
      }
    }

    // Auth is optional for code-share guest usage, but user id is attached when cookie session is valid.
    authenticateWs(req)
      .then((userId) => {
        if (ws.readyState !== WebSocket.OPEN) {
          return
        }

        // Client is already registered; just patch the userId from auth result.
        updateClientMeta(ws, { userId })
      })
      .catch(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(4500, "Auth failed")
        }
      })

    setupHeartbeat(ws)

    ws.on("message", (data) => {
      const str = typeof data === "string" ? data : data.toString("utf-8")
      const parsed = parseAllowedClientMessage(str)
      if (!parsed) {
        return
      }

      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", payload: { ts: Date.now() } }))
        return
      }

      const sessionId = parsed.payload.sessionId
      if (!isValidCodeShareSessionId(sessionId)) {
        return
      }

      const room = toCodeShareRoomName(sessionId)

      if (parsed.type === "code_share_subscribe") {
        const joined = joinRoom(ws, room)
        if (!joined) {
          return
        }

        subscribedCodeShareSessions.add(sessionId)
        joinCodeSharePresence(sessionId, actorId, actorAlias)
        broadcastCodeSharePresence(sessionId)
        return
      }

      if (parsed.type === "code_share_unsubscribe") {
        leaveRoom(ws, room)
        subscribedCodeShareSessions.delete(sessionId)
        leaveCodeSharePresence(sessionId, actorId)
        broadcastCodeSharePresence(sessionId)
        return
      }

      if (parsed.type === "code_share_typing") {
        if (!subscribedCodeShareSessions.has(sessionId)) {
          return
        }

        setCodeShareTyping(sessionId, actorId, parsed.payload.isTyping)
        broadcastCodeSharePresence(sessionId)
        return
      }

      if (parsed.type === "code_share_saved") {
        if (!subscribedCodeShareSessions.has(sessionId)) {
          return
        }

        // Secondary sync signal: clients use this to trigger silent refresh when direct patch event is missed.
        broadcastToRoom(
          room,
          "code_share_saved",
          {
            sessionId,
            version: parsed.payload.version,
            actor: {
              actorId,
              alias: actorAlias,
            },
          },
          ws
        )
      }
    })

    ws.on("close", cleanup)
    ws.on("error", cleanup)
  })

  return wss
}

export { broadcast } from "@/lib/websocket/broadcast"
export { addClient, removeClient, getConnectedCount } from "@/lib/websocket/broadcast"
