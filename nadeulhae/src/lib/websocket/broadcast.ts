import type { WebSocket } from "ws"

type ClientMeta = { userId: string | null; connectedAt: number }

const MAX_WS_CONNECTIONS = 500
const MAX_MESSAGE_SIZE = 4096
const ALLOWED_MESSAGE_TYPES = new Set(["ping"])

const clients = new Map<WebSocket, ClientMeta>()

export function addClient(ws: WebSocket, userId: string | null): boolean {
  if (clients.size >= MAX_WS_CONNECTIONS) {
    return false
  }

  clients.set(ws, { userId, connectedAt: Date.now() })
  return true
}

export function removeClient(ws: WebSocket) {
  clients.delete(ws)
}

export function broadcast(type: string, payload: unknown, excludeWs?: WebSocket) {
  const data = JSON.stringify({ type, payload })
  for (const [ws] of clients) {
    if (ws === excludeWs) continue
    if (ws.readyState === ws.OPEN) {
      ws.send(data)
    }
  }
}

export function broadcastToUser(userId: string, type: string, payload: unknown) {
  const data = JSON.stringify({ type, payload })
  for (const [ws, meta] of clients) {
    if (meta.userId !== userId) continue
    if (ws.readyState === ws.OPEN) {
      ws.send(data)
    }
  }
}

export function getConnectedCount() {
  let count = 0
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) {
      count++
    }
  }
  return count
}

export function isMaxConnectionsReached() {
  return clients.size >= MAX_WS_CONNECTIONS
}

export function isAllowedClientMessage(data: string): boolean {
  if (data.length > MAX_MESSAGE_SIZE) return false
  try {
    const parsed = JSON.parse(data)
    if (typeof parsed.type !== "string") return false
    return ALLOWED_MESSAGE_TYPES.has(parsed.type)
  } catch {
    return false
  }
}