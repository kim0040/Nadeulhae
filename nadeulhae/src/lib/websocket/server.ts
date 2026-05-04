/**
 * WebSocket server module.
 *
 * Bootstraps the WebSocketServer on the `/ws` path, handles origin validation,
 * cookie-based authentication, heartbeat (ping/pong), and code-share session
 * lifecycle (subscribe, unsubscribe, typing indicators, presence broadcast).
 * Delegates client/room registry and message distribution to the broadcast module.
 */

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
import { getCodeShareSessionById } from "@/lib/code-share/repository"

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "nadeulhae_auth"
const CODE_SHARE_ACTOR_COOKIE_NAME = process.env.CODE_SHARE_ACTOR_COOKIE_NAME ?? "nadeulhae_code_share_actor"
const CODE_SHARE_ALIAS_COOKIE_NAME = process.env.CODE_SHARE_ALIAS_COOKIE_NAME ?? "nadeulhae_code_share_alias"
const PING_INTERVAL_MS = 30_000   // How often the server pings clients.
const PING_TIMEOUT_MS = 60_000    // How long to wait for a pong before terminating.
const CODE_SHARE_TYPING_TIMEOUT_MS = 7_500  // Auto-clear typing after inactivity.
const WS_ORIGIN_ALLOWLIST = new Set([
  process.env.APP_BASE_URL,
  "https://nadeulhae.space",
  "https://www.nadeulhae.space",
  "http://localhost:3000",
].filter(Boolean))

/** Tracks a single participant's presence state within a code-share session. */
type CodeSharePresenceActor = {
  actorId: string
  alias: string
  connections: number
  typing: boolean
}

// Per-session presence: outer key = sessionId, inner key = actorId.
const codeSharePresenceBySession = new Map<string, Map<string, CodeSharePresenceActor>>()
// Typing-auto-clear timers keyed by `${sessionId}:${actorId}`.
const codeShareTypingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/** Minimal cookie parser. Extracts a flat key/value map from a Cookie header string. */
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

/**
 * Reject connections from unlisted origins.
 * WebSocket does not use CORS preflight. Origin allowlist is explicit server-side protection.
 */
function validateOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  return WS_ORIGIN_ALLOWLIST.has(origin)
}

/**
 * Authenticate the WebSocket upgrade request via the session auth cookie.
 * Returns the user ID on success, or null if no valid session is found.
 */
async function authenticateWs(req: IncomingMessage): Promise<string | null> {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  const cookies = parseCookie(cookieHeader)
  const token = cookies[AUTH_COOKIE_NAME]
  if (!token) return null

  try {
    const tokenHash = getSessionTokenHash(token)
    const session = await findUserBySessionTokenHash(tokenHash)
    
    if (!session || !session.user) {
      console.warn("[WebSocket] Invalid session token during auth")
      return null
    }
    
    return session.user.id
  } catch (error) {
    console.error("[WebSocket] Auth error:", error instanceof Error ? error.message : error)
    return null
  }
}

/** Extract the code-share actor ID from the dedicated cookie, validating UUID format. */
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

/** Extract the code-share display alias from the dedicated cookie, validating length and charset. */
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

/** Composites a timeout-map key from session ID and actor ID. */
function getTypingTimeoutKey(sessionId: string, actorId: string) {
  return `${sessionId}:${actorId}`
}

/** Cancel and remove a typing timer for the given session/actor pair. */
function clearTypingTimeout(sessionId: string, actorId: string) {
  const key = getTypingTimeoutKey(sessionId, actorId)
  const timeout = codeShareTypingTimeouts.get(key)
  if (timeout) {
    clearTimeout(timeout)
    codeShareTypingTimeouts.delete(key)
  }
}

/** Return the presence map for a session, creating one if it does not exist. */
function getOrCreatePresenceMap(sessionId: string) {
  if (!codeSharePresenceBySession.has(sessionId)) {
    codeSharePresenceBySession.set(sessionId, new Map())
  }
  return codeSharePresenceBySession.get(sessionId)!
}

/**
 * Add or increment a participant in the presence map.
 * Same actor may open multiple tabs; track connection count per actor.
 */
function joinCodeSharePresence(sessionId: string, actorId: string, alias: string) {
  const presenceMap = getOrCreatePresenceMap(sessionId)
  const existing = presenceMap.get(actorId)

  if (existing) {
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

/**
 * Remove or decrement a participant from the presence map.
 * Cleans up the session entry when the last participant leaves.
 */
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

/**
 * Set a participant's typing state.
 * When isTyping is true, a timeout auto-resets the state after inactivity
 * in case the client disconnects abruptly without sending isTyping=false.
 */
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

/**
 * Build the presence payload for a session.
 * `count` tracks active socket connections (not unique actors) to mirror
 * "currently connected tabs".
 */
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

  const count = [...actors.values()].reduce((sum, actor) => sum + Math.max(0, actor.connections), 0)

  return {
    sessionId,
    count,
    participants,
  }
}

/** Broadcast current presence state for a session to all its room subscribers. */
function broadcastCodeSharePresence(sessionId: string) {
  const room = toCodeShareRoomName(sessionId)
  broadcastToRoom(room, "code_share_presence", buildCodeSharePresencePayload(sessionId))
}

/** Start periodic ping and pong timeout monitoring for a single client. */
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

/**
 * Create and configure the WebSocket server.
 *
 * - Validates origin and connection cap on upgrade.
 * - Registers the client immediately (userId null), then patches identity after
 *   optional async authentication resolves.
 * - Manages code-share session subscribe/unsubscribe/typing/saved signals.
 * - Broadcasts presence and user-count updates to connected clients.
 */
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

    ws.on("message", async (data) => {
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
        const session = await getCodeShareSessionById(sessionId).catch(() => null)
        if (!session) {
          return
        }

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

    ws.on("close", (code) => {
      if (code === 4403) {
        console.warn("[WebSocket] Connection rejected: Forbidden origin")
      }
      cleanup()
    })
    ws.on("error", (error) => {
      console.error("[WebSocket] Error:", error.message)
      cleanup()
    })
  })

  return wss
}

export { broadcast } from "@/lib/websocket/broadcast"
export { addClient, removeClient, getConnectedCount } from "@/lib/websocket/broadcast"
