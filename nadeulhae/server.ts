import { createServer } from "node:http"
import { parse as parseUrl } from "node:url"
import next from "next"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOST ?? "0.0.0.0"
const port = parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Process-level safety net: log (don't silently crash) on stray errors so a
// single unhandled rejection can't take the whole server down without a trace.
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason)
})
process.on("uncaughtException", (error) => {
  console.error("[server] Uncaught exception:", error)
})

app
  .prepare()
  .then(async () => {
    const { createWebSocketServer } = await import("./src/lib/websocket/server")
    const { startJeonjuBriefingScheduler } = await import("./src/lib/jeonju-scheduler")

    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parseUrl(req.url ?? "/", true)
        await handle(req, res, parsedUrl)
      } catch (error) {
        console.error("[server] Request handler error:", error)
        if (!res.headersSent) {
          res.statusCode = 500
          res.end("Internal Server Error")
        }
      }
    })

    const wss = createWebSocketServer(server)

    server.listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      startJeonjuBriefingScheduler()
    })

    // Graceful shutdown: stop accepting new connections, close the WebSocket
    // server, drain the DB pool, then exit. Ensures deploys/restarts release
    // resources cleanly instead of severing everything abruptly.
    let shuttingDown = false
    const shutdown = async (signal: string) => {
      if (shuttingDown) return
      shuttingDown = true
      console.log(`[server] ${signal} received — shutting down gracefully...`)

      const forceExit = setTimeout(() => {
        console.error("[server] Graceful shutdown timed out — forcing exit.")
        process.exit(1)
      }, 10_000)
      forceExit.unref()

      try {
        wss.close()
        await new Promise<void>((resolve) => server.close(() => resolve()))
        const { closeDbPool } = await import("./src/lib/db")
        await closeDbPool()
      } catch (error) {
        console.error("[server] Error during shutdown:", error)
      } finally {
        clearTimeout(forceExit)
        process.exit(0)
      }
    }

    process.on("SIGTERM", () => void shutdown("SIGTERM"))
    process.on("SIGINT", () => void shutdown("SIGINT"))
  })
  .catch((error) => {
    console.error("[server] Failed to start:", error)
    process.exit(1)
  })