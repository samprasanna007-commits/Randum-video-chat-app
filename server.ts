import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientWsEvent, ReportReason, ServerWsEvent } from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface ConnectedClient {
  clientId: string;
  ws: WebSocket;
  isAlive: boolean;
  registered: boolean;
  ageConfirmed: boolean;
  indiaConfirmed: boolean;
  countryCode: string;
  blockedIds: Set<string>;
  currentRoomId: string | null;
  inQueue: boolean;
  lastPartnerId: string | null;
}

interface ActiveRoom {
  roomId: string;
  userA: string;
  userB: string;
  createdAt: number;
}

interface ModerationReport {
  id: string;
  reporterId: string;
  targetClientId: string;
  roomId?: string;
  reason: ReportReason;
  details: string;
  createdAt: string;
}

const clients = new Map<string, ConnectedClient>();
const socketToClientId = new Map<WebSocket, string>();
const waitingQueue: string[] = [];
const rooms = new Map<string, ActiveRoom>();
const moderationReports: ModerationReport[] = [];
const suspendedClientIds = new Set<string>();
const reportCountsByTarget = new Map<string, number>();

function detectCountryFromHeaders(headers: http.IncomingHttpHeaders): {
  countryCode: string;
  source: 'header' | 'development-fallback';
} {
  const raw =
    headers['cf-ipcountry'] ||
    headers['x-appengine-country'] ||
    headers['x-vercel-ip-country'] ||
    headers['x-country-code'];

  const headerValue = Array.isArray(raw) ? raw[0] : raw;
  if (typeof headerValue === 'string' && headerValue.trim().length >= 2) {
    const code = headerValue.trim().toUpperCase();
    if (code !== 'XX' && code !== 'UNKNOWN') {
      return { countryCode: code, source: 'header' };
    }
  }
  return { countryCode: 'IN', source: 'development-fallback' };
}

function isRegionAllowed(countryCode: string, source: 'header' | 'development-fallback'): boolean {
  if (countryCode === 'IN') return true;
  // In strict production behind geo-IP headers, restrict to India only.
  // In preview/dev environments where cloud proxy headers reflect test server location,
  // allow entry after explicit India-only user attestation.
  return !IS_PROD || source === 'development-fallback';
}

function sendEvent(ws: WebSocket, event: ServerWsEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function getPresencePayload(): ServerWsEvent {
  let registeredCount = 0;
  for (const client of clients.values()) {
    if (client.registered) {
      registeredCount += 1;
    }
  }
  return {
    type: 'presence:update',
    onlineCount: Math.max(registeredCount, clients.size),
    waitingCount: waitingQueue.length,
    activeCallsCount: rooms.size,
    regionScope: 'IN',
  };
}

function broadcastPresence(): void {
  const payload = JSON.stringify(getPresencePayload());
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function removeFromQueue(clientId: string): void {
  const idx = waitingQueue.indexOf(clientId);
  if (idx !== -1) {
    waitingQueue.splice(idx, 1);
  }
  const client = clients.get(clientId);
  if (client) {
    client.inQueue = false;
  }
}

function teardownRoom(
  roomId: string,
  initiatorId: string | null,
  reasonForPeer: 'partner-left' | 'partner-next' | 'blocked' | 'reported',
  reasonForInitiator?: 'ended-by-you' | 'blocked' | 'reported'
): void {
  const room = rooms.get(roomId);
  if (!room) return;
  rooms.delete(roomId);

  const clientA = clients.get(room.userA);
  const clientB = clients.get(room.userB);

  if (clientA && clientA.currentRoomId === roomId) {
    clientA.currentRoomId = null;
    clientA.lastPartnerId = room.userB;
  }
  if (clientB && clientB.currentRoomId === roomId) {
    clientB.currentRoomId = null;
    clientB.lastPartnerId = room.userA;
  }

  if (clientA) {
    if (initiatorId && clientA.clientId === initiatorId) {
      if (reasonForInitiator) {
        sendEvent(clientA.ws, {
          type: 'match:ended',
          roomId,
          reason: reasonForInitiator,
        });
      }
    } else {
      sendEvent(clientA.ws, {
        type: 'match:ended',
        roomId,
        reason: reasonForPeer,
      });
    }
  }

  if (clientB) {
    if (initiatorId && clientB.clientId === initiatorId) {
      if (reasonForInitiator) {
        sendEvent(clientB.ws, {
          type: 'match:ended',
          roomId,
          reason: reasonForInitiator,
        });
      }
    } else {
      sendEvent(clientB.ws, {
        type: 'match:ended',
        roomId,
        reason: reasonForPeer,
      });
    }
  }
}

function canMatchClients(a: ConnectedClient, b: ConnectedClient): boolean {
  if (a.clientId === b.clientId) return false;
  if (!a.registered || !b.registered) return false;
  if (!a.ageConfirmed || !b.ageConfirmed) return false;
  if (!a.indiaConfirmed || !b.indiaConfirmed) return false;
  if (suspendedClientIds.has(a.clientId) || suspendedClientIds.has(b.clientId)) return false;
  if (a.blockedIds.has(b.clientId) || b.blockedIds.has(a.clientId)) return false;
  if (a.currentRoomId || b.currentRoomId) return false;
  if (a.ws.readyState !== WebSocket.OPEN || b.ws.readyState !== WebSocket.OPEN) return false;
  return true;
}

function tryMatchmaking(): void {
  // Prune invalid entries from waitingQueue first
  for (let i = waitingQueue.length - 1; i >= 0; i--) {
    const id = waitingQueue[i];
    const c = clients.get(id);
    if (!c || !c.inQueue || c.currentRoomId || c.ws.readyState !== WebSocket.OPEN) {
      waitingQueue.splice(i, 1);
      if (c) c.inQueue = false;
    }
  }

  if (waitingQueue.length < 2) {
    broadcastPresence();
    return;
  }

  let matchedAny = true;
  while (matchedAny && waitingQueue.length >= 2) {
    matchedAny = false;
    const firstId = waitingQueue[0];
    const firstClient = clients.get(firstId);
    if (!firstClient) {
      waitingQueue.shift();
      matchedAny = true;
      continue;
    }

    // Collect all eligible candidates in India (random across all genders)
    const candidateIndices: number[] = [];
    for (let j = 1; j < waitingQueue.length; j++) {
      const candidate = clients.get(waitingQueue[j]);
      if (candidate && canMatchClients(firstClient, candidate)) {
        candidateIndices.push(j);
      }
    }

    if (candidateIndices.length === 0) {
      break;
    }

    // Prefer someone other than the immediate previous partner if alternatives exist
    const freshCandidates = candidateIndices.filter((idx) => {
      const candidateId = waitingQueue[idx];
      return firstClient.lastPartnerId !== candidateId;
    });
    const pool = freshCandidates.length > 0 ? freshCandidates : candidateIndices;
    const chosenQueueIdx = pool[Math.floor(Math.random() * pool.length)];
    const partnerId = waitingQueue[chosenQueueIdx];
    const partnerClient = clients.get(partnerId);

    if (!partnerClient) {
      continue;
    }

    // Remove both from queue (higher index first)
    waitingQueue.splice(chosenQueueIdx, 1);
    waitingQueue.shift();

    firstClient.inQueue = false;
    partnerClient.inQueue = false;

    const roomId = crypto.randomUUID();
    rooms.set(roomId, {
      roomId,
      userA: firstClient.clientId,
      userB: partnerClient.clientId,
      createdAt: Date.now(),
    });

    firstClient.currentRoomId = roomId;
    partnerClient.currentRoomId = roomId;

    const firstIsCaller = Math.random() < 0.5;
    sendEvent(firstClient.ws, {
      type: 'match:found',
      roomId,
      peerId: partnerClient.clientId,
      role: firstIsCaller ? 'caller' : 'callee',
      region: 'IN',
    });
    sendEvent(partnerClient.ws, {
      type: 'match:found',
      roomId,
      peerId: firstClient.clientId,
      role: firstIsCaller ? 'callee' : 'caller',
      region: 'IN',
    });

    matchedAny = true;
  }

  broadcastPresence();
}

function getPeerInRoom(roomId: string, senderClientId: string): ConnectedClient | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.userA === senderClientId) return clients.get(room.userB) ?? null;
  if (room.userB === senderClientId) return clients.get(room.userA) ?? null;
  return null;
}

function recordModerationReport(
  reporterId: string,
  targetClientId: string,
  reason: ReportReason,
  details: string,
  roomId?: string
): void {
  const report: ModerationReport = {
    id: crypto.randomUUID(),
    reporterId,
    targetClientId,
    roomId,
    reason,
    details: details.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  moderationReports.push(report);
  if (moderationReports.length > 500) {
    moderationReports.shift();
  }

  const nextCount = (reportCountsByTarget.get(targetClientId) ?? 0) + 1;
  reportCountsByTarget.set(targetClientId, nextCount);
  if (nextCount >= 3) {
    suspendedClientIds.add(targetClientId);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'Delulu',
      regionScope: 'IN',
      onlineCount: clients.size,
      waitingCount: waitingQueue.length,
      activeCallsCount: rooms.size,
    });
  });

  app.get('/api/session/region', (req, res) => {
    const { countryCode, source } = detectCountryFromHeaders(req.headers);
    const allowed = isRegionAllowed(countryCode, source);
    res.json({
      allowed,
      countryCode,
      source,
      message: allowed
        ? 'India-only session eligible after 18+ adult confirmation.'
        : `Delulu is restricted to consenting adults (18+) located in India. Detected region: ${countryCode}.`,
    });
  });

  app.post('/api/moderation/report', (req, res) => {
    const { reporterId, targetClientId, roomId, reason, details } = req.body ?? {};
    if (!reporterId || !targetClientId || !reason) {
      res.status(400).json({ error: 'Missing required report fields.' });
      return;
    }
    recordModerationReport(
      String(reporterId),
      String(targetClientId),
      reason as ReportReason,
      typeof details === 'string' ? details : '',
      typeof roomId === 'string' ? roomId : undefined
    );
    res.json({ ok: true, message: 'Report logged and partner blocked for your session.' });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const { countryCode, source } = detectCountryFromHeaders(req.headers);
    const tempId = `anon-${crypto.randomUUID()}`;

    const initialClient: ConnectedClient = {
      clientId: tempId,
      ws,
      isAlive: true,
      registered: false,
      ageConfirmed: false,
      indiaConfirmed: false,
      countryCode,
      blockedIds: new Set<string>(),
      currentRoomId: null,
      inQueue: false,
      lastPartnerId: null,
    };

    clients.set(tempId, initialClient);
    socketToClientId.set(ws, tempId);
    sendEvent(ws, getPresencePayload());

    ws.on('pong', () => {
      const currentId = socketToClientId.get(ws);
      const client = currentId ? clients.get(currentId) : undefined;
      if (client) {
        client.isAlive = true;
      }
    });

    ws.on('message', (raw) => {
      let event: ClientWsEvent;
      try {
        event = JSON.parse(raw.toString()) as ClientWsEvent;
      } catch {
        sendEvent(ws, { type: 'error', message: 'Invalid WebSocket message format.' });
        return;
      }

      const activeId = socketToClientId.get(ws);
      if (!activeId) return;
      const client = clients.get(activeId);
      if (!client) return;

      switch (event.type) {
        case 'session:register': {
          if (!event.ageConfirmed) {
            sendEvent(ws, {
              type: 'session:rejected',
              code: 'AGE_REQUIRED',
              reason: 'You must be 18 years or older to use Delulu.',
            });
            return;
          }
          if (!event.indiaConfirmed || !isRegionAllowed(client.countryCode, source)) {
            sendEvent(ws, {
              type: 'session:rejected',
              code: 'INDIA_ONLY',
              reason: 'Delulu is exclusively available to adults located within India.',
            });
            return;
          }

          const requestedId =
            typeof event.clientId === 'string' && event.clientId.trim().length >= 8
              ? event.clientId.trim().slice(0, 64)
              : client.clientId;

          if (requestedId !== client.clientId) {
            // If an existing stale socket holds this ID, clean it up cleanly
            const existing = clients.get(requestedId);
            if (existing && existing.ws !== ws) {
              removeFromQueue(existing.clientId);
              if (existing.currentRoomId) {
                teardownRoom(existing.currentRoomId, existing.clientId, 'partner-left');
              }
              existing.ws.terminate();
              clients.delete(requestedId);
            }
            clients.delete(client.clientId);
            client.clientId = requestedId;
            clients.set(requestedId, client);
            socketToClientId.set(ws, requestedId);
          }

          client.registered = true;
          client.ageConfirmed = true;
          client.indiaConfirmed = true;
          client.blockedIds = new Set(
            Array.isArray(event.blockedIds) ? event.blockedIds.map(String) : []
          );

          sendEvent(ws, {
            type: 'session:ready',
            clientId: client.clientId,
            regionAllowed: true,
            countryCode: client.countryCode,
          });
          broadcastPresence();
          break;
        }

        case 'queue:join': {
          if (!client.registered || !client.ageConfirmed || !client.indiaConfirmed) {
            sendEvent(ws, {
              type: 'session:rejected',
              code: 'AGE_REQUIRED',
              reason: 'Complete 18+ and India-only verification before starting video chat.',
            });
            return;
          }
          if (suspendedClientIds.has(client.clientId)) {
            sendEvent(ws, {
              type: 'error',
              message: 'Your session has been restricted due to multiple safety reports.',
            });
            return;
          }
          if (client.currentRoomId) {
            teardownRoom(client.currentRoomId, client.clientId, 'partner-left');
          }
          if (!client.inQueue) {
            client.inQueue = true;
            waitingQueue.push(client.clientId);
          }
          sendEvent(ws, {
            type: 'queue:searching',
            waitingCount: waitingQueue.length,
          });
          tryMatchmaking();
          break;
        }

        case 'queue:leave': {
          removeFromQueue(client.clientId);
          broadcastPresence();
          break;
        }

        case 'call:next': {
          if (!client.registered) return;
          if (client.currentRoomId) {
            teardownRoom(client.currentRoomId, client.clientId, 'partner-next', 'ended-by-you');
          }
          if (!client.inQueue) {
            client.inQueue = true;
            waitingQueue.push(client.clientId);
          }
          sendEvent(ws, {
            type: 'queue:searching',
            waitingCount: waitingQueue.length,
          });
          tryMatchmaking();
          break;
        }

        case 'call:end': {
          removeFromQueue(client.clientId);
          if (client.currentRoomId) {
            teardownRoom(client.currentRoomId, client.clientId, 'partner-left', 'ended-by-you');
          }
          broadcastPresence();
          break;
        }

        case 'rtc:offer': {
          const peer = getPeerInRoom(event.roomId, client.clientId);
          if (peer) {
            sendEvent(peer.ws, {
              type: 'rtc:offer',
              roomId: event.roomId,
              fromPeerId: client.clientId,
              sdp: event.sdp,
            });
          }
          break;
        }

        case 'rtc:answer': {
          const peer = getPeerInRoom(event.roomId, client.clientId);
          if (peer) {
            sendEvent(peer.ws, {
              type: 'rtc:answer',
              roomId: event.roomId,
              fromPeerId: client.clientId,
              sdp: event.sdp,
            });
          }
          break;
        }

        case 'rtc:ice-candidate': {
          const peer = getPeerInRoom(event.roomId, client.clientId);
          if (peer) {
            sendEvent(peer.ws, {
              type: 'rtc:ice-candidate',
              roomId: event.roomId,
              fromPeerId: client.clientId,
              candidate: event.candidate,
            });
          }
          break;
        }

        case 'chat:send': {
          const peer = getPeerInRoom(event.roomId, client.clientId);
          const trimmed = typeof event.text === 'string' ? event.text.trim().slice(0, 1000) : '';
          if (peer && trimmed.length > 0) {
            sendEvent(peer.ws, {
              type: 'chat:message',
              roomId: event.roomId,
              id: event.id,
              fromPeerId: client.clientId,
              text: trimmed,
              timestamp: event.timestamp || new Date().toISOString(),
            });
          }
          break;
        }

        case 'peer:block': {
          const targetId = String(event.targetClientId || '');
          if (targetId) {
            client.blockedIds.add(targetId);
          }
          if (client.currentRoomId) {
            const room = rooms.get(client.currentRoomId);
            if (room && (room.userA === targetId || room.userB === targetId)) {
              teardownRoom(client.currentRoomId, client.clientId, 'partner-left', 'blocked');
            }
          }
          sendEvent(ws, {
            type: 'safety:ack',
            action: 'blocked',
            message: 'User blocked. You will not be matched with this user again.',
          });
          broadcastPresence();
          break;
        }

        case 'peer:report': {
          const targetId = String(event.targetClientId || '');
          if (targetId) {
            client.blockedIds.add(targetId);
            recordModerationReport(
              client.clientId,
              targetId,
              event.reason,
              event.details || '',
              event.roomId
            );
          }
          if (client.currentRoomId) {
            const room = rooms.get(client.currentRoomId);
            if (room && (!targetId || room.userA === targetId || room.userB === targetId)) {
              teardownRoom(client.currentRoomId, client.clientId, 'partner-left', 'reported');
            }
          }
          sendEvent(ws, {
            type: 'safety:ack',
            action: 'reported',
            message: 'Report submitted and user blocked from future matches.',
          });
          broadcastPresence();
          break;
        }
      }
    });

    ws.on('close', () => {
      const closingId = socketToClientId.get(ws);
      socketToClientId.delete(ws);
      if (!closingId) return;

      const closingClient = clients.get(closingId);
      if (!closingClient) return;

      removeFromQueue(closingId);
      if (closingClient.currentRoomId) {
        teardownRoom(closingClient.currentRoomId, closingId, 'partner-left');
      }
      clients.delete(closingId);
      broadcastPresence();
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const [id, client] of clients.entries()) {
      if (!client.isAlive) {
        removeFromQueue(id);
        if (client.currentRoomId) {
          teardownRoom(client.currentRoomId, id, 'partner-left');
        }
        client.ws.terminate();
        clients.delete(id);
        socketToClientId.delete(client.ws);
        continue;
      }
      client.isAlive = false;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Delulu server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Delulu server:', err);
  process.exit(1);
});
