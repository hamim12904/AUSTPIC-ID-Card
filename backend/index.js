import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/.env holds server secrets and must never be committed. The repo
// root .env holds VITE_* client vars and is loaded by Vite itself.
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const isProd = process.env.NODE_ENV === 'production';

if (!JWT_SECRET) {
  const hint = 'Add JWT_SECRET=<long random string> to server/.env';
  if (isProd) {
    console.error(`[server] Refusing to start: JWT_SECRET is not set. ${hint}`);
    process.exit(1);
  }
  console.warn(`[server] WARNING: JWT_SECRET is not set. ${hint}`);
}
if (!MONGODB_URI) {
  console.error('[server] Refusing to start: MONGODB_URI is not set in server/.env');
  process.exit(1);
}

const app = express();

// Behind the Vite dev proxy the browser is same-origin, but allow direct calls
// too (e.g. hitting :5000 from curl or a deployed frontend on another host).
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);

// Placeholders for the not-yet-built features the frontend already calls
// (src/api/templateApi.js, src/api/submissionApi.js). They answer with the
// standard error envelope instead of an HTML 404 so client.js still surfaces
// a clean { code, message }. templateApi.js falls back to the bundled config.
app.use('/api/templates', notFoundHandler);
app.use('/api/submissions', notFoundHandler);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[server] MongoDB connected: ${MONGODB_URI}`);
  } catch (err) {
    console.error('[server] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down.`);
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Only boot when executed directly, so tests can import `app` and mount it
// without opening a Mongo connection or binding a fixed port.
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) start();

export default app;
