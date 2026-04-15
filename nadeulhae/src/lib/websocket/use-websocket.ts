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

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const handlersRef = useRef(new Map<string, Set<(payload: unknown) => void>>())
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)

  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY)
    return delay + Math.random() * 500
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    const url = getWsUrl()
    if (!url) return

    const ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0
      setConnected(true)
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      if (!mountedRef.current) return

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, getReconnectDelay())
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      try {
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

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }))
        } catch {
          clearInterval(pingInterval)
        }
      } else {
        clearInterval(pingInterval)
      }
    }, 25000)

    ws.addEventListener("close", () => clearInterval(pingInterval))
  }, [getReconnectDelay])

  const subscribe = useCallback(
    (type: string, handler: (payload: unknown) => void) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set())
      }
      handlersRef.current.get(type)!.add(handler)
      return () => {
        handlersRef.current.get(type)?.delete(handler)
      }
    },
    []
  )

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { connected, subscribe }
}