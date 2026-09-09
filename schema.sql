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
-- Al borrar un negocio, todos sus usuarios se borran automáticamente (ON DELETE CASCADE)
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

-- Servicios del negocio
-- Al borrar un negocio, todos sus servicios se borran automáticamente (ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS services (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  duration_minutes INTEGER      NOT NULL DEFAULT 60,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  active           BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Citas del negocio
-- Al borrar un negocio, todas sus citas se borran automáticamente (ON DELETE CASCADE)
CREATE TABLE IF NOT EXISTS appointments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  client_name   TEXT        NOT NULL,
  client_phone  TEXT        NOT NULL,
  service_name  TEXT        NOT NULL DEFAULT 'Servicio',
  date          DATE        NOT NULL,
  time          TIME        NOT NULL,
  duration      INTEGER     NOT NULL DEFAULT 60,
  status        TEXT        NOT NULL DEFAULT 'pendiente'
                            CHECK (status IN ('pendiente', 'atendiendo', 'realizado')),
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_company             ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_services_company          ON services(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON appointments(company_id, date, time);
