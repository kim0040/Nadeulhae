import { WebSocket } from "ws"

type ClientMeta = {
  userId: string | null
  actorId: string | null
  actorAlias: string | null
  connectedAt: number
  rooms: Set<string>
}

export type AllowedClientMessage =
  | { type: "ping" }
  | {
    type: "code_share_subscribe" | "code_share_unsubscribe"
    payload: { sessionId: string }
  }
  | {
    type: "code_share_typing"
    payload: { sessionId: string; isTyping: boolean }
  }
  | {
    type: "code_share_saved"
    payload: { sessionId: string; version: number }
  }

const MAX_WS_CONNECTIONS = 500
const MAX_MESSAGE_SIZE = 4096
const MAX_ROOMS_PER_CLIENT = 40
const MAX_ROOM_NAME_LENGTH = 96

const CODE_SHARE_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{10,40}$/

// Process-local registries. For multi-instance deployments, room fan-out must move to external pub/sub.
const clients = new Map<WebSocket, ClientMeta>()
const rooms = new Map<string, Set<WebSocket>>()

function safeSend(ws: WebSocket, data: string): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    return false
  }

  try {
    ws.send(data)
    return true
  } catch {
    return false
  }
}

function isValidRoomName(room: string) {
  return room.length > 0
    && room.length <= MAX_ROOM_NAME_LENGTH
    && !/\s/.test(room)
}

function isValidCodeShareSessionId(value: string) {
  return CODE_SHARE_SESSION_ID_PATTERN.test(value)
}

export function parseAllowedClientMessage(data: string): AllowedClientMessage | null {
  // Hard cap prevents oversized message abuse and accidental giant payloads.
  if (data.length > MAX_MESSAGE_SIZE) {
    return null
  }

  try {
    const parsed = JSON.parse(data) as {
      type?: unknown
      payload?: unknown
    }

    if (parsed.type === "ping") {
      return { type: "ping" }
    }

    if (parsed.type === "code_share_subscribe" || parsed.type === "code_share_unsubscribe") {
      if (!parsed.payload || typeof parsed.payload !== "object") {
        return null
      }

      const sessionId = (parsed.payload as { sessionId?: unknown }).sessionId
      if (typeof sessionId !== "string" || !isValidCodeShareSessionId(sessionId)) {
        return null
      }

      return {
        type: parsed.type,
        payload: { sessionId },
      }
    }

    if (parsed.type === "code_share_typing") {
      if (!parsed.payload || typeof parsed.payload !== "object") {
        return null
      }

      const sessionId = (parsed.payload as { sessionId?: unknown }).sessionId
      const isTyping = (parsed.payload as { isTyping?: unknown }).isTyping
      if (typeof sessionId !== "string" || !isValidCodeShareSessionId(sessionId)) {
        return null
      }

      if (typeof isTyping !== "boolean") {
        return null
      }

      return {
        type: "code_share_typing",
        payload: { sessionId, isTyping },
      }
    }

    if (parsed.type === "code_share_saved") {
      if (!parsed.payload || typeof parsed.payload !== "object") {
        return null
      }

      const sessionId = (parsed.payload as { sessionId?: unknown }).sessionId
      const version = (parsed.payload as { version?: unknown }).version
      if (typeof sessionId !== "string" || !isValidCodeShareSessionId(sessionId)) {
        return null
      }
      if (typeof version !== "number" || !Number.isFinite(version)) {
        return null
      }

      return {
        type: "code_share_saved",
        payload: {
          sessionId,
          version: Math.max(1, Math.floor(version)),
        },
      }
    }

    return null
  } catch {
    return null
  }
}

export function addClient(
  ws: WebSocket,
  userId: string | null,
  actorId: string | null,
  actorAlias: string | null
): boolean {
  if (clients.size >= MAX_WS_CONNECTIONS) {
    return false
  }

  clients.set(ws, {
    userId,
    actorId,
    actorAlias,
    connectedAt: Date.now(),
    rooms: new Set(),
  })
  return true
}

// Update fields on an already-registered client (e.g. after async auth resolves).
export function updateClientMeta(
  ws: WebSocket,
  patch: Partial<Pick<ClientMeta, "userId" | "actorId" | "actorAlias">>
) {
  const meta = clients.get(ws)
  if (!meta) {
    return
  }

  if (patch.userId !== undefined) meta.userId = patch.userId
  if (patch.actorId !== undefined) meta.actorId = patch.actorId
  if (patch.actorAlias !== undefined) meta.actorAlias = patch.actorAlias
}

export function getClientMeta(ws: WebSocket) {
  return clients.get(ws) ?? null
}

export function removeClient(ws: WebSocket) {
  const meta = clients.get(ws)
  if (meta) {
    for (const room of meta.rooms) {
      const roomClients = rooms.get(room)
      if (!roomClients) {
        continue
      }

      roomClients.delete(ws)
      if (roomClients.size === 0) {
        rooms.delete(room)
      }
    }
  }

  clients.delete(ws)
}

export function joinRoom(ws: WebSocket, room: string) {
  if (!isValidRoomName(room)) {
    return false
  }

  const meta = clients.get(ws)
  if (!meta) {
    return false
  }

  if (meta.rooms.has(room)) {
    return true
  }

  // Bound per-client room subscriptions to protect server memory.
  if (meta.rooms.size >= MAX_ROOMS_PER_CLIENT) {
    return false
  }

  meta.rooms.add(room)
  if (!rooms.has(room)) {
    rooms.set(room, new Set())
  }
  rooms.get(room)!.add(ws)
  return true
}

export function leaveRoom(ws: WebSocket, room: string) {
  const meta = clients.get(ws)
  if (meta) {
    meta.rooms.delete(room)
  }

  const roomClients = rooms.get(room)
  if (!roomClients) {
    return
  }

  roomClients.delete(ws)
  if (roomClients.size === 0) {
    rooms.delete(room)
  }
}

export function getRoomConnectionCount(room: string) {
  const roomClients = rooms.get(room)
  if (!roomClients) {
    return 0
  }

  let count = 0
  for (const ws of roomClients) {
    if (ws.readyState === WebSocket.OPEN) {
      count += 1
      continue
    }

    // Opportunistic cleanup of dead sockets while counting.
    roomClients.delete(ws)
    clients.get(ws)?.rooms.delete(room)
  }

  if (roomClients.size === 0) {
    rooms.delete(room)
  }

  return count
}

export function broadcast(type: string, payload: unknown, excludeWs?: WebSocket) {
  const data = JSON.stringify({ type, payload })
  // Snapshot avoids mutation issues if safeSend failure triggers removeClient during iteration.
  const snapshot = [...clients.keys()]
  for (const ws of snapshot) {
    if (ws === excludeWs) continue
    if (!safeSend(ws, data)) {
      removeClient(ws)
    }
  }
}

export function broadcastToRoom(room: string, type: string, payload: unknown, excludeWs?: WebSocket) {
  const roomClients = rooms.get(room)
  if (!roomClients) {
    return
  }

  const data = JSON.stringify({ type, payload })
  // Snapshot avoids mutation issues if safeSend failure triggers removeClient during iteration.
  const snapshot = [...roomClients]
  for (const ws of snapshot) {
    if (ws === excludeWs) {
      continue
    }

    if (!safeSend(ws, data)) {
      removeClient(ws)
    }
  }
}

export function broadcastToUser(userId: string, type: string, payload: unknown) {
  const data = JSON.stringify({ type, payload })
  for (const [ws, meta] of clients) {
    if (meta.userId !== userId) continue
    if (!safeSend(ws, data)) {
      removeClient(ws)
    }
  }
}

export function getConnectedCount() {
  let count = 0
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      count += 1
      continue
    }

    removeClient(ws)
  }
  return count
}

export function isMaxConnectionsReached() {
  return clients.size >= MAX_WS_CONNECTIONS
}
