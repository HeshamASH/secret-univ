// client.js
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

let currentRoom = null;
let myReady = false;

function showMsg(t) { messages.textContent = t; setTimeout(()=>{ if (messages.textContent === t) messages.textContent = '' }, 5000); }

// create room
createBtn.onclick = () => {
  const n = nameInput.value.trim();
  socket.emit('createRoom', n, (res) => {
    if (!res || !res.ok) return showMsg('Could not create room');
    enterRoom(res.roomId);
  });
};

// join
joinBtn.onclick = () => {
  const code = joinCode.value.trim().toUpperCase();
  if (!code) return showMsg('Enter room code');
  const n = nameInput.value.trim();
  socket.emit('joinRoom', code, n, (res) => {
    if (!res || !res.ok) return showMsg(res && res.error ? res.error : 'Could not join');
    enterRoom(code);
  });
};

leaveBtn.onclick = () => {
  if (!currentRoom) return;
  socket.emit('leaveRoom', currentRoom, () => {
    location.reload(); // simple way to reset UI
  });
};

function enterRoom(code) {
  currentRoom = code;
  roomCodeEl.textContent = code;
  lobby.classList.add('hidden');
  roomArea.classList.remove('hidden');
  revealArea.classList.add('hidden');
  countdown.classList.add('hidden');
  myReady = false;
  readyBtn.textContent = 'Ready';
  setSecretBtn.disabled = false;
}

// set secret
setSecretBtn.onclick = () => {
  if (!currentRoom) return showMsg('You must join a room first');
  const s = secretInput.value.trim();
  if (!s) return showMsg('Type your secret first');
  socket.emit('setSecret', currentRoom, s, (r) => {
    if (r && r.ok) showMsg('Secret saved (hidden)');
    else showMsg('Failed to save secret');
  });
};

// toggle ready
readyBtn.onclick = () => {
  if (!currentRoom) return showMsg('Join a room first');
  myReady = !myReady;
  socket.emit('setReady', currentRoom, myReady, (r) => {
    if (!r || !r.ok) showMsg('Failed');
  });
  readyBtn.textContent = myReady ? 'Cancel Ready' : 'Ready';
};

socket.on('roomUpdate', (summary) => {
  if (!summary) return;
  // update players list
  playersList.innerHTML = '';
  summary.players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} — ${p.ready ? 'Ready' : 'Not ready'}${p.hasSecret ? ' (secret set)' : ''}`;
    playersList.appendChild(li);
  });
  // hide reveal area if new updates happen
  revealArea.classList.add('hidden');
});

// countdown from server
socket.on('startCountdown', (seconds) => {
  revealArea.classList.add('hidden');
  countdown.classList.remove('hidden');
  let s = seconds;
  countdown.textContent = s;
  const t = setInterval(() => {
    s--;
    if (s <= 0) {
      countdown.textContent = '0';
      clearInterval(t);
    } else {
      countdown.textContent = s;
    }
  }, 1000);
});

// reveal event
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
});

socket.on('connect_error', () => showMsg('Connection error'));

// Escape simple html
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}
