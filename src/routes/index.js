import { Router } from 'express';
import { authenticate, scope, requireRole } from '../middlewares/auth.js';
import { query } from '../db/index.js';
import authRoutes from './auth.routes.js';
import companiesRoutes from './companies.routes.js';
import usersRoutes from './users.routes.js';
import servicesRoutes from './services.routes.js';
import appointmentsRoutes from './appointments.routes.js';

const router = Router();

// ---------------------------------------------------------------------------
// Rutas públicas (sin autenticación)
// ---------------------------------------------------------------------------
router.use('/auth', authRoutes);

// ---------------------------------------------------------------------------
// A partir de aquí, todas las rutas requieren JWT válido
// ---------------------------------------------------------------------------
router.use(authenticate);

// GET /api/me — devuelve el usuario autenticado y su empresa
router.get('/me', async (req, res) => {
  const { companyId } = scope(req);
  let company = null;
  if (companyId) {
    company = (await query('SELECT * FROM companies WHERE id=$1', [companyId])).rows[0] || null;
  }
  res.json({ user: req.auth, company });
});

// ---------------------------------------------------------------------------
// Sub-routers por recurso
// ---------------------------------------------------------------------------
router.use('/companies', companiesRoutes);
router.use('/users', usersRoutes);
router.use('/services', servicesRoutes);
router.use('/appointments', appointmentsRoutes);

export default router;
