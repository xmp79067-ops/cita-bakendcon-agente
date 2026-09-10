import { Router } from 'express';
import { pool, query } from '../db/index.js';
import { requireRole } from '../middlewares/auth.js';
import { hashPassword } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/companies  — lista todos los negocios con metadata de admin (solo super_admin)
// ---------------------------------------------------------------------------
router.get('/', requireRole('super_admin'), async (_req, res) => {
  const { rows } = await query(`
    SELECT
      c.*,
      u.name AS admin_name,
      u.email AS admin_email,
      (SELECT COUNT(*) FROM appointments a WHERE a.company_id = c.id) AS appointments_count,
      (SELECT COUNT(*) FROM users u2 WHERE u2.company_id = c.id) AS users_count,
      (SELECT COUNT(*) FROM services s WHERE s.company_id = c.id) AS services_count
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id AND u.role = 'admin'
    ORDER BY c.created_at DESC
  `);
  res.json(rows.map((c) => ({
    ...c,
    adminName: c.admin_name,
    adminEmail: c.admin_email,
    appointmentsCount: Number(c.appointments_count || 0),
    usersCount: Number(c.users_count || 0),
    servicesCount: Number(c.services_count || 0),
  })));
});

// ---------------------------------------------------------------------------
// GET /api/companies/:id — detalle de un negocio específico
// ---------------------------------------------------------------------------
router.get('/:id', requireRole('super_admin'), async (req, res) => {
  const { rows } = await query(`
    SELECT
      c.*,
      u.name AS admin_name,
      u.email AS admin_email,
      (SELECT COUNT(*) FROM appointments a WHERE a.company_id = c.id) AS appointments_count,
      (SELECT COUNT(*) FROM users u2 WHERE u2.company_id = c.id) AS users_count,
      (SELECT COUNT(*) FROM services s WHERE s.company_id = c.id) AS services_count
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id AND u.role = 'admin'
    WHERE c.id = $1
  `, [req.params.id]);

  if (!rows.length) {
    return res.status(404).json({ error: 'Negocio no encontrado.' });
  }

  const c = rows[0];
  res.json({
    ...c,
    adminName: c.admin_name,
    adminEmail: c.admin_email,
    appointmentsCount: Number(c.appointments_count || 0),
    usersCount: Number(c.users_count || 0),
    servicesCount: Number(c.services_count || 0),
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/companies/:id/toggle-status — activa o suspende un negocio
// ---------------------------------------------------------------------------
router.patch('/:id/toggle-status', requireRole('super_admin'), async (req, res) => {
  const { rows } = await query(
    'UPDATE companies SET active = NOT active WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!rows.length) {
    return res.status(404).json({ error: 'Negocio no encontrado.' });
  }
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// POST /api/companies — crea un negocio + su usuario admin en una transacción
// ---------------------------------------------------------------------------
router.post('/', requireRole('super_admin'), async (req, res) => {
  const { companyName, slug, adminName, adminEmail, adminPassword } = req.body || {};

  if (!companyName || !slug || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({
      error: 'companyName, slug, adminName, adminEmail y adminPassword son obligatorios.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const c = await client.query(
      'INSERT INTO companies(name,slug) VALUES($1,$2) RETURNING *',
      [companyName.trim(), slug.trim().toLowerCase()],
    );

    const hash = await hashPassword(adminPassword);
    const u = await client.query(
      `INSERT INTO users(company_id,name,email,password_hash,role)
       VALUES($1,$2,$3,$4,'admin')
       RETURNING id,name,email,role,company_id`,
      [c.rows[0].id, adminName.trim(), adminEmail.toLowerCase().trim(), hash],
    );

    await client.query('COMMIT');
    res.status(201).json({ company: c.rows[0], admin: u.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(409).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/companies/:id — elimina un negocio y todo lo relacionado en cascada
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('super_admin'), async (req, res) => {
  await query('DELETE FROM companies WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;

