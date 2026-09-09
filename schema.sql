CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cada fila = un negocio que tiene el sistema de citas
CREATE TABLE IF NOT EXISTS companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usuarios: super_admin (sin company_id), admin y employee (con company_id)
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  phone         TEXT        DEFAULT '',
  role          TEXT        NOT NULL CHECK (role IN ('super_admin', 'admin', 'employee')),
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  email      TEXT        DEFAULT '',
  notes      TEXT        DEFAULT '',
  tags       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, phone)
);

CREATE TABLE IF NOT EXISTS services (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  duration_minutes INTEGER      NOT NULL DEFAULT 60,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  active           BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS appointments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id     UUID        REFERENCES clients(id) ON DELETE SET NULL,
  employee_id   UUID        REFERENCES users(id)   ON DELETE SET NULL,
  client_name   TEXT        NOT NULL,
  client_phone  TEXT        NOT NULL,
  service_name  TEXT        NOT NULL DEFAULT 'Servicio',
  date          DATE        NOT NULL,
  time          TIME        NOT NULL,
  duration      INTEGER     NOT NULL DEFAULT 60,
  status        TEXT        NOT NULL DEFAULT 'pendiente'
                            CHECK (status IN ('pendiente', 'atendiendo', 'realizado')),
  notes         TEXT        DEFAULT '',
  -- reminder_sent se mantiene para uso futuro (email/SMS)
  reminder_sent JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_company          ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company        ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON appointments(company_id, date, time);
