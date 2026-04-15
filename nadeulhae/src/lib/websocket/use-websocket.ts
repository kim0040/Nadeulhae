"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface WsMessage {
  type: string
  payload: unknown
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? ""

function getWsUrl() {
  if (WS_BASE) return WS_BASE
  if (typeof window === "undefined") return ""
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${window.location.host}/ws`
}

const RECONNECT_BASE_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000
const NON_RETRIABLE_CLOSE_CODES = new Set([4403])

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectRef = useRef<() => void>(() => {})
  const handlersRef = useRef(new Map<string, Set<(payload: unknown) => void>>())
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)

  const getReconnectDelay = useCallback(() => {
    // Exponential backoff + jitter avoids reconnect stampede after transient outages.
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY)
    return delay + Math.random() * 500
  }, [])

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
      ws.close()
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

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const subscribe = useCallback(
    (type: string, handler: (payload: unknown) => void) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set())
      }
      handlersRef.current.get(type)!.add(handler)
      return () => {
        // Keep handler sets clean; stale listeners are a common source of duplicate UI updates.
        handlersRef.current.get(type)?.delete(handler)
      }
    },
    []
  )

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
