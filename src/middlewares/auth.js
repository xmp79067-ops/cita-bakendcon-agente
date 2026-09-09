import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET es obligatorio.');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ---------------------------------------------------------------------------
// Utilidades de contraseña y token
// ---------------------------------------------------------------------------

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// ---------------------------------------------------------------------------
// Middleware: valida el JWT y carga el usuario fresco desde la DB
// (así, si lo desactivan o le cambian el rol, el cambio aplica de inmediato)
// ---------------------------------------------------------------------------

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido.' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    const { rows } = await query(
      'SELECT id, role, company_id, active FROM users WHERE id=$1 LIMIT 1',
      [decoded.uid],
    );
    const user = rows[0];
    if (!user || !user.active) {
      return res.status(403).json({ error: 'Usuario no autorizado.' });
    }
    req.auth = { uid: user.id, role: user.role, companyId: user.company_id };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

// ---------------------------------------------------------------------------
// Middleware: restringe el acceso a ciertos roles
// ---------------------------------------------------------------------------

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth?.role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta operación.' });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Helpers de scope: devuelven el companyId con el que se deben filtrar queries
// ---------------------------------------------------------------------------

/** Devuelve el companyId activo para la petición. */
export function scope(req) {
  return {
    companyId:
      req.auth?.role === 'super_admin'
        ? req.query.companyId || req.auth.companyId || null
        : req.auth?.companyId || null,
  };
}

/**
 * Como `scope()`, pero responde 400 automáticamente si no hay companyId.
 * Retorna el objeto scope o null (en cuyo caso ya envió la respuesta).
 */
export function assertScope(req, res) {
  const { companyId } = scope(req);
  if (!companyId) {
    res.status(400).json({
      error: 'Falta companyId. El usuario debe pertenecer a un negocio.',
    });
    return null;
  }
  return { companyId };
}
