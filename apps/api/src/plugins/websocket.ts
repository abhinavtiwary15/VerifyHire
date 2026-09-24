// apps/api/src/plugins/websocket.ts
import { FastifyInstance } from 'fastify'
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'
import { WebSocketAlert } from '@verifyhire/types'

interface AuthenticatedSocket extends WebSocket {
  sessionId?: string
  userId?: string
  isAlive?: boolean
}

const sessionClients = new Map<string, Set<AuthenticatedSocket>>()

export function setupWebSocket(app: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true })

  app.server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`)
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }

    const token = url.searchParams.get('token')
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!)
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  })

  wss.on('connection', (ws: AuthenticatedSocket, request: IncomingMessage) => {
    const url = new URL(request.url!, `http://${request.headers.host}`)
    const sessionId = url.searchParams.get('sessionId')

    if (sessionId) {
      ws.sessionId = sessionId
      ws.isAlive = true

      if (!sessionClients.has(sessionId)) {
        sessionClients.set(sessionId, new Set())
      }
      sessionClients.get(sessionId)!.add(ws)

      ws.send(JSON.stringify({ type: 'CONNECTED', sessionId, timestamp: new Date().toISOString() }))
    }

    ws.on('pong', () => { ws.isAlive = true })

    ws.on('close', () => {
      if (ws.sessionId && sessionClients.has(ws.sessionId)) {
        sessionClients.get(ws.sessionId)!.delete(ws)
        if (sessionClients.get(ws.sessionId)!.size === 0) {
          sessionClients.delete(ws.sessionId)
        }
      }
    })
  })

  // Heartbeat
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedSocket) => {
      if (!ws.isAlive) { ws.terminate(); return }
      ws.isAlive = false
      ws.ping()
    })
  }, 30000)

  wss.on('close', () => clearInterval(heartbeat))

  app.log.info('WebSocket server initialized at /ws')
}

// Broadcast alert to all clients watching a session
export function broadcastAlert(sessionId: string, alert: WebSocketAlert) {
  const clients = sessionClients.get(sessionId)
  if (!clients || clients.size === 0) return

  const payload = JSON.stringify({ type: 'LIVE_ALERT', ...alert })
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  })
}
