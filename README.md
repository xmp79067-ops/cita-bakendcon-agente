# Gestión SaaS — Backend v2 (multi-negocio, sin sucursales)

Rediseño sin `branches`: cada `company` es un negocio con un solo local, con su
propia autenticación (JWT + bcrypt, sin Firebase) y su propia instancia de
WhatsApp (Baileys) con QR independiente.

## Variables de entorno obligatorias

- `DATABASE_URL` — Postgres de Railway.
- `JWT_SECRET` — clave larga y aleatoria para firmar tokens.
- `SETUP_SECRET` — clave temporal para crear el primer super_admin (solo se usa una vez).
- `WA_SESSION_DIR` — carpeta persistente (usa el volumen de Railway) donde se guardan las sesiones de WhatsApp, una subcarpeta por company_id.

## Primer arranque

1. Despliega normalmente. `initDatabase()` crea las tablas automáticamente.
2. Crea el primer super_admin (solo funciona una vez, luego el endpoint se autobloquea):

```
POST /api/auth/bootstrap-superadmin
Headers: x-setup-secret: <el mismo valor de SETUP_SECRET>
Body: { "name": "Tu Nombre", "email": "tu@correo.com", "password": "unaClaveSegura" }
```

3. Inicia sesión normal:

```
POST /api/auth/login
Body: { "email": "tu@correo.com", "password": "unaClaveSegura" }
```

Te devuelve `{ token, user }`. Usa `Authorization: Bearer <token>` en el resto de peticiones.

4. Como super_admin, crea un negocio nuevo (esto crea la company y su primer usuario admin):

```
POST /api/companies
Body: { "companyName": "...", "slug": "...", "adminName": "...", "adminEmail": "...", "adminPassword": "..." }
```

5. Para WhatsApp: el admin del negocio llama `POST /api/whatsapp/connect`, luego
   `GET /api/whatsapp/qr` (repetidamente, cada 2-3s) hasta que devuelva una
   imagen (`qrImage`, un data URL PNG) — esa imagen se muestra directo en la web.
