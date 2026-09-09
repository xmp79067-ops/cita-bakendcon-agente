import { Router } from 'express';
import { query } from '../db/index.js';
import { requireRole, assertScope } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/services — lista servicios del negocio
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { rows } = await query(
    'SELECT * FROM services WHERE company_id=$1 ORDER BY name',
    [s.companyId],
  );
  res.json(rows);
});

// ---------------------------------------------------------------------------
// POST /api/services — crea un nuevo servicio (solo admin)
// ---------------------------------------------------------------------------
router.post('/', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { name, durationMinutes = 60, price = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name es obligatorio.' });

  const { rows } = await query(
    'INSERT INTO services(company_id,name,duration_minutes,price) VALUES($1,$2,$3,$4) RETURNING *',
    [s.companyId, name, durationMinutes, price],
  );
  res.status(201).json(rows[0]);
});

export default router;
