"use client"

/**
 * WebSocket client hook.
 *
 * Provides a React-friendly `useWebSocket()` hook with automatic reconnection
 * (exponential backoff + jitter), heartbeat ping, message subscription, and
 * cleanup on unmount. Designed to pair with the server-side WebSocket module.
 */

import { useEffect, useRef, useCallback, useState } from "react"

/** Inbound message shape after JSON parse. */
interface WsMessage {
  type: string
  payload: unknown
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? ""

/** Resolve the WebSocket URL from the env variable or derive it from window.location. */
function getWsUrl() {
  if (WS_BASE) return WS_BASE
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/ws`
}

const RECONNECT_BASE_DELAY = 1000  // Initial backoff in ms.
const MAX_RECONNECT_DELAY = 30000  // Cap for exponential backoff.
// Close codes that should not trigger reconnection (e.g. origin/authorization rejection).
const NON_RETRIABLE_CLOSE_CODES = new Set([4403])

/**
 * React hook that manages a persistent WebSocket connection.
 *
 * Returns `connected` (boolean state), `subscribe` (register a message-type
 * handler), and `send` (send a message to the server).
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectRef = useRef<() => void>(() => {})
  const handlersRef = useRef(new Map<string, Set<(payload: unknown) => void>>())
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)

  /** Compute the next reconnect delay with exponential backoff and jitter. */
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY)
    return delay + Math.random() * 500
  }, [])

  /** Open a new WebSocket connection and wire up all event handlers. */
  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    const url = getWsUrl()
    if (!url) return

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0
      setConnected(true)

      // Keep browser and server heartbeat in sync to detect half-open sockets fast.
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }))
          } catch {
            if (pingTimerRef.current) {
              clearInterval(pingTimerRef.current)
              pingTimerRef.current = null
            }
          }
        } else if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current)
          pingTimerRef.current = null
        }
      }, 25000)
    }

    ws.onclose = (event) => {
      setConnected(false)
      wsRef.current = null

      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }

      if (!mountedRef.current) return
      // 4403 is authorization/origin policy failure; retrying would loop forever.
      if (NON_RETRIABLE_CLOSE_CODES.has(event.code)) return

      reconnectAttemptsRef.current += 1

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectRef.current()
      }, getReconnectDelay())
    }

    ws.onerror = () => {
      // onerror is always followed by onclose. Explicit close() ensures cleanup
      // but must be guarded because close() on a CONNECTING socket throws in some browsers.
      try {
        ws.close()
      } catch {
        // no-op: onclose handler will still fire and handle reconnection.
      }
    }

    ws.onmessage = (event) => {
      try {
        if (typeof event.data !== "string") {
          return
        }

        const message: WsMessage = JSON.parse(event.data)
        if (message.type === "pong") return
        const handlers = handlersRef.current.get(message.type)
        if (handlers) {
          for (const handler of handlers) {
            handler(message.payload)
          }
        }
      } catch {}
    }

    wsRef.current = ws
  }, [getReconnectDelay])

  // Keep connectRef.current in sync so onclose can always reference the latest connect.
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  /**
   * Register a handler for a specific message type.
   * Returns an unsubscribe function. Stale listeners are automatically cleaned
   * up, and empty handler sets are removed from the map to prevent unbounded
   * key growth.
   */
  const subscribe = useCallback(
    (type: string, handler: (payload: unknown) => void) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set())
      }
      handlersRef.current.get(type)!.add(handler)
      return () => {
        const handlers = handlersRef.current.get(type)
        if (handlers) {
          handlers.delete(handler)
          if (handlers.size === 0) {
            handlersRef.current.delete(type)
          }
        }
      }
    },
    []
  )

  /** Send a typed message to the server. Returns false if the socket is not open. */
  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      ws.send(JSON.stringify({ type, payload }))
      return true
    } catch {
      return false
    }
  }, [])

  // Establish the connection on mount and tear down on unmount.
  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { connected, subscribe, send }
}
