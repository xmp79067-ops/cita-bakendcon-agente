import { Router } from 'express';
import { query } from '../db/index.js';
import { requireRole, assertScope, hashPassword } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/users — lista usuarios del negocio
// ---------------------------------------------------------------------------
router.get('/', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { rows } = await query(
    'SELECT id,name,email,phone,role,company_id,active,created_at FROM users WHERE company_id=$1 ORDER BY name',
    [s.companyId],
  );
  res.json(rows);
});

// ---------------------------------------------------------------------------
// POST /api/users — crea un usuario dentro del negocio
// ---------------------------------------------------------------------------
router.post('/', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { name, email, phone = '', role = 'employee', password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email y password son obligatorios.' });
  }
  if (!['admin', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }

  const hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users(company_id,name,email,phone,role,password_hash)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id,name,email,phone,role,company_id,active`,
    [s.companyId, name.trim(), email.toLowerCase().trim(), phone, role, hash],
  );
  res.status(201).json(rows[0]);
});

// ---------------------------------------------------------------------------
// PATCH /api/users/:id/password — cambia la contraseña de un usuario
// ---------------------------------------------------------------------------
router.patch('/:id/password', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password es obligatorio.' });

  const hash = await hashPassword(password);
  const { rows } = await query(
    'UPDATE users SET password_hash=$1 WHERE id=$2 AND company_id=$3 RETURNING id',
    [hash, req.params.id, s.companyId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ ok: true });
});

export default router;
