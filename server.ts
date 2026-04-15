import { createServer } from "node:http"
import { parse as parseUrl } from "node:url"
import next from "next"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOST ?? "0.0.0.0"
const port = parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const { createWebSocketServer } = await import("./src/lib/websocket/server")

  const server = createServer(async (req, res) => {
    const parsedUrl = parseUrl(req.url ?? "/", true)
    await handle(req, res, parsedUrl)
  })

  createWebSocketServer(server)

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})