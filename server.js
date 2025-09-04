// Enhanced server.js - Advanced features with better performance and logging
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO setup with better CORS handling
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    rooms: Object.keys(rooms).length,
    connectedClients: io.engine.clientsCount
  });
});

// Serve the main app for any route (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Enhanced room management with additional features
const rooms = {};
const playerStats = new Map(); // Track player statistics
const roomHistory = []; // Keep track of completed games

// Utility functions
const utils = {
  generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id;
    let attempts = 0;
    
    do {
      id = '';
      for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      attempts++;
      
      // Prevent infinite loop
      if (attempts > 100) {
        id = Date.now().toString(36).toUpperCase().slice(-4);
        break;
      }
    } while (rooms[id]);
    
    return id;
  },
  
  cleanupExpiredRooms() {
    const now = Date.now();
    const ROOM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      if (room.lastActivity && (now - room.lastActivity) > ROOM_TIMEOUT) {
        console.log(`🧹 Cleaning up expired room: ${roomId}`);
        delete rooms[roomId];
      }
    });
  },
  
  getRoomSummary(roomId) {
    const room = rooms[roomId];
    if (!room) return null;
    
    const players = Object.entries(room.players).map(([socketId, player]) => ({
      socketId,
      name: player.name || 'Anonymous',
      ready: !!player.ready,
      hasSecret: typeof player.secret === 'string' && player.secret.length > 0,
      joinedAt: player.joinedAt
    }));
    
    return {
      roomId,
      players,
      createdAt: room.createdAt,
      gameCount: room.gameCount || 0
    };
  },
  
  logActivity(action, roomId, socketId, details = {}) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${action} - Room: ${roomId} - Socket: ${socketId?.substring(0, 8)}`;
    console.log(logMessage, details);
  },
  
  updatePlayerStats(playerId, action) {
    if (!playerStats.has(playerId)) {
      playerStats.set(playerId, {
        roomsJoined: 0,
        roomsCreated: 0,
        gamesPlayed: 0,
        secretsShared: 0,
        firstSeen: new Date(),
        lastSeen: new Date()
      });
    }
    
    const stats = playerStats.get(playerId);
    stats.lastSeen = new Date();
    
    switch (action) {
      case 'createRoom':
        stats.roomsCreated++;
        break;
      case 'joinRoom':
        stats.roomsJoined++;
        break;
      case 'gameCompleted':
        stats.gamesPlayed++;
        break;
      case 'secretShared':
        stats.secretsShared++;
        break;
    }
    
    playerStats.set(playerId, stats);
  }
};

// Periodic cleanup
setInterval(utils.cleanupExpiredRooms, 5 * 60 * 1000); // Every 5 minutes

// Enhanced Socket.IO event handlers
io.on('connection', (socket) => {
  utils.logActivity('CLIENT_CONNECTED', null, socket.id);
  
  // Send connection confirmation
  socket.emit('connected', {
    id: socket.id,
    timestamp: Date.now(),
    serverInfo: {
      version: '2.0.0',
      features: ['realtime-sync', 'sound-effects', 'statistics', 'auto-cleanup']
    }
  });
  
  // Create Room
  socket.on('createRoom', (displayName, callback) => {
    try {
      const roomId = utils.generateRoomId();
      const now = Date.now();
      
      // Create new room
      rooms[roomId] = {
        players: {},
        createdAt: now,
        lastActivity: now,
        gameCount: 0,
        history: []
      };
      
      // Add player to room
      socket.join(roomId);
      rooms[roomId].players[socket.id] = {
        name: displayName || 'Host',
        secret: '',
        ready: false,
        joinedAt: now,
        role: 'host'
      };
      
      utils.logActivity('ROOM_CREATED', roomId, socket.id, { displayName });
      utils.updatePlayerStats(socket.id, 'createRoom');
      
      const summary = utils.getRoomSummary(roomId);
      callback({ ok: true, roomId, summary });
      
      // Broadcast room update
      io.to(roomId).emit('roomUpdate', summary);
      
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ ok: false, error: 'Failed to create room' });
    }
  });
  
  // Join Room
  socket.on('joinRoom', (roomId, displayName, callback) => {
    try {
      const room = rooms[roomId];
      
      if (!room) {
        return callback({ ok: false, error: 'Room not found' });
      }
      
      const playerCount = Object.keys(room.players).length;
      if (playerCount >= 2) {
        return callback({ ok: false, error: 'Room is full' });
      }
      
      // Join room
      socket.join(roomId);
      room.players[socket.id] = {
        name: displayName || 'Guest',
        secret: '',
        ready: false,
        joinedAt: Date.now(),
        role: 'guest'
      };
      
      room.lastActivity = Date.now();
      
      utils.logActivity('PLAYER_JOINED', roomId, socket.id, { displayName });
      utils.updatePlayerStats(socket.id, 'joinRoom');
      
      const summary = utils.getRoomSummary(roomId);
      callback({ ok: true, roomId, summary });
      
      // Broadcast room update
      io.to(roomId).emit('roomUpdate', summary);
      
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ ok: false, error: 'Failed to join room' });
    }
  });
  
  // Set Secret
  socket.on('setSecret', (roomId, secret, callback) => {
    try {
      const room = rooms[roomId];
      
      if (!room || !room.players[socket.id]) {
        return callback({ ok: false, error: 'Not in room' });
      }
      
      // Update secret and reset ready state
      room.players[socket.id].secret = String(secret || '').trim();
      room.players[socket.id].ready = false;
      room.lastActivity = Date.now();
      
      utils.logActivity('SECRET_SET', roomId, socket.id);
      utils.updatePlayerStats(socket.id, 'secretShared');
      
      const summary = utils.getRoomSummary(roomId);
      io.to(roomId).emit('roomUpdate', summary);
      
      callback({ ok: true });
      
    } catch (error) {
      console.error('Error setting secret:', error);
      callback({ ok: false, error: 'Failed to set secret' });
    }
  });
  
  // Set Ready
  socket.on('setReady', (roomId, ready, callback) => {
    try {
      const room = rooms[roomId];
      
      if (!room || !room.players[socket.id]) {
        return callback({ ok: false, error: 'Not in room' });
      }
      
      room.players[socket.id].ready = !!ready;
      room.lastActivity = Date.now();
      
      utils.logActivity('READY_TOGGLED', roomId, socket.id, { ready });
      
      const summary = utils.getRoomSummary(roomId);
      io.to(roomId).emit('roomUpdate', summary);
      
      // Check if both players are ready
      const playerIds = Object.keys(room.players);
      if (playerIds.length === 2) {
        const bothReady = playerIds.every(id => room.players[id].ready);
        const bothHaveSecrets = playerIds.every(id => 
          typeof room.players[id].secret === 'string' && 
          room.players[id].secret.length > 0
        );
        
        if (bothReady && bothHaveSecrets) {
          utils.logActivity('COUNTDOWN_STARTED', roomId, socket.id);
          
          // Start countdown
          io.to(roomId).emit('startCountdown', 3);
          
          // Schedule reveal
          setTimeout(() => {
            const reveal = playerIds.map(id => ({
              name: room.players[id].name,
              secret: room.players[id].secret
            }));
            
            // Store game result in history
            room.history.push({
              timestamp: Date.now(),
              players: reveal
            });
            room.gameCount = (room.gameCount || 0) + 1;
            
            utils.logActivity('GAME_REVEALED', roomId, socket.id, { gameCount: room.gameCount });
            
            // Update player stats
            playerIds.forEach(id => {
              utils.updatePlayerStats(id, 'gameCompleted');
            });
            
            io.to(roomId).emit('reveal', reveal);
            
            // Reset ready states
            playerIds.forEach(id => {
              if (room.players[id]) {
                room.players[id].ready = false;
              }
            });
            
            // Send updated room state
            const updatedSummary = utils.getRoomSummary(roomId);
            io.to(roomId).emit('roomUpdate', updatedSummary);
            
          }, 3000);
        }
      }
      
      callback({ ok: true });
      
    } catch (error) {
      console.error('Error setting ready:', error);
      callback({ ok: false, error: 'Failed to set ready' });
    }
  });
  
  // Request Reveal (fallback)
  socket.on('requestReveal', (roomId, callback) => {
    try {
      const room = rooms[roomId];
      
      if (!room) {
        return callback({ ok: false, error: 'Room not found' });
      }
      
      const playerIds = Object.keys(room.players);
      if (playerIds.length !== 2) {
        return callback({ ok: false, error: 'Need two players' });
      }
      
      const bothHaveSecrets = playerIds.every(id => 
        typeof room.players[id].secret === 'string' && 
        room.players[id].secret.length > 0
      );
      
      if (!bothHaveSecrets) {
        return callback({ ok: false, error: 'Both players need secrets' });
      }
      
      const reveal = playerIds.map(id => ({
        name: room.players[id].name,
        secret: room.players[id].secret
      }));
      
      utils.logActivity('REVEAL_REQUESTED', roomId, socket.id);
      
      io.to(roomId).emit('reveal', reveal);
      
      // Reset ready states
      playerIds.forEach(id => {
        if (room.players[id]) {
          room.players[id].ready = false;
        }
      });
      
      const updatedSummary = utils.getRoomSummary(roomId);
      io.to(roomId).emit('roomUpdate', updatedSummary);
      
      callback({ ok: true });
      
    } catch (error) {
      console.error('Error requesting reveal:', error);
      callback({ ok: false, error: 'Failed to request reveal' });
    }
  });
  
  // Leave Room
  socket.on('leaveRoom', (roomId, callback) => {
    try {
      const room = rooms[roomId];
      
      if (room && room.players[socket.id]) {
        utils.logActivity('PLAYER_LEFT', roomId, socket.id);
        
        delete room.players[socket.id];
        socket.leave(roomId);
        
        // Clean up empty rooms
        if (Object.keys(room.players).length === 0) {
          utils.logActivity('ROOM_DELETED', roomId, socket.id);
          delete rooms[roomId];
        } else {
          room.lastActivity = Date.now();
          const summary = utils.getRoomSummary(roomId);
          io.to(roomId).emit('roomUpdate', summary);
        }
      }
      
      if (callback) callback({ ok: true });
      
    } catch (error) {
      console.error('Error leaving room:', error);
      if (callback) callback({ ok: false, error: 'Failed to leave room' });
    }
  });
  
  // Get Room Stats (optional feature)
  socket.on('getRoomStats', (roomId, callback) => {
    try {
      const room = rooms[roomId];
      
      if (!room) {
        return callback({ ok: false, error: 'Room not found' });
      }
      
      const stats = {
        createdAt: room.createdAt,
        gameCount: room.gameCount || 0,
        totalPlayers: Object.keys(room.players).length,
        history: room.history.slice(-5) // Last 5 games
      };
      
      callback({ ok: true, stats });
      
    } catch (error) {
      console.error('Error getting room stats:', error);
      callback({ ok: false, error: 'Failed to get stats' });
    }
  });
  
  // Get Server Stats (for admin/debugging)
  socket.on('getServerStats', (callback) => {
    try {
      const stats = {
        totalRooms: Object.keys(rooms).length,
        activeConnections: io.engine.clientsCount,
        totalPlayers: playerStats.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        roomsDetail: Object.keys(rooms).map(roomId => ({
          roomId,
          playerCount: Object.keys(rooms[roomId].players).length,
          gameCount: rooms[roomId].gameCount || 0,
          createdAt: rooms[roomId].createdAt,
          lastActivity: rooms[roomId].lastActivity
        }))
      };
      
      callback({ ok: true, stats });
      
    } catch (error) {
      console.error('Error getting server stats:', error);
      callback({ ok: false, error: 'Failed to get server stats' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    utils.logActivity('CLIENT_DISCONNECTED', null, socket.id, { reason });
    
    // Remove player from all rooms
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      if (room && room.players && room.players[socket.id]) {
        delete room.players[socket.id];
        room.lastActivity = Date.now();
        
        // Clean up empty rooms
        if (Object.keys(room.players).length === 0) {
          utils.logActivity('ROOM_AUTO_DELETED', roomId, socket.id);
          delete rooms[roomId];
        } else {
          // Notify remaining players
          const summary = utils.getRoomSummary(roomId);
          io.to(roomId).emit('roomUpdate', summary);
          io.to(roomId).emit('playerDisconnected', {
            message: 'A player has disconnected',
            remainingPlayers: Object.keys(room.players).length
          });
        }
      }
    });
  });
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
    utils.logActivity('SOCKET_ERROR', null, socket.id, { error: error.message });
  });
});

// Enhanced error handling
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', {
    message: err.message,
    description: err.description,
    context: err.context,
    type: err.type
  });
});

// Periodic server statistics logging
setInterval(() => {
  const stats = {
    timestamp: new Date().toISOString(),
    rooms: Object.keys(rooms).length,
    connections: io.engine.clientsCount,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    uptime: Math.round(process.uptime()) + 's'
  };
  
  console.log('📊 Server Stats:', stats);
}, 10 * 60 * 1000); // Every 10 minutes

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  // Notify all connected clients
  io.emit('serverShutdown', {
    message: 'Server is restarting, please refresh the page in a moment.',
    timestamp: Date.now()
  });
  
  // Close server gracefully
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forcing server close');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  process.exit(0);
});

// Unhandled error logging
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
server.listen(PORT, () => {
  console.log(`
🎓 Dream University Reveal Server - Enhanced Edition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Server running on port ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'development'}
📊 Features: Real-time sync, Statistics, Auto-cleanup
⚡ Socket.IO: Enabled with WebSocket & Polling
🛡️  CORS: ${process.env.NODE_ENV === 'production' ? 'Production mode' : 'Development mode'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  
  // Initial cleanup
  utils.cleanupExpiredRooms();
});