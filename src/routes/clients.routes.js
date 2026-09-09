import { Router } from 'express';
import { query } from '../db/index.js';
import { assertScope } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/clients — lista clientes con estadísticas de citas
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const sql = `
    SELECT
      c.*,
      COUNT(a.id)::int                                                             AS appointments_count,
      MAX(a.date + a.time) FILTER (WHERE a.date + a.time <  NOW())                AS last_appointment,
      MIN(a.date + a.time) FILTER (WHERE a.date + a.time >= NOW())                AS next_appointment
    FROM clients c
    LEFT JOIN appointments a ON a.client_id = c.id
    WHERE c.company_id = $1
    GROUP BY c.id
    ORDER BY c.name
  `;
  const { rows } = await query(sql, [s.companyId]);
  res.json(rows);
});

// ---------------------------------------------------------------------------
// POST /api/clients — crea o actualiza un cliente (upsert por teléfono)
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { name, phone, email = '', notes = '', tags = [] } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'name y phone son obligatorios.' });
  }

  const normalized = String(phone).replace(/\D/g, '');
  const { rows } = await query(
    `INSERT INTO clients(company_id,name,phone,email,notes,tags)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(company_id,phone)
     DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, updated_at=NOW()
     RETURNING *`,
    [s.companyId, name, normalized, email, notes, JSON.stringify(tags)],
  );
  res.status(201).json(rows[0]);
});

// ---------------------------------------------------------------------------
// PATCH /api/clients/:id — actualiza campos parciales de un cliente
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { name, email, notes, tags } = req.body || {};
  const { rows } = await query(
    `UPDATE clients
     SET
       name       = COALESCE($1, name),
       email      = COALESCE($2, email),
       notes      = COALESCE($3, notes),
       tags       = COALESCE($4, tags),
       updated_at = NOW()
     WHERE id=$5 AND company_id=$6
     RETURNING *`,
    [name, email, notes, tags ? JSON.stringify(tags) : null, req.params.id, s.companyId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });
  res.json(rows[0]);
});

export default router;
