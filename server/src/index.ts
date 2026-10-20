import { networkInterfaces } from 'node:os';
import { type WebSocket, WebSocketServer } from 'ws';

import type { ClientMessage, Seat, ServerMessage } from '../../shared/protocol.ts';
import { Room } from './room.ts';

const PORT = Number(process.env.PORT ?? 8787);
/** Phones that stop answering pings (locked, out of Wi-Fi) are dropped after this delay. */
const HEARTBEAT_MS = 10_000;
/** Empty rooms are forgotten after this delay, so a match survives a short network loss. */
const EMPTY_ROOM_TTL_MS = 60 * 60 * 1000;

type Client = { socket: WebSocket; room?: Room; seat?: Seat; alive: boolean };

const rooms = new Map<string, Room>();
const clients = new Set<Client>();
const emptySince = new Map<string, number>();

/** 4 letters, without look-alikes (no I, O), easy to read out loud. */
function newMatchId(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id: string;
  do {
    id = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(id));
  return id;
}

function send(client: Client, message: ServerMessage) {
  if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(message));
}

function broadcast(room: Room) {
  const message: ServerMessage = { type: 'state', state: room.state() };
  for (const client of clients) if (client.room === room) send(client, message);
}

function seatClient(client: Client, room: Room, seat: Seat) {
  client.room = room;
  client.seat = seat;
  emptySince.delete(room.id);
  send(client, { type: 'joined', matchId: room.id, seat });
  broadcast(room);
  console.log(`[${room.id}] player ${seat + 1} joined`);
}

function onMessage(client: Client, raw: string) {
  let message: ClientMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    return send(client, { type: 'error', message: 'Invalid JSON' });
  }

  if (message.type === 'create') {
    const room = new Room(newMatchId());
    rooms.set(room.id, room);
    return seatClient(client, room, room.join(0)!);
  }

  if (message.type === 'join') {
    const room = rooms.get(String(message.matchId).toUpperCase());
    if (!room) return send(client, { type: 'error', message: `Match ${message.matchId} not found` });
    const seat = room.join(message.seat);
    if (seat == null) return send(client, { type: 'error', message: 'This match already has two players' });
    return seatClient(client, room, seat);
  }

  if (!client.room || client.seat == null) return send(client, { type: 'error', message: 'Join a match first' });
  const error = client.room.handle(client.seat, message);
  if (error) return send(client, { type: 'error', message: error });
  console.log(`[${client.room.id}] player ${client.seat + 1}: ${message.type}`, client.room.state().points.length, 'points');
  broadcast(client.room);
}

function onClose(client: Client) {
  clients.delete(client);
  const { room, seat } = client;
  if (!room || seat == null) return;
  room.leave(seat);
  if (room.isEmpty) emptySince.set(room.id, Date.now());
  broadcast(room);
  console.log(`[${room.id}] player ${seat + 1} left`);
}

const server = new WebSocketServer({ port: PORT });

server.on('connection', (socket) => {
  const client: Client = { socket, alive: true };
  clients.add(client);
  socket.on('pong', () => (client.alive = true));
  socket.on('message', (data) => onMessage(client, data.toString()));
  socket.on('close', () => onClose(client));
});

setInterval(() => {
  for (const client of clients) {
    if (!client.alive) {
      client.socket.terminate();
      continue;
    }
    client.alive = false;
    client.socket.ping();
  }
  for (const [id, since] of emptySince) {
    if (Date.now() - since > EMPTY_ROOM_TTL_MS) {
      rooms.delete(id);
      emptySince.delete(id);
    }
  }
}, HEARTBEAT_MS);

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => `ws://${net!.address}:${PORT}`);
console.log(`Témoin relay listening on port ${PORT}`);
for (const address of addresses) console.log(`  ${address}`);
