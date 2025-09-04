// Enhanced client.js - Modern UI/UX with advanced features
const socket = io();

// State Management
let gameState = {
  currentScreen: 'welcome',
  currentRoom: null,
  playerName: '',
  mySecret: '',
  myReady: false,
  myId: null,
  showMySecret: false,
  isSecretHidden: true,
  players: [],
  connectionStatus: 'connecting'
};

// DOM Elements
const elements = {
  // Screens
  welcomeScreen: document.getElementById('welcome'),
  joinScreen: document.getElementById('joinScreen'),
  gameRoom: document.getElementById('gameRoom'),
  countdownScreen: document.getElementById('countdownScreen'),
  revealScreen: document.getElementById('revealScreen'),
  
  // Navigation
  connectionStatus: document.getElementById('connectionStatus'),
  
  // Welcome Screen
  playerNameInput: document.getElementById('playerName'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  
  // Join Screen
  backToWelcome: document.getElementById('backToWelcome'),
  roomCodeInput: document.getElementById('roomCodeInput'),
  joinRoomSubmit: document.getElementById('joinRoomSubmit'),
  
  // Game Room
  currentRoomCode: document.getElementById('currentRoomCode'),
  copyRoomCode: document.getElementById('copyRoomCode'),
  shareRoom: document.getElementById('shareRoom'),
  leaveRoom: document.getElementById('leaveRoom'),
  playersGrid: document.getElementById('playersGrid'),
  secretSection: document.getElementById('secretSection'),
  secretInput: document.getElementById('secretInput'),
  toggleSecretVisibility: document.getElementById('toggleSecretVisibility'),
  charCount: document.getElementById('charCount'),
  saveSecret: document.getElementById('saveSecret'),
  readyToggle: document.getElementById('readyToggle'),
  mySecretDisplay: document.getElementById('mySecretDisplay'),
  mySecretText: document.getElementById('mySecretText'),
  editSecret: document.getElementById('editSecret'),
  togglePreview: document.getElementById('togglePreview'),
  waitingState: document.getElementById('waitingState'),
  
  // Countdown
  countdownNumber: document.getElementById('countdownNumber'),
  
  // Reveal
  revealCards: document.getElementById('revealCards'),
  playAgain: document.getElementById('playAgain'),
  shareResults: document.getElementById('shareResults'),
  
  // Toast Container
  toastContainer: document.getElementById('toastContainer'),
  loadingOverlay: document.getElementById('loadingOverlay')
};

// Utility Functions
const utils = {
  // Show toast notification
  showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = this.getToastIcon(type);
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${message}</div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  },
  
  getToastIcon(type) {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  },
  
  // Copy to clipboard
  async copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(successMessage, 'success');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast(successMessage, 'success');
    }
  },
  
  // Generate avatar letter
  getAvatarLetter(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
  },
  
  // Mask secret text
  maskSecret(text) {
    if (!text) return '—';
    return '•'.repeat(Math.min(text.length, 20));
  },
  
  // Share URL
  async shareRoom(roomCode) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    const shareData = {
      title: 'Join my Dream University game!',
      text: `Join my secret university reveal game with room code: ${roomCode}`,
      url: shareUrl
    };
    
    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          this.copyToClipboard(shareUrl, 'Room link copied!');
        }
      }
    } else {
      this.copyToClipboard(shareUrl, 'Room link copied!');
    }
  },
  
  // Play sound effect
  playSound(type) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const sounds = {
        reveal: { freq: 880, duration: 0.3 },
        ready: { freq: 660, duration: 0.15 },
        join: { freq: 440, duration: 0.2 },
        countdown: { freq: 550, duration: 0.1 }
      };
      
      const sound = sounds[type] || sounds.ready;
      oscillator.frequency.value = sound.freq;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.frequency.exponentialRampToValueAtTime(
        sound.freq * 0.5, 
        audioContext.currentTime + sound.duration
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001, 
        audioContext.currentTime + sound.duration
      );
      
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, sound.duration * 1000 + 100);
    } catch (error) {
      console.log('Audio not supported');
    }
  }
};

// Screen Management
const screenManager = {
  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = elements[screenName + 'Screen'] || elements[screenName];
    if (targetScreen) {
      targetScreen.classList.add('active');
      gameState.currentScreen = screenName;
    }
  },
  
  showLoading(show = true, text = 'Connecting...') {
    if (show) {
      elements.loadingOverlay.classList.remove('hidden');
      elements.loadingOverlay.querySelector('.loading-text').textContent = text;
    } else {
      elements.loadingOverlay.classList.add('hidden');
    }
  }
};

// Connection Management
const connectionManager = {
  updateStatus(status) {
    gameState.connectionStatus = status;
    const statusElement = elements.connectionStatus;
    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('.status-text');
    
    dot.className = `status-dot ${status}`;
    
    const statusTexts = {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
      reconnecting: 'Reconnecting...'
    };
    
    text.textContent = statusTexts[status] || 'Unknown';
  }
};

// Game Logic
const gameManager = {
  createRoom() {
    const playerName = elements.playerNameInput.value.trim();
    if (!playerName) {
      utils.showToast('Please enter your name first', 'warning');
      elements.playerNameInput.focus();
      return;
    }
    
    gameState.playerName = playerName;
    screenManager.showLoading(true, 'Creating room...');
    
    socket.emit('createRoom', playerName, (response) => {
      screenManager.showLoading(false);
      
      if (!response || !response.ok) {
        utils.showToast('Failed to create room. Please try again.', 'error');
        return;
      }
      
      gameState.currentRoom = response.roomId;
      elements.currentRoomCode.textContent = response.roomId;
      this.updatePlayersDisplay(response.summary);
      screenManager.showScreen('gameRoom');
      utils.showToast('Room created! Share the code with your friend.', 'success');
      utils.playSound('join');
    });
  },
  
  joinRoom() {
    const playerName = elements.playerNameInput.value.trim();
    const roomCode = elements.roomCodeInput.value.trim().toUpperCase();
    
    if (!playerName) {
      utils.showToast('Please enter your name first', 'warning');
      screenManager.showScreen('welcome');
      elements.playerNameInput.focus();
      return;
    }
    
    if (!roomCode) {
      utils.showToast('Please enter a room code', 'warning');
      elements.roomCodeInput.focus();
      return;
    }
    
    gameState.playerName = playerName;
    screenManager.showLoading(true, 'Joining room...');
    
    socket.emit('joinRoom', roomCode, playerName, (response) => {
      screenManager.showLoading(false);
      
      if (!response || !response.ok) {
        const errorMsg = response?.error || 'Failed to join room';
        utils.showToast(errorMsg, 'error');
        return;
      }
      
      gameState.currentRoom = roomCode;
      elements.currentRoomCode.textContent = roomCode;
      this.updatePlayersDisplay(response.summary);
      screenManager.showScreen('gameRoom');
      utils.showToast('Joined room successfully!', 'success');
      utils.playSound('join');
    });
  },
  
  leaveRoom() {
    if (!gameState.currentRoom) return;
    
    socket.emit('leaveRoom', gameState.currentRoom, () => {
      this.resetGame();
      utils.showToast('Left the room', 'info');
    });
  },
  
  saveSecret() {
    if (!gameState.currentRoom) {
      utils.showToast('Join a room first', 'warning');
      return;
    }
    
    const secret = elements.secretInput.value.trim();
    if (!secret) {
      utils.showToast('Please enter your dream university', 'warning');
      elements.secretInput.focus();
      return;
    }
    
    socket.emit('setSecret', gameState.currentRoom, secret, (response) => {
      if (response && response.ok) {
        gameState.mySecret = secret;
        elements.mySecretText.textContent = gameState.showMySecret ? secret : utils.maskSecret(secret);
        elements.mySecretDisplay.classList.remove('hidden');
        elements.secretSection.style.display = 'none';
        elements.readyToggle.disabled = false;
        utils.showToast('Secret saved successfully!', 'success');
      } else {
        utils.showToast('Failed to save secret', 'error');
      }
    });
  },
  
  toggleReady() {
    if (!gameState.currentRoom) return;
    
    gameState.myReady = !gameState.myReady;
    elements.readyToggle.disabled = true;
    
    socket.emit('setReady', gameState.currentRoom, gameState.myReady, (response) => {
      if (response && response.ok) {
        elements.readyToggle.disabled = false;
        elements.readyToggle.innerHTML = gameState.myReady 
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>Cancel Ready`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>I'm Ready!`;
        
        elements.readyToggle.className = gameState.myReady 
          ? 'btn btn-secondary' 
          : 'btn btn-primary';
        
        utils.playSound('ready');
        utils.showToast(gameState.myReady ? 'You are ready!' : 'Ready cancelled', 'success');
      } else {
        gameState.myReady = !gameState.myReady; // Revert state
        elements.readyToggle.disabled = false;
        utils.showToast('Failed to update ready status', 'error');
      }
    });
  },
  
  updatePlayersDisplay(summary) {
    if (!summary) return;
    
    gameState.players = summary.players;
    const playersGrid = elements.playersGrid;
    playersGrid.innerHTML = '';
    
    summary.players.forEach((player, index) => {
      const isMe = player.socketId === gameState.myId;
      const playerCard = document.createElement('div');
      playerCard.className = `player-card ${player.ready ? 'ready' : ''} ${isMe ? 'me' : ''}`;
      
      playerCard.innerHTML = `
        <div class="player-info">
          <div class="player-avatar">${utils.getAvatarLetter(player.name)}</div>
          <div class="player-details">
            <h4>${player.name}${isMe ? ' (You)' : ''}</h4>
            <div class="player-role">${index === 0 ? 'Host' : 'Guest'}</div>
          </div>
        </div>
        <div class="player-status">
          <div class="status-indicator ${player.ready ? 'ready' : ''} ${player.hasSecret ? 'has-secret' : ''}"></div>
          <span>${this.getPlayerStatusText(player)}</span>
        </div>
      `;
      
      playersGrid.appendChild(playerCard);
    });
    
    // Update waiting state
    const allReady = summary.players.length === 2 && summary.players.every(p => p.ready && p.hasSecret);
    const needMorePlayers = summary.players.length < 2;
    
    if (allReady) {
      elements.waitingState.classList.add('hidden');
    } else if (needMorePlayers) {
      this.showWaitingState('Waiting for another player to join...');
    } else {
      const notReadyPlayers = summary.players.filter(p => !p.ready || !p.hasSecret);
      if (notReadyPlayers.length > 0) {
        this.showWaitingState(`Waiting for ${notReadyPlayers.map(p => p.name).join(', ')} to be ready...`);
      }
    }
  },
  
  getPlayerStatusText(player) {
    if (player.ready && player.hasSecret) return 'Ready to reveal';
    if (player.hasSecret) return 'Secret set';
    return 'Setting up...';
  },
  
  showWaitingState(message) {
    elements.waitingState.classList.remove('hidden');
    elements.waitingState.querySelector('.waiting-subtitle').textContent = message;
  },
  
  startCountdown(seconds) {
    screenManager.showScreen('countdownScreen');
    let count = seconds;
    elements.countdownNumber.textContent = count;
    utils.playSound('countdown');
    
    const countdownInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        elements.countdownNumber.textContent = '0';
        // Request reveal after countdown
        socket.emit('requestReveal', gameState.currentRoom);
      } else {
        elements.countdownNumber.textContent = count;
        utils.playSound('countdown');
      }
    }, 1000);
  },
  
  showReveal(revealData) {
    screenManager.showScreen('revealScreen');
    elements.revealCards.innerHTML = '';
    
    revealData.forEach((player, index) => {
      const card = document.createElement('div');
      card.className = 'reveal-card';
      card.style.animationDelay = `${index * 0.2}s`;
      
      card.innerHTML = `
        <div class="reveal-card-header">
          <div class="reveal-avatar">${utils.getAvatarLetter(player.name)}</div>
          <div class="reveal-player-info">
            <h3>${player.name}</h3>
            <p class="reveal-label">Dream University</p>
          </div>
        </div>
        <div class="reveal-university">${player.secret}</div>
      `;
      
      elements.revealCards.appendChild(card);
    });
    
    utils.playSound('reveal');
    utils.showToast('Universities revealed! 🎉', 'success', 6000);
    
    // Reset ready states
    gameState.myReady = false;
    elements.readyToggle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>I'm Ready!`;
    elements.readyToggle.className = 'btn btn-primary';
    elements.readyToggle.disabled = !gameState.mySecret;
  },
  
  playAgain() {
    // Reset secret input section
    elements.secretSection.style.display = 'block';
    elements.mySecretDisplay.classList.add('hidden');
    elements.secretInput.value = '';
    elements.readyToggle.disabled = true;
    gameState.mySecret = '';
    gameState.myReady = false;
    gameState.showMySecret = false;
    gameState.isSecretHidden = true;
    
    // Update character count
    elements.charCount.textContent = '0';
    
    // Go back to game room
    screenManager.showScreen('gameRoom');
    utils.showToast('Ready for another round!', 'info');
  },
  
  async shareResults() {
    if (!gameState.players.length) return;
    
    const results = gameState.players.map(p => `${p.name}: ${p.secret || 'Not revealed'}`).join('\n');
    const shareText = `Dream University Results:\n\n${results}\n\nPlay the game at: ${window.location.origin}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Dream University Results',
          text: shareText
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          utils.copyToClipboard(shareText, 'Results copied to clipboard!');
        }
      }
    } else {
      utils.copyToClipboard(shareText, 'Results copied to clipboard!');
    }
  },
  
  resetGame() {
    gameState = {
      currentScreen: 'welcome',
      currentRoom: null,
      playerName: '',
      mySecret: '',
      myReady: false,
      myId: null,
      showMySecret: false,
      isSecretHidden: true,
      players: [],
      connectionStatus: gameState.connectionStatus
    };
    
    // Reset UI
    elements.playerNameInput.value = '';
    elements.roomCodeInput.value = '';
    elements.secretInput.value = '';
    elements.charCount.textContent = '0';
    elements.mySecretDisplay.classList.add('hidden');
    elements.secretSection.style.display = 'block';
    elements.waitingState.classList.add('hidden');
    elements.readyToggle.disabled = true;
    
    screenManager.showScreen('welcome');
  }
};

// Event Listeners Setup
function setupEventListeners() {
  // Welcome Screen
  elements.createRoomBtn.addEventListener('click', () => gameManager.createRoom());
  elements.joinRoomBtn.addEventListener('click', () => screenManager.showScreen('joinScreen'));
  
  // Player name input - Enter key
  elements.playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      gameManager.createRoom();
    }
  });
  
  // Join Screen
  elements.backToWelcome.addEventListener('click', () => screenManager.showScreen('welcome'));
  elements.joinRoomSubmit.addEventListener('click', () => gameManager.joinRoom());
  
  // Room code input - Enter key and auto-uppercase
  elements.roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      gameManager.joinRoom();
    }
  });
  
  elements.roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  // Game Room
  elements.copyRoomCode.addEventListener('click', () => {
    utils.copyToClipboard(gameState.currentRoom, 'Room code copied!');
  });
  
  elements.shareRoom.addEventListener('click', () => {
    utils.shareRoom(gameState.currentRoom);
  });
  
  elements.leaveRoom.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the room?')) {
      gameManager.leaveRoom();
    }
  });
  
  // Secret Input
  elements.secretInput.addEventListener('input', (e) => {
    const count = e.target.value.length;
    elements.charCount.textContent = count;
    
    // Update save button state
    elements.saveSecret.disabled = count === 0;
  });
  
  elements.toggleSecretVisibility.addEventListener('click', () => {
    gameState.isSecretHidden = !gameState.isSecretHidden;
    elements.secretInput.type = gameState.isSecretHidden ? 'password' : 'text';
    
    const icon = gameState.isSecretHidden 
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    
    elements.toggleSecretVisibility.innerHTML = icon;
  });
  
  elements.saveSecret.addEventListener('click', () => gameManager.saveSecret());
  elements.readyToggle.addEventListener('click', () => gameManager.toggleReady());
  
  // Secret Preview
  elements.editSecret.addEventListener('click', () => {
    elements.secretSection.style.display = 'block';
    elements.mySecretDisplay.classList.add('hidden');
    elements.secretInput.value = gameState.mySecret;
    elements.charCount.textContent = gameState.mySecret.length;
    elements.readyToggle.disabled = true;
    elements.secretInput.focus();
  });
  
  elements.togglePreview.addEventListener('click', () => {
    gameState.showMySecret = !gameState.showMySecret;
    elements.mySecretText.textContent = gameState.showMySecret 
      ? gameState.mySecret 
      : utils.maskSecret(gameState.mySecret);
    elements.mySecretText.classList.toggle('masked', !gameState.showMySecret);
  });
  
  // Reveal Screen
  elements.playAgain.addEventListener('click', () => gameManager.playAgain());
  elements.shareResults.addEventListener('click', () => gameManager.shareResults());
}

// Socket Event Handlers
function setupSocketHandlers() {
  socket.on('connect', () => {
    gameState.myId = socket.id;
    connectionManager.updateStatus('connected');
    screenManager.showLoading(false);
  });
  
  socket.on('disconnect', () => {
    connectionManager.updateStatus('disconnected');
    utils.showToast('Connection lost. Trying to reconnect...', 'warning');
  });
  
  socket.on('connect_error', () => {
    connectionManager.updateStatus('disconnected');
    utils.showToast('Connection error. Please check your internet.', 'error');
  });
  
  socket.on('reconnect', () => {
    connectionManager.updateStatus('connected');
    utils.showToast('Reconnected successfully!', 'success');
  });
  
  socket.on('reconnect_attempt', () => {
    connectionManager.updateStatus('reconnecting');
  });
  
  socket.on('roomUpdate', (summary) => {
    gameManager.updatePlayersDisplay(summary);
  });
  
  socket.on('startCountdown', (seconds) => {
    gameManager.startCountdown(seconds);
  });
  
  socket.on('reveal', (revealData) => {
    gameManager.showReveal(revealData);
  });
}

// URL Parameter Handling
function handleURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  
  if (roomCode) {
    elements.roomCodeInput.value = roomCode.toUpperCase();
    screenManager.showScreen('joinScreen');
    utils.showToast('Room code detected from URL!', 'info');
  }
}

// Add some CSS animations via JavaScript
function addDynamicStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastSlideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .btn:active {
      transform: translateY(1px) !important;
    }
    
    .player-card {
      transition: all 0.3s ease;
    }
    
    .player-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }
    
    .reveal-card {
      transition: transform 0.3s ease;
    }
    
    .reveal-card:hover {
      transform: scale(1.02);
    }
  `;
  document.head.appendChild(style);
}

// Initialize Application
function initializeApp() {
  console.log('🎓 Dream University Reveal - Enhanced Edition');
  
  // Setup everything
  addDynamicStyles();
  setupEventListeners();
  setupSocketHandlers();
  handleURLParameters();
  
  // Initial state
  connectionManager.updateStatus('connecting');
  screenManager.showScreen('welcome');
  
  // Focus on name input
  setTimeout(() => {
    elements.playerNameInput.focus();
  }, 100);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
} 