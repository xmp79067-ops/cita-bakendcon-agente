import { Router } from 'express';
import { pool, query } from '../db/index.js';
import { requireRole } from '../middlewares/auth.js';
import { hashPassword } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/companies  — lista todos los negocios (solo super_admin)
// ---------------------------------------------------------------------------
router.get('/', requireRole('super_admin'), async (_req, res) => {
  const { rows } = await query('SELECT * FROM companies ORDER BY created_at DESC');
  res.json(rows);
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

export default router;
