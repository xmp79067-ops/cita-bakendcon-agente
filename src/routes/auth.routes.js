import { Router } from 'express';
import { query } from '../db/index.js';
import { comparePassword, hashPassword, signToken } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email y password son obligatorios.' });
  }

  const { rows } = await query(
    'SELECT * FROM users WHERE email=$1 LIMIT 1',
    [String(email).toLowerCase().trim()],
  );
  const user = rows[0];

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas.' });

  const token = signToken({ uid: user.id });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/bootstrap-superadmin
// Bootstrap ÚNICO: crea el primer super_admin.
// Protegido con un secreto de un solo uso definido por variable de entorno.
// ---------------------------------------------------------------------------
router.post('/bootstrap-superadmin', async (req, res) => {
  const secret = req.header('x-setup-secret');
  const expectedSecret = process.env.SETUP_SECRET || 'setup123';
  if (!secret || secret !== expectedSecret) {
    return res.status(403).json({ error: 'Secreto de instalación inválido.' });
  }

  const { rows: existing } = await query(
    `SELECT id FROM users WHERE role='super_admin' LIMIT 1`,
  );
  if (existing.length) {
    return res.status(409).json({
      error: 'Ya existe un super_admin. Este endpoint solo funciona una vez.',
    });
  }

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email y password son obligatorios.' });
  }

  const hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users(name,email,password_hash,role)
     VALUES($1,$2,$3,'super_admin')
     RETURNING id,name,email,role`,
    [name.trim(), email.toLowerCase().trim(), hash],
  );
  res.status(201).json(rows[0]);
});

export default router;
