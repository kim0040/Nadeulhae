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

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlersRef = useRef(new Map<string, Set<(payload: unknown) => void>>())
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    const url = getWsUrl()
    if (!url) return

    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data)
        const handlers = handlersRef.current.get(message.type)
        if (handlers) {
          for (const handler of handlers) {
            handler(message.payload)
          }
        }
      } catch {}
    }

    wsRef.current = ws
  }, [])

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
    connect()
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { connected, subscribe }
}