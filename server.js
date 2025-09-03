// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Allow Socket.IO CORS and simple origins (adjust in production)
const io = new Server(server, { cors: { origin: "*" } });

// serve static files from /public
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// In-memory rooms structure (not persistent). OK for small private use.
const rooms = {}; // roomId -> { players: { socketId: {name, secret, ready} } }

function makeRoomId() {
  // 4-digit uppercase alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = '';
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms[id]);
  return id;
}

function roomSummary(roomId) {
  const r = rooms[roomId];
  if (!r) return null;
  const players = Object.entries(r.players).map(([sid, p]) => ({
    socketId: sid,
    name: p.name || 'Anonymous',
    ready: !!p.ready,
    hasSecret: typeof p.secret === 'string' && p.secret.length > 0
  }));
  return { players, roomId };
}

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('createRoom', (displayName, cb) => {
    const roomId = makeRoomId();
    rooms[roomId] = { players: {} };
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { name: displayName || 'Player', secret: '', ready: false };
    cb({ ok: true, roomId, summary: roomSummary(roomId) });
    io.to(roomId).emit('roomUpdate', roomSummary(roomId));
  });

  socket.on('joinRoom', (roomId, displayName, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ ok: false, error: 'Room not found' });
    // limit to 2 players
    if (Object.keys(room.players).length >= 2) return cb({ ok: false, error: 'Room full' });

    socket.join(roomId);
    room.players[socket.id] = { name: displayName || 'Player', secret: '', ready: false };
    cb({ ok: true, roomId, summary: roomSummary(roomId) });
    io.to(roomId).emit('roomUpdate', roomSummary(roomId));
  });

  socket.on('setSecret', (roomId, secret, cb) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return cb && cb({ ok: false });
    room.players[socket.id].secret = String(secret || '').trim();
    // when changing secret, unready user (optional)
    room.players[socket.id].ready = false;
    io.to(roomId).emit('roomUpdate', roomSummary(roomId));
    cb && cb({ ok: true });
  });

  socket.on('setReady', (roomId, ready, cb) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return cb && cb({ ok: false, error: 'Not in room' });
    room.players[socket.id].ready = !!ready;
    io.to(roomId).emit('roomUpdate', roomSummary(roomId));

    // only proceed when exactly 2 players present
    const playerIds = Object.keys(room.players);
    if (playerIds.length === 2) {
      const bothReady = playerIds.every(id => room.players[id].ready);
      const bothHaveSecret = playerIds.every(id => typeof room.players[id].secret === 'string' && room.players[id].secret.length > 0);
      if (bothReady && bothHaveSecret) {
        // start countdown broadcast (server controls reveal time)
        io.to(roomId).emit('startCountdown', 3); // 3 seconds
        // after 3 seconds, reveal both secrets together
        setTimeout(() => {
          // prepare mapping name->secret
          const reveal = playerIds.map(id => ({
            name: room.players[id].name || 'Player',
            secret: room.players[id].secret
          }));
          console.log('Emitting reveal for room', roomId);
          io.to(roomId).emit('reveal', reveal);
          // reset readiness so next round needs re-ready
          playerIds.forEach(id => { if (room.players[id]) room.players[id].ready = false; });
          io.to(roomId).emit('roomUpdate', roomSummary(roomId));
        }, 3000);
      }
    }
    cb && cb({ ok: true });
  });

  // NEW: allow client to request reveal if countdown finished but reveal not received
  socket.on('requestReveal', (roomId, cb) => {
    const room = rooms[roomId];
    if (!room) return cb && cb({ ok: false, error: 'Room not found' });
    const playerIds = Object.keys(room.players);
    if (playerIds.length !== 2) return cb && cb({ ok: false, error: 'Need two players' });
    const bothHaveSecret = playerIds.every(id => typeof room.players[id].secret === 'string' && room.players[id].secret.length > 0);
    if (!bothHaveSecret) return cb && cb({ ok: false, error: 'Secrets missing' });

    const reveal = playerIds.map(id => ({
      name: room.players[id].name || 'Player',
      secret: room.players[id].secret
    }));
    console.log('requestReveal -> emitting reveal for room', roomId);
    io.to(roomId).emit('reveal', reveal);
    // reset readiness
    playerIds.forEach(id => { if (room.players[id]) room.players[id].ready = false; });
    io.to(roomId).emit('roomUpdate', roomSummary(roomId));
    cb && cb({ ok: true });
  });

  socket.on('leaveRoom', (roomId, cb) => {
    const room = rooms[roomId];
    if (room && room.players[socket.id]) {
      delete room.players[socket.id];
      socket.leave(roomId);
      if (Object.keys(room.players).length === 0) delete rooms[roomId];
      else io.to(roomId).emit('roomUpdate', roomSummary(roomId));
    }
    cb && cb({ ok: true });
  });

  socket.on('disconnect', () => {
    // remove from any room
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players && room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(roomId).emit('roomUpdate', roomSummary(roomId));
        if (Object.keys(room.players).length === 0) delete rooms[roomId];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
