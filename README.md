# La Gran Cosecha — Plataforma de venta por pedido

Monorepo reestructurado en **backend** (API REST) y **frontend** (dos apps React
independientes). El backend es un monolito Django modular; cada frontend tiene sus
propias dependencias.

```
La-Gran-cosecha/
├─ backend/              API REST (Django + DRF + JWT)
│  ├─ config/settings/   base / dev / prod
│  └─ apps/
│     ├─ common/         permisos, paginación, utilidades
│     ├─ accounts/       usuarios + login OTP + JWT
│     ├─ catalog/        categorías, unidades, productos, presentaciones
│     └─ orders/         clientes, pedidos, detalles, estadísticas
├─ frontend/
│  ├─ storefront/        ecommerce del cliente (React + Vite + TS) — puerto 5173
│  └─ admin-panel/       panel administrativo (React + Vite + TS) — puerto 5174
└─ docker-compose.yml    db + backend + ambos frontends
```

## Arquitectura

- **Cliente (storefront):** navega el catálogo, arma su carrito y genera pedidos
  **sin cuenta** (se identifica con nombre/teléfono/dirección al ordenar).
- **Administración (admin-panel):** login con **OTP por correo** (2 pasos) → JWT.
  Gestiona productos, pedidos, clientes, usuarios y ve estadísticas.
- **API:** `/api/auth/…`, `/api/catalog/…`, `/api/orders/…`, `/api/clients/…`,
  `/api/admin/stats/`. Lectura del catálogo es pública; el resto requiere JWT.

## Puesta en marcha — desarrollo local

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env         # ajusta credenciales (o usa el default de PostgreSQL)
python manage.py migrate
python manage.py createsuperuser   # crea el primer usuario admin (para el panel)
python manage.py runserver         # http://localhost:8000
```

> Con `EMAIL_BACKEND=console` (default en dev) el código OTP se imprime en la
> terminal del backend al iniciar sesión, sin necesidad de SMTP real.

### 2. Storefront (cliente)

```bash
cd frontend/storefront
npm install
npm run dev        # http://localhost:5173  (proxy /api → :8000)
```

### 3. Admin-panel

```bash
cd frontend/admin-panel
npm install
npm run dev        # http://localhost:5174  (proxy /api → :8000)
```

## Puesta en marcha — Docker (todo en uno)

```bash
docker compose up --build
```

- Storefront:   http://localhost:8080
- Admin-panel:  http://localhost:8081
- API:          http://localhost:8000/api
- Django admin: http://localhost:8000/admin

Para crear el primer admin dentro del contenedor:

```bash
docker compose exec backend python manage.py createsuperuser
```

## Notas de migración

- Los modelos conservan sus **nombres de tabla originales** (`ui_*`) mediante
  `Meta.db_table`, por lo que una base de datos existente se puede reutilizar
  aplicando `python manage.py migrate --fake-initial`.
- El árbol Django antiguo en la **raíz** del repo (`apps/ui/`, `config/`,
  `manage.py`, `db.sqlite3`) quedó **superado** por `backend/`. Se conserva por
  ahora como referencia; puede eliminarse una vez validada la nueva estructura.
- Fase posterior (aún no migrada): factura PDF, biblioteca multimedia, banners,
  historial de precios en UI y estadísticas avanzadas.
