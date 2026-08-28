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
pytest -m tenancy          # aislamiento multi-tenant — en verde desde la fase 3
```

Dos suites con propósitos opuestos:

- **`tests/test_regresion.py`** protege lo que hoy funciona (catálogo público,
  creación de pedidos, permisos, OTP, configuración del sitio). Si se pone en
  rojo durante el refactor multi-tenant, es que se rompió algo que el negocio
  ya usaba.
- **`tests/test_aislamiento.py`** es la definición ejecutable de "ningún negocio
  accede a datos de otro": listados, detalle, escritura, borrado, resolución por
  dominio, unicidad, pertenencia y archivos. Nació en rojo y describe lo que las
  fases 1 a 3 construyeron. **Verde desde la fase 3**, salvo dos pruebas de RLS
  que se saltan sin PostgreSQL y una marcada `media_por_tenant`, que es de la
  fase 6 (prefijos de R2).

`config/settings/test.py` **fuerza la base de datos local** (SQLite en memoria
por defecto). Es deliberado: `backend/.env` apunta a la Supabase de producción,
y sin ese override `pytest` intentaría crear su base de pruebas allí. Para las
pruebas de Row-Level Security, que necesitan PostgreSQL real:

```bash
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/lgc_test pytest -m tenancy
```

## Multiempresa

La plataforma sirve a varios negocios (*tenants*) desde un mismo núcleo. La Gran
Cosecha es el primero, no un caso especial: no hay ninguna rama de código que la
distinga de una perfumería.

### El negocio se resuelve por dominio

Cada petición resuelve su negocio en `apps/tenancy/middleware.py`, por el claim
`tenant_id` del JWT, por el `Host` contra la tabla `Domain`, o por la cabecera
`X-Tenant` (solo en desarrollo y tests). **Si no resuelve ninguno, la respuesta
es 404**: sin negocio no hay datos que servir.

Por eso los hostnames tienen que estar dados de alta:

```bash
python manage.py dominios                                  # ver los registrados
python manage.py dominios --negocio la-gran-cosecha \n    --añadir tienda.ejemplo.com --primario
```

La migración `tenancy.0004` registra automáticamente los de `ALLOWED_HOSTS` al
desplegar, mientras solo haya un negocio.

### Trabajar con el ORM

Los modelos de negocio fallan **cerrado**: sin ámbito declarado, consultarlos
lanza `SinTenantEnContexto` en vez de devolver las filas de todos los negocios.
Dentro de una petición el middleware ya lo declara. Fuera —shell, comandos,
tareas— hay que declararlo:

```python
from apps.tenancy.context import usar_tenant, ambito_de_plataforma

with usar_tenant(tenant):
    Producto.objects.count()        # solo los suyos

with ambito_de_plataforma():
    Producto.objects.count()        # todos, declarado a propósito

Producto.all_tenants.count()        # escotilla explícita, sin contexto
```

Esto incluye las relaciones inversas: `producto.presentaciones` y
`pedido.detalles` usan el manager con ámbito, así que en el shell también
necesitan un `with usar_tenant(...)`.

### Tres capas de aislamiento

1. **Manager** (`apps/tenancy/managers.py`) — filtra por defecto y falla cerrado.
2. **Vista** (`apps/tenancy/viewsets.py`) — vuelve a filtrar, exige pertenencia
   al negocio y asigna el tenant al crear, nunca desde el cuerpo.
3. **Row-Level Security** (`tenancy.0003`) — la política de PostgreSQL, que
   sigue en pie aunque el ORM falle.

> **RLS y Supabase.** La política no se aplica a roles con `SUPERUSER` ni
> `BYPASSRLS`, y el rol `postgres` de Supabase tiene ambos. Hace falta un rol
> dedicado para la aplicación y apuntar `DATABASE_URL` a él; hasta entonces la
> tercera capa está declarada pero inerte. Lo comprueba
> `test_el_rol_de_la_aplicacion_no_puede_saltarse_rls`.

### Permisos

El acceso lo concede la `Membership` de la persona en el negocio, no
`is_staff` ni el `user_permissions` de Django —que es global y no puede
expresar «edita productos aquí pero no allá»—. Los roles `OWNER` y `ADMIN`
tienen acceso total; el resto, los codenames de `Membership.permisos`.

## Notas de migración

- Los modelos conservan sus **nombres de tabla originales** (`ui_*`) mediante
  `Meta.db_table`, por lo que una base de datos existente se puede reutilizar
  aplicando `python manage.py migrate --fake-initial`.
- El árbol Django antiguo de la raíz (`apps/ui/`, `config/`, `manage.py`) fue
  **eliminado**: eran ~3 200 líneas que declaraban modelos sobre estas mismas
  tablas `ui_*` y confundían migraciones y búsquedas. Sigue disponible en el
  historial de git si hace falta consultarlo.
