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

// ---------------------------------------------------------------------------
// PATCH /api/services/:id — actualiza un servicio (precio, duración, activo, nombre)
// ---------------------------------------------------------------------------
router.patch('/:id', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { name, durationMinutes, price, active } = req.body || {};

  const { rows } = await query(
    `UPDATE services
     SET
       name             = COALESCE($1, name),
       duration_minutes = COALESCE($2, duration_minutes),
       price            = COALESCE($3, price),
       active           = COALESCE($4, active)
     WHERE id=$5 AND company_id=$6
     RETURNING *`,
    [name, durationMinutes, price, active, req.params.id, s.companyId],
  );

  if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado.' });
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// DELETE /api/services/:id — elimina un servicio
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  await query('DELETE FROM services WHERE id=$1 AND company_id=$2', [
    req.params.id,
    s.companyId,
  ]);
  res.json({ ok: true });
});

export default router;
