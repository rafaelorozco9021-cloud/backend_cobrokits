# backendkit — Backend CobroKits SaaS

NestJS + TypeORM + TypeScript + PostgreSQL (Neon).

## Env

`.env` ya migrado desde la raíz (DATABASE_URL, JWT_SECRET, EVOLUTION_API_*).
Ver `.env.example` para referencia.

## Instalación

```bash
npm install
```

## DB

```bash
npm run db:setup  # ejecuta database/cobrokits_postgres.sql
npm run db:seed   # seed de ejemplo
```

## Desarrollo

```bash
npm run start:dev # http://localhost:3001
```

- `GET /api/health` — público, healthcheck
- `POST /api/auth/login` — público, setea cookie HttpOnly `token`
- `GET /api/auth`, `GET /api/dashboard`, `GET /api/sellers` — protegidos por JwtAuthGuard (cookie o Bearer)
- CORS habilitado para `CORS_ORIGIN` (default http://localhost:3000)

## Entidades

`src/entities/*` — 10 entidades TypeORM mapeadas a las 14 tablas del SQL (enums: seller_status, payment_method, inventory_movement_type). `synchronize: false` — el SQL es fuente de verdad.

## Migración desde Next

- `src/lib/db.js` → `src/config/typeorm.config.ts` (DataSource)
- `src/lib/jwt.js` → `jsonwebtoken` directo + `JwtAuthGuard`
- `src/api/auth/route.js` → `src/modules/auth/*`
- `src/api/dashboard/route.js` → `src/modules/dashboard/*`
- `middleware/middleware.js` → `JwtAuthGuard` (APP_GUARD)
