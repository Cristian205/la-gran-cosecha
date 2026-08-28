# La Gran Cosecha — Plataforma de venta por pedido

Monorepo reestructurado en **backend** (API REST) y **frontend** (dos apps React
independientes). El backend es un monolito Django modular; cada frontend tiene sus
propias dependencias.

```
La-Gran-cosecha/
├─ backend/              API REST (Django + DRF + JWT)
│  ├─ config/settings/   base / dev / prod / test
│  ├─ tests/             regresión + aislamiento multi-tenant
│  └─ apps/
│     ├─ common/         permisos, paginación, utilidades
│     ├─ accounts/       usuarios + login OTP + JWT
│     ├─ catalog/        categorías, unidades, productos, presentaciones
│     ├─ orders/         clientes, pedidos, detalles, lotes, estadísticas, PDF
│     ├─ content/        configuración del sitio, banners, testimonios, ofertas
│     ├─ media/          biblioteca de archivos (Cloudflare R2)
│     ├─ notifications/  centro de notificaciones del panel
│     └─ contact/        mensajes del formulario público
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

## Tests

```bash
cd backend
pip install -r requirements-dev.txt

pytest -m "not tenancy"    # regresión — debe estar SIEMPRE en verde
pytest -m tenancy          # aislamiento multi-tenant — rojo hasta la fase 3
```

Dos suites con propósitos opuestos:

- **`tests/test_regresion.py`** protege lo que hoy funciona (catálogo público,
  creación de pedidos, permisos, OTP, configuración del sitio). Si se pone en
  rojo durante el refactor multi-tenant, es que se rompió algo que el negocio
  ya usaba.
- **`tests/test_aislamiento.py`** describe el comportamiento multi-tenant que
  todavía no existe, y **falla a propósito**. Es la definición ejecutable de
  "ningún tenant accede a datos de otro". Ningún segundo negocio real se da de
  alta hasta que esta suite pase entera.

`config/settings/test.py` **fuerza la base de datos local** (SQLite en memoria
por defecto). Es deliberado: `backend/.env` apunta a la Supabase de producción,
y sin ese override `pytest` intentaría crear su base de pruebas allí. Para las
pruebas de Row-Level Security, que necesitan PostgreSQL real:

```bash
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/lgc_test pytest -m tenancy
```

## Notas de migración

- Los modelos conservan sus **nombres de tabla originales** (`ui_*`) mediante
  `Meta.db_table`, por lo que una base de datos existente se puede reutilizar
  aplicando `python manage.py migrate --fake-initial`.
- El árbol Django antiguo de la raíz (`apps/ui/`, `config/`, `manage.py`) fue
  **eliminado**: eran ~3 200 líneas que declaraban modelos sobre estas mismas
  tablas `ui_*` y confundían migraciones y búsquedas. Sigue disponible en el
  historial de git si hace falta consultarlo.
