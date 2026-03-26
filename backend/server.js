/**
 * backend/server.js
 */
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.set('io', io);

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/migrations',    require('./routes/migrations'));
app.use('/api/credentials',   require('./routes/credentials'));
app.use('/api/billing',       require('./routes/billing'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/agent',         require('./routes/agentChat'));        // Task 19
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/health',        require('./routes/health'));
app.use('/api/webhooks',      require('./routes/webhooks'));
app.use('/api/2fa',           require('./routes/twoFactor'));
app.use('/api/password',      require('./routes/passwordReset'));
app.use('/api/verify-email',  require('./routes/emailVerification'));
app.use('/api/push-change',   require('./routes/pushChange'));       // Task 11
app.use('/api/upload-source', require('./routes/uploadSource'));     // Task 13
app.use('/api/update-deploy', require('./routes/updateDeploy'));     // Task 14
app.use('/api/app-health',    require('./routes/appHealth'));        // Task 15
app.use('/api/receipt',       require('./routes/receipt'));          // Task 18 — public, no auth

io.on('connection', socket => {
  socket.on('join',  room => socket.join(room));
  socket.on('leave', room => socket.leave(room));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`MigrateBot backend running on :${PORT}`));
