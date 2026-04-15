import type { WebSocket } from "ws"

type ClientMeta = { userId: string | null }

const clients = new Map<WebSocket, ClientMeta>()

export function addClient(ws: WebSocket, userId: string | null) {
  clients.set(ws, { userId })
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

export function getConnectedCount() {
  let count = 0
  for (const [ws] of clients) {
    if (ws.readyState === ws.OPEN) {
      count++
    }
  }
  return count
}