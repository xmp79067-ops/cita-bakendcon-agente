import { Router } from 'express';
import { query } from '../db/index.js';
import { assertScope, requireRole } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/appointments — lista citas del negocio ordenadas por fecha/hora
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { rows } = await query(
    `SELECT a.*, u.name AS employee_name
     FROM appointments a
     LEFT JOIN users u ON a.employee_id = u.id
     WHERE a.company_id=$1
     ORDER BY a.date, a.time`,
    [s.companyId],
  );

  res.json(
    rows.map((r) => ({
      ...r,
      date: r.date instanceof Date
        ? `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}-${String(r.date.getDate()).padStart(2, '0')}`
        : String(r.date || '').slice(0, 10),
      time: String(r.time).slice(0, 5),
      employeeId: r.employee_id,
      employeeName: r.employee_name || null,
      clientName: r.client_name,
      clientPhone: r.client_phone,
      serviceName: r.service_name,
      duration: r.duration,
      status: r.status,
      notes: r.notes,
      reminderSent: r.reminder_sent,
    })),
  );
});

// ---------------------------------------------------------------------------
// POST /api/appointments — crea una cita (solo administradores)
// ---------------------------------------------------------------------------
router.post('/', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const x = req.body || {};
  if (!x.clientName || !x.clientPhone || !x.date || !x.time) {
    return res.status(400).json({ error: 'La cita está incompleta.' });
  }

  const phone = String(x.clientPhone).replace(/\D/g, '');

  const { rows } = await query(
    `INSERT INTO appointments
       (company_id, employee_id, client_name, client_phone,
        service_name, date, time, duration, status, notes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      s.companyId,
      x.employeeId || null,
      x.clientName,
      phone,
      x.serviceName || 'Servicio',
      x.date,
      x.time,
      x.duration || 60,
      x.status || 'pendiente',
      x.notes || '',
    ],
  );
  res.status(201).json(rows[0]);
});

// ---------------------------------------------------------------------------
// PATCH /api/appointments/:id — actualiza campos de la cita
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { status, date, time, serviceName, duration, notes, clientName, clientPhone, employeeId } = req.body || {};

  // Si es empleado, únicamente tiene permiso para cambiar el estado
  if (req.user?.role === 'employee') {
    if (date || time || serviceName || duration || notes || clientName || clientPhone || employeeId !== undefined) {
      return res.status(403).json({
        error: 'Los empleados únicamente pueden actualizar el estado de la cita.',
      });
    }
  }

  if (status && !['pendiente', 'atendiendo', 'realizado'].includes(status)) {
    return res.status(400).json({
      error: 'status debe ser uno de: pendiente, atendiendo, realizado.',
    });
  }

  const { rows } = await query(
    `UPDATE appointments
     SET
       status       = COALESCE($1, status),
       date         = COALESCE($2, date),
       time         = COALESCE($3, time),
       service_name = COALESCE($4, service_name),
       duration     = COALESCE($5, duration),
       notes        = COALESCE($6, notes),
       client_name  = COALESCE($7, client_name),
       client_phone = COALESCE($8, client_phone),
       employee_id  = CASE WHEN $9::text IS NOT NULL THEN NULLIF($9, '')::uuid ELSE employee_id END,
       updated_at   = NOW()
     WHERE id=$10 AND company_id=$11
     RETURNING *`,
    [status, date, time, serviceName, duration, notes, clientName, clientPhone, employeeId !== undefined ? (employeeId || '') : null, req.params.id, s.companyId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada.' });
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// DELETE /api/appointments/:id — elimina una cita (solo administradores)
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('super_admin', 'admin'), async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  await query(
    'DELETE FROM appointments WHERE id=$1 AND company_id=$2',
    [req.params.id, s.companyId],
  );
  res.json({ ok: true });
});

export default router;
