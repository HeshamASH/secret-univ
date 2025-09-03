# Secret University Reveal
Simple Node.js + Socket.IO app. Two players join the same room, set their secret university, click Ready. When both are ready the server does a 3-second countdown and reveals both secrets at the same time.

## How to use
1. Unzip and `cd` into the project folder.
2. `npm install`
3. `npm start`
4. Open `http://localhost:3000` on the machine running the server. On other devices open the public URL after deployment.

## Deploy to Railway (quick steps)
1. Push this project to a GitHub repository.
2. Create a Railway account and connect your GitHub account.
3. On Railway: **New Project → Deploy from GitHub → select your repo**.
4. Set start command to `npm start` if not detected. Railway will provide a public URL.
5. Open the Railway URL on both devices and use the app.

Notes:
- This project uses in-memory rooms (no DB). Restarting the server clears rooms.
- Socket.IO CORS is permissive (`origin: "*"`) for easy deployment — tighten this for production.
