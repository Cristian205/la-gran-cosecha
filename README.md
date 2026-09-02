# CryneX — Plataforma modular de gestión, POS y e-commerce

Un solo núcleo con módulos configurables, sirviendo a varios negocios a la vez.
El backend es un monolito Django modular; cada frontend tiene sus propias
dependencias.

```
crynex/
├─ backend/              API REST (Django + DRF + JWT)
│  ├─ config/settings/   base / dev / prod / test
│  ├─ tests/             regresión, aislamiento, motor, inventario, POS
│  └─ apps/
│     ├─ common/         permisos, paginación, utilidades
│     ├─ tenancy/        negocios, dominios, pertenencias, aislamiento
│     ├─ accounts/       identidad de plataforma, login OTP, JWT
│     ├─ billing/        catálogo comercial, planes, límites, suscripción
│     ├─ business/       perfil de negocio, presets, módulos activos
│     ├─ catalog/        categorías, unidades, productos, presentaciones
│     ├─ inventory/      existencias, movimientos, ubicaciones
│     ├─ orders/         clientes, pedidos, lotes, estadísticas, PDF
│     ├─ pos/            turnos de caja, ventas, medios de pago
│     ├─ storefront/     motor de tiendas: bloques, temas, plantillas, páginas
│     ├─ content/        configuración del sitio, banners, testimonios, ofertas
│     ├─ media/          biblioteca de archivos (Cloudflare R2)
│     ├─ notifications/  centro de notificaciones del panel
│     └─ contact/        mensajes del formulario público
├─ frontend/
│  ├─ tienda/            tienda pública (Next.js + TS) — puerto 3000
│  ├─ admin-panel/       panel del negocio (React + Vite + TS) — puerto 5174
│  └─ panel-crynex/      panel de la plataforma (React + Vite + TS) — puerto 5176
└─ docker-compose.yml    db + backend + tienda + panel
```

> **La tienda vieja en Vite (`frontend/storefront`) se retiró.** Servía las
> mismas cinco rutas, pero como aplicación de una sola página: el rastreador
> recibía un HTML vacío y el catálogo llegaba después, por JavaScript. Con una
> tienda por negocio eso significaba que ninguna se posicionaba. `tienda`
> renderiza en el servidor y compone sus páginas desde el motor, así que
> mantener las dos era escribir cada bloque nuevo dos veces.

## Arquitectura

- **Tienda (`tienda`):** navega el catálogo, arma su carrito y genera pedidos
  **sin cuenta** (se identifica con nombre/teléfono/dirección al ordenar). Sus
  páginas no están escritas en código: son composiciones de bloques que cada
  negocio edita desde el panel.
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

### 2. Tienda pública

```bash
cd frontend/tienda
cp .env.example .env.local     # API_URL, TENANCY_CLAVE_SERVIDOR, DOMINIO_PLATAFORMA
npm install
npm run dev        # http://localhost:3000
```

> La clave `TENANCY_CLAVE_SERVIDOR` acredita que la llamada viene de este
> servidor y no de un navegador. Nunca lleva prefijo `NEXT_PUBLIC_`: eso la
> incrustaría en el paquete que descarga el cliente y cualquiera podría pedir
> el catálogo de cualquier negocio.

### 3. Panel del negocio

```bash
cd frontend/admin-panel
npm install
npm run dev        # http://localhost:5174  (proxy /api → :8000)
```

### 4. Panel de la plataforma

```bash
cd frontend/panel-crynex
npm install
npm run dev        # http://localhost:5176  (proxy /api → :8000)
```

## Puesta en marcha — Docker (todo en uno)

```bash
docker compose up --build
```

- Tienda:       http://localhost:8080
- Panel:        http://localhost:8081
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
python manage.py dominios --negocio la-gran-cosecha \
    --añadir tienda.ejemplo.com --primario
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

### La sesión y el negocio activo

El negocio activo viaja **firmado dentro del JWT** (claim `tenant_id`), en el
refresh además del access: si fuera solo en el access, el panel se quedaría sin
negocio en la primera renovación.

El claim solo **elige**; no concede. La pertenencia se comprueba en cada
petición, así que dar de baja a alguien surte efecto de inmediato aunque su
token siga vivo — sin listas negras ni tokens de vida corta.

Quien trabaja en varios negocios entra en el primero y cambia desde el selector
de la barra lateral, que llama a `POST /api/auth/cambiar-negocio/` y recibe un
par de tokens nuevo. El panel recarga al cambiar: casi toda la pantalla
pertenece al negocio anterior, y vaciar cada caché a mano dejaría antes o
después algún dato del negocio equivocado a la vista.

### Permisos

El acceso lo concede la `Membership` de la persona en el negocio, no
`is_staff` ni el `user_permissions` de Django —que es global y no puede
expresar «edita productos aquí pero no allá»—. Los roles `OWNER` y `ADMIN`
tienen acceso total; el resto, los codenames de `Membership.permisos`.

`Usuario.rol_usuario` se conserva como etiqueta para la interfaz y se mantiene
sincronizado con `Membership.rol` al editarlo, pero **no decide nada**.

## Archivos en Cloudflare R2

Cada negocio vive bajo su propio prefijo:

```
tenants/<uuid-del-negocio>/categorias/<uuid>-mango.webp
tenants/<uuid-del-negocio>/productos/…
tenants/<uuid-del-negocio>/identidad/…      logo y favicon
tenants/<uuid-del-negocio>/banners/…
tenants/<uuid-del-negocio>/biblioteca/2026/08/…
```

Tres decisiones, cada una por su motivo (ver `apps/tenancy/almacenamiento.py`):

- **El UUID del negocio, no su slug.** Los slugs se renombran; el UUID no
  cambia nunca, así que renombrar un negocio no deja sus archivos huérfanos.
- **Un UUID antepuesto al nombre.** Evita que dos negocios que suben `logo.png`
  choquen, y que conociendo el prefijo de uno se puedan adivinar sus archivos.
- **La ruta la construye el servidor.** El nombre lo envía quien sube: usarlo
  tal cual sería *path traversal*. Solo se conserva la extensión, y filtrada
  contra una lista.

Para reubicar los archivos de una instalación anterior a la fase 6:

```bash
python manage.py mover_media_a_negocios --dry-run   # ver qué haría
python manage.py mover_media_a_negocios             # mover
python manage.py mover_media_a_negocios --borrar-origen   # limpiar, ya comprobado
```

Es un comando y no una migración porque mover objetos en un bucket no participa
de la transacción de la base de datos: una migración que fallara a mitad dejaría
filas apuntando a claves inexistentes. Es idempotente, y una fila cuyo archivo
no esté en el almacenamiento se deja como estaba.

> Pendiente para más adelante: separar un bucket privado para documentos. Hoy
> las facturas se generan al vuelo con WeasyPrint y no se persisten, así que no
> hay nada que proteger con URLs firmadas.

## Notas de migración

- Los modelos conservan sus **nombres de tabla originales** (`ui_*`) mediante
  `Meta.db_table`, por lo que una base de datos existente se puede reutilizar
  aplicando `python manage.py migrate --fake-initial`.
- El árbol Django antiguo de la raíz (`apps/ui/`, `config/`, `manage.py`) fue
  **eliminado**: eran ~3 200 líneas que declaraban modelos sobre estas mismas
  tablas `ui_*` y confundían migraciones y búsquedas. Sigue disponible en el
  historial de git si hace falta consultarlo.
