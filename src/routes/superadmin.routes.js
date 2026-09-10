import { Router } from 'express';
import { query } from '../db/index.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();

/**
 * Dashboard global para Super Admin
 * Todas las rutas de esta sección solo pueden ser accedidas por super_admin
 */

// ---------------------------------------------------------------------------
// GET /api/superadmin/stats — métricas agregadas de toda la plataforma
// ---------------------------------------------------------------------------
router.get('/stats', requireRole('super_admin'), async (req, res) => {
    const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM companies) AS total_companies,
      (SELECT COUNT(*) FROM companies WHERE active = TRUE) AS active_companies,
      (SELECT COUNT(*) FROM companies WHERE active = FALSE) AS inactive_companies,
      (SELECT COUNT(*) FROM users WHERE company_id IS NOT NULL) AS total_users,
      (SELECT COUNT(*) FROM services) AS total_services,
      (SELECT COUNT(*) FROM appointments) AS total_appointments,
      (
        SELECT COUNT(*)
        FROM appointments a
        WHERE a.date = CURRENT_DATE
      ) AS appointments_today,
      (
        SELECT COUNT(DISTINCT a.company_id)
        FROM appointments a
        WHERE a.date = CURRENT_DATE
      ) AS companies_with_appointments,
      (
        SELECT COUNT(*)
        FROM companies c
        WHERE NOT EXISTS (
          SELECT 1 FROM appointments a WHERE a.company_id = c.id AND a.date = CURRENT_DATE
        )
      ) AS companies_without_appointments,
      (
        SELECT COALESCE(SUM(s.price), 0)
        FROM appointments a
        JOIN services s
          ON s.name = a.service_name
         AND s.company_id = a.company_id
        WHERE a.date = CURRENT_DATE
      ) AS estimated_revenue_today
  `);

    const today = rows[0];

    // Crecimiento aproximado: comparación con el día anterior
    const previous = await query(`
    SELECT
      COUNT(*) AS appointments_yesterday,
      COALESCE(SUM(s.price), 0) AS revenue_yesterday
    FROM appointments a
    LEFT JOIN services s
      ON s.name = a.service_name
     AND s.company_id = a.company_id
    WHERE a.date = CURRENT_DATE - INTERVAL '1 day'
  `);

    const yesterday = previous.rows[0];

    const calculateGrowth = (current, previousValue) => {
        if (!previousValue) return 0;
        return Math.round(((current - previousValue) / previousValue) * 100);
    };

    res.json({
        ...today,
        totalCompanies: today.total_companies,
        activeCompanies: today.active_companies,
        inactiveCompanies: today.inactive_companies,
        totalUsers: today.total_users,
        totalServices: today.total_services,
        totalAppointments: today.total_appointments,
        appointmentsToday: today.appointments_today,
        companiesWithAppointments: today.companies_with_appointments,
        companiesWithoutAppointments: today.companies_without_appointments,
        estimatedRevenue: today.estimated_revenue_today,
        estimatedRevenueToday: today.estimated_revenue_today,
        companiesGrowth: calculateGrowth(today.total_companies, 0),
        usersGrowth: 0,
        appointmentsGrowth: calculateGrowth(today.appointments_today, yesterday.appointments_yesterday),
        revenueGrowth: calculateGrowth(today.estimated_revenue_today, yesterday.revenue_yesterday),
        revenueYesterday: yesterday.revenue_yesterday || 0,
    });
});

// ---------------------------------------------------------------------------
// GET /api/superadmin/recent-companies — últimas empresas creadas
// ---------------------------------------------------------------------------
router.get('/recent-companies', requireRole('super_admin'), async (req, res) => {
    const { rows } = await query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.active,
      c.created_at,
      u.name AS admin_name
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id AND u.role = 'admin'
    ORDER BY c.created_at DESC
    LIMIT 10
  `);

    res.json(rows.map((c) => ({
        ...c,
        adminName: c.admin_name,
    })));
});

// ---------------------------------------------------------------------------
// GET /api/superadmin/recent-activity — actividad reciente de la plataforma
// ---------------------------------------------------------------------------
router.get('/recent-activity', requireRole('super_admin'), async (req, res) => {
    const { rows } = await query(`
    SELECT
      c.name AS company_name,
      'company_created' AS type,
      c.name AS detail,
      c.created_at
    FROM companies c
    UNION ALL
    SELECT
      c.name AS company_name,
      'user_created' AS type,
      u.name || ' (' || u.role || ')' AS detail,
      u.created_at
    FROM users u
    JOIN companies c ON c.id = u.company_id
    UNION ALL
    SELECT
      c.name AS company_name,
      'appointment_created' AS type,
      a.client_name || ' — ' || a.service_name AS detail,
      a.created_at
    FROM appointments a
    JOIN companies c ON c.id = a.company_id
    ORDER BY created_at DESC
    LIMIT 50
  `);

    res.json(rows.map((r) => ({
        companyName: r.company_name,
        type: r.type,
        detail: r.detail,
        created_at: r.created_at,
    })));
});

// ---------------------------------------------------------------------------
// GET /api/superadmin/top-companies — top negocios por citas del día
// ---------------------------------------------------------------------------
router.get('/top-companies', requireRole('super_admin'), async (req, res) => {
    const { rows } = await query(`
    SELECT
      c.id,
      c.name,
      c.slug,
      COUNT(a.id) AS appointments_today,
      COALESCE(SUM(s.price), 0) AS estimated_revenue
    FROM companies c
    LEFT JOIN appointments a
      ON a.company_id = c.id AND a.date = CURRENT_DATE
    LEFT JOIN services s
      ON s.name = a.service_name
     AND s.company_id = c.id
    GROUP BY c.id, c.name, c.slug
    ORDER BY appointments_today DESC, estimated_revenue DESC
    LIMIT 10
  `);

    res.json(rows.map((c) => ({
        ...c,
        appointmentsToday: c.appointments_today,
        estimatedRevenue: c.estimated_revenue,
    })));
});

export default router;