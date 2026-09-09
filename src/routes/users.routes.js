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
// PATCH /api/users/:id — actualiza datos de un usuario o su estado activo/inactivo
// ---------------------------------------------------------------------------
router.patch('/:id', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { name, email, phone, role, active } = req.body || {};

  if (role && !['admin', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }

  const { rows } = await query(
    `UPDATE users
     SET
       name       = COALESCE($1, name),
       email      = COALESCE($2, email),
       phone      = COALESCE($3, phone),
       role       = COALESCE($4, role),
       active     = COALESCE($5, active)
     WHERE id=$6 AND company_id=$7
     RETURNING id,name,email,phone,role,company_id,active`,
    [
      name ? name.trim() : null,
      email ? email.toLowerCase().trim() : null,
      phone !== undefined ? phone : null,
      role || null,
      active !== undefined ? active : null,
      req.params.id,
      s.companyId,
    ],
  );

  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json(rows[0]);
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

// ---------------------------------------------------------------------------
// DELETE /api/users/:id — elimina un usuario del negocio
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  // Evitar que el admin se elimine a sí mismo
  if (req.params.id === req.auth.uid) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
  }

  const { rows } = await query(
    'SELECT role, company_id FROM users WHERE id=$1 AND company_id=$2',
    [req.params.id, s.companyId],
  );
  const targetUser = rows[0];
  if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado.' });

  // Si se elimina al admin del negocio, se borra toda la compañía en cascada (servicios, trabajadores, citas)
  if (targetUser.role === 'admin' && targetUser.company_id) {
    await query('DELETE FROM companies WHERE id=$1', [targetUser.company_id]);
    return res.json({ ok: true, deletedCompany: true });
  }

  await query('DELETE FROM users WHERE id=$1 AND company_id=$2', [
    req.params.id,
    s.companyId,
  ]);
  res.json({ ok: true });
});

export default router;
