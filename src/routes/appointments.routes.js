import { Router } from 'express';
import { query } from '../db/index.js';
import { assertScope } from '../middlewares/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/appointments — lista citas del negocio ordenadas por fecha/hora
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { rows } = await query(
    'SELECT * FROM appointments WHERE company_id=$1 ORDER BY date, time',
    [s.companyId],
  );

  res.json(
    rows.map((r) => ({
      ...r,
      date: String(r.date),
      time: String(r.time).slice(0, 5),
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
// POST /api/appointments — crea una cita y hace upsert del cliente
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const x = req.body || {};
  if (!x.clientName || !x.clientPhone || !x.date || !x.time) {
    return res.status(400).json({ error: 'La cita está incompleta.' });
  }

  const phone = String(x.clientPhone).replace(/\D/g, '');

  // Upsert del cliente para mantener la integridad referencial
  const { rows: clientRows } = await query(
    `INSERT INTO clients(company_id,name,phone)
     VALUES($1,$2,$3)
     ON CONFLICT(company_id,phone)
     DO UPDATE SET name=EXCLUDED.name, updated_at=NOW()
     RETURNING id`,
    [s.companyId, x.clientName, phone],
  );

  const { rows } = await query(
    `INSERT INTO appointments
       (company_id, client_id, employee_id, client_name, client_phone,
        service_name, date, time, duration, status, notes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      s.companyId,
      clientRows[0].id,
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
// PATCH /api/appointments/:id — actualiza campos parciales de una cita
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  const { status, date, time, serviceName, duration, notes } = req.body || {};

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
       updated_at   = NOW()
     WHERE id=$7 AND company_id=$8
     RETURNING *`,
    [status, date, time, serviceName, duration, notes, req.params.id, s.companyId],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada.' });
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// DELETE /api/appointments/:id — elimina una cita
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const s = assertScope(req, res);
  if (!s) return;

  await query(
    'DELETE FROM appointments WHERE id=$1 AND company_id=$2',
    [req.params.id, s.companyId],
  );
  res.json({ ok: true });
});

export default router;
