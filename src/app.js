import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';

const app = express();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const origins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

app.use(cors({ origin: origins.includes('*') ? true : origins }));

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------------------
// Rutas de salud (sin autenticación)
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'citas-backend-v3' }),
);
app.get('/api/public-config', (_req, res) =>
  res.json({
    appName: 'Gestión Citas',
    timezone: process.env.TIMEZONE || 'America/Bogota',
  }),
);

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------
app.use('/api', apiRouter);

// ---------------------------------------------------------------------------
// Manejador de errores global
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

export default app;
