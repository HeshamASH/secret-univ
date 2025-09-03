// client.js - improved UI/UX
const socket = io();

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinCode = document.getElementById('joinCode');
const nameInput = document.getElementById('nameInput');
const lobby = document.getElementById('lobby');
const roomArea = document.getElementById('roomArea');
const roomCodeEl = document.getElementById('roomCode');
const leaveBtn = document.getElementById('leaveBtn');
const secretInput = document.getElementById('secretInput');
const setSecretBtn = document.getElementById('setSecretBtn');
const readyBtn = document.getElementById('readyBtn');
const playersList = document.getElementById('playersList');
const messages = document.getElementById('messages');
const countdown = document.getElementById('countdown');
const revealArea = document.getElementById('revealArea');
const revealList = document.getElementById('revealList');
const mySecretBox = document.getElementById('mySecretBox');
const mySecretMasked = document.getElementById('mySecretMasked');
const toggleShowMySecret = document.getElementById('toggleShowMySecret');
const editSecretBtn = document.getElementById('editSecretBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const shareRoomBtn = document.getElementById('shareRoomBtn');

let currentRoom = null;
let myReady = false;
let mySecret = '';
let myId = null;
let showMySecret = false;

// small helper messages
function showMsg(t, timeout=3500) {
  messages.textContent = t;
  messages.style.display = 'block';
  setTimeout(()=> {
    messages.style.display = 'none';
    if (messages.textContent === t) messages.textContent = '';
  }, timeout);
}

// mask secret
function maskSecret(s) {
  if (!s) return '—';
  return '•'.repeat(Math.min(20, s.length));
}

// UI utilities
function enterRoomUI(code) {
  currentRoom = code;
  roomCodeEl.textContent = code;
  lobby.classList.add('hidden');
  roomArea.classList.remove('hidden');
  revealArea.classList.add('hidden');
  countdown.classList.add('hidden');
  mySecretBox.classList.add('hidden');
  readyBtn.disabled = true;
  setSecretBtn.disabled = false;
  myReady = false;
  readyBtn.textContent = 'Ready';
}

function leaveRoomUI() {
  location.reload();
}

// create room
createBtn.onclick = () => {
  const n = nameInput.value.trim();
  socket.emit('createRoom', n, (res) => {
    if (!res || !res.ok) return showMsg('Could not create room');
    enterRoomUI(res.roomId);
    showMsg('Room created. Share the code or use Share button.');
  });
};

// join
joinBtn.onclick = () => {
  const code = joinCode.value.trim().toUpperCase();
  if (!code) return showMsg('Enter room code');
  const n = nameInput.value.trim();
  socket.emit('joinRoom', code, n, (res) => {
    if (!res || !res.ok) return showMsg(res && res.error ? res.error : 'Could not join');
    enterRoomUI(code);
    showMsg('Joined room. Save your secret then click Ready.');
  });
};

leaveBtn.onclick = () => {
  if (!currentRoom) return;
  socket.emit('leaveRoom', currentRoom, () => {
    leaveRoomUI();
  });
};

// set secret
setSecretBtn.onclick = () => {
  if (!currentRoom) return showMsg('Join a room first');
  const s = secretInput.value.trim();
  if (!s) return showMsg('Type your secret first');
  socket.emit('setSecret', currentRoom, s, (r) => {
    if (r && r.ok) {
      mySecret = s;
      showMsg('Secret saved (hidden)');
      mySecretMasked.textContent = maskSecret(mySecret);
      mySecretBox.classList.remove('hidden');
      // now allow ready
      readyBtn.disabled = false;
      // lock secret editing until user clicks edit
      setSecretBtn.disabled = true;
      secretInput.value = '';
    } else showMsg('Failed to save secret');
  });
};

// edit secret (allow editing)
editSecretBtn.onclick = () => {
  secretInput.value = mySecret;
  setSecretBtn.disabled = false;
  mySecretBox.classList.add('hidden');
  readyBtn.disabled = true;
};

// toggle show my secret
toggleShowMySecret.onclick = () => {
  showMySecret = !showMySecret;
  toggleShowMySecret.textContent = showMySecret ? 'Hide' : 'Show';
  mySecretMasked.textContent = showMySecret ? mySecret : maskSecret(mySecret);
};

// toggle ready
readyBtn.onclick = () => {
  if (!currentRoom) return showMsg('Join a room first');
  myReady = !myReady;
  // disable toggling while waiting for server response
  readyBtn.disabled = true;
  socket.emit('setReady', currentRoom, myReady, (r) => {
    if (!r || !r.ok) showMsg('Failed to set ready');
    // re-enable only if user still has a secret
    readyBtn.disabled = !(mySecret && mySecret.length > 0);
    readyBtn.textContent = myReady ? 'Cancel Ready' : 'Ready';
  });
};

// copy / share
copyRoomBtn.onclick = async () => {
  if (!currentRoom) return showMsg('No room to copy');
  try {
    await navigator.clipboard.writeText(location.origin + location.pathname + '?room=' + currentRoom);
    showMsg('Room link copied');
  } catch(e) {
    // fallback copy code only
    try { await navigator.clipboard.writeText(currentRoom); showMsg('Room code copied'); }
    catch { showMsg('Copy not supported'); }
  }
};
shareRoomBtn.onclick = async () => {
  if (!currentRoom) return showMsg('No room to share');
  const shareUrl = location.origin + location.pathname + '?room=' + currentRoom;
  if (navigator.share) {
    try { await navigator.share({ title: 'Join my room', url: shareUrl }); }
    catch(err) { showMsg('Share cancelled'); }
  } else {
    // fallback: copy
    copyRoomBtn.click();
  }
};

// handle optional room from query param
(function checkQuery() {
  try {
    const params = new URLSearchParams(location.search);
    const r = params.get('room');
    if (r) joinCode.value = r;
  } catch(e){}
})();

// socket events
socket.on('connect', () => { myId = socket.id; });
socket.on('roomUpdate', (summary) => {
  if (!summary) return;
  // update players list
  playersList.innerHTML = '';
  summary.players.forEach(p => {
    const li = document.createElement('li');
    const isMe = (p.socketId === myId);
    li.textContent = `${p.name} — ${p.ready ? 'Ready' : 'Not ready'}${p.hasSecret ? ' (secret set)' : ''}`;
    if (isMe) {
      li.textContent += ' — (you)';
      li.style.fontWeight = '700';
    }
    playersList.appendChild(li);
  });
  // hide reveal area if new updates happen
  revealArea.classList.add('hidden');
});

// countdown from server (animated)
socket.on('startCountdown', (seconds) => {
  revealArea.classList.add('hidden');
  countdown.classList.remove('hidden');
  countdown.style.transform = 'scale(1.0)';
  let s = seconds;
  countdown.textContent = s;
  const t = setInterval(() => {
    s--;
    if (s <= 0) {
      countdown.textContent = '0';
      clearInterval(t);
      countdown.style.transform = 'scale(1.05)';
    } else {
      countdown.textContent = s;
      countdown.style.transform = 'scale(1.1)';
      setTimeout(()=> countdown.style.transform = 'scale(1.0)', 150);
    }
  }, 1000);
});

// reveal event (play sound)
socket.on('reveal', (list) => {
  countdown.classList.add('hidden');
  revealArea.classList.remove('hidden');
  revealList.innerHTML = '';
  list.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.secret)}`;
    revealList.appendChild(li);
  });
  // after reveal, update ready button state (server resets ready)
  myReady = false;
  readyBtn.textContent = 'Ready';
  readyBtn.disabled = !(mySecret && mySecret.length > 0);
  // small reveal sound
  try { playRevealTone(); } catch(e){}
});

// handle disconnects / errors
socket.on('connect_error', () => showMsg('Connection error'));
socket.on('disconnect', () => showMsg('Disconnected, trying reconnect'));

// escape simple html
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

// tiny sound using WebAudio
function playRevealTone() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 880;
  g.gain.value = 0.0012;
  o.connect(g); g.connect(ctx.destination);
  o.start();
  o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.28);
  g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.35);
  setTimeout(()=> { o.stop(); ctx.close(); }, 400);
}
