# Despliegue del frontend en Vercel

Este directorio tiene **tres aplicaciones**, y no todas son lo mismo:

| App | Directorio | Qué es | Cómo se compila |
|---|---|---|---|
| `crynex-tienda` | `frontend/tienda` | Tienda pública multiempresa | **Next.js con render en servidor** |
| `lgc-admin-panel` | `frontend/admin-panel` | Panel del negocio | Vite (SPA estática) |
| `crynex-panel` | `frontend/panel-crynex` | Control Center de la plataforma | Vite (SPA estática) |

Vercel despliega **un directorio por proyecto**, así que hace falta un proyecto
por cada una.

> **Si vienes de la versión anterior de este documento:** decía que la tienda
> era Vite y que se servía desde `dist`. Ya no. La tienda se migró a Next.js
> porque cada negocio necesita posicionarse por separado, y eso exige que el
> HTML salga del servidor con el catálogo dentro. Un proyecto de Vercel
> configurado con el preset de Vite y `dist` como salida **no la puede
> desplegar**: Next compila a `.next` y Vercel no encuentra nada.

---

## Lo primero: el proyecto viejo hay que retirarlo

`frontend/storefront/` **ya no existe** — era la tienda de Vite y se borró al
unificar. Un proyecto de Vercel cuyo *Root Directory* siga apuntando ahí falla
antes de empezar, porque el directorio no está en el repositorio.

En Vercel: borra ese proyecto, o cámbiale el *Root Directory* a
`frontend/tienda` **y el Framework Preset a Next.js**. Si tenía un dominio
asignado, muévelo al proyecto nuevo antes de borrarlo o la tienda se queda sin
dirección.

---

## Antes de empezar: el backend tiene que estar desplegado

La tienda llama a Django **desde el servidor de Vercel**, no desde el navegador.
Así que el backend tiene que estar publicado con HTTPS y ser accesible desde
internet (Render, Railway, Fly.io, un VPS…). Mientras solo exista en
`localhost:8000`, la tienda desplegada compila y devuelve 404 en todas las
rutas: sin backend no hay negocio que resolver.

---

## Proyecto 1 — la tienda (Next.js)

**Add New > Project > Import** el repo `Cristian205/la-gran-cosecha`, y luego:

| Ajuste | Valor |
|---|---|
| Root Directory | `frontend/tienda` |
| Framework Preset | **Next.js** |
| Build Command | por defecto (`next build`) |
| Output Directory | **por defecto — dejarlo vacío** |
| Install Command | por defecto |

No hay `vercel.json` en la tienda y no debe haberlo: Vercel detecta Next solo, y
un `outputDirectory` escrito a mano es justo lo que rompe el despliegue.

### Variables de entorno

Son de **servidor**, no llevan prefijo `VITE_` ni `NEXT_PUBLIC_` salvo donde se
indica, y **no se incrustan en el bundle**: se leen en cada petición.

| Variable | Ejemplo | Para qué |
|---|---|---|
| `API_URL` | `https://tu-backend.com/api` | A qué Django llamar. Sin barra final. |
| `TENANCY_CLAVE_SERVIDOR` | *(la del `.env` del backend)* | Acredita la llamada de servidor a servidor. **Es un secreto.** |
| `DOMINIO_PLATAFORMA` | `crynex.app` | El dominio bajo el cual `negocio.crynex.app` resuelve al negocio «negocio». |
| `REVALIDAR_SEGUNDOS` | `60` | Cuánto se cachea el catálogo. Opcional. |
| `NEXT_PUBLIC_MEDIA_HOST` | `pub-xxx.r2.dev` | El dominio del bucket, para que `next/image` acepte las fotos. Opcional. |
| `NEXT_PUBLIC_PANEL_URL` | `https://panel.crynex.app` | A dónde manda el enlace de «entrar al panel». Opcional. |

`TENANCY_CLAVE_SERVIDOR` **no puede llevar `NEXT_PUBLIC_`**. Con ese prefijo
acabaría en el JavaScript que descarga el navegador, y entonces cualquiera podría
pedirle a Django el catálogo de cualquier negocio.

### Los dominios: aquí está la diferencia con un frontend normal

Una sola instancia sirve **todas** las tiendas, y lo único que las distingue es
el `Host` de la petición. Así que el proyecto necesita:

1. **Un dominio comodín** `*.crynex.app` apuntando a este proyecto, para los
   subdominios de la plataforma. Los comodines requieren plan Pro en Vercel.
2. **Cada dominio propio** de cliente añadido al mismo proyecto, y dado de alta
   en la tabla `Domain` del backend. La fuente de verdad de qué host es de quién
   es esa tabla, no Vercel.

Un host que no esté en `Domain` devuelve 404 a propósito: es la ausencia de
tienda, no un error.

---

## Proyectos 2 y 3 — los paneles (Vite)

| Ajuste | `lgc-admin-panel` | `crynex-panel` |
|---|---|---|
| Root Directory | `frontend/admin-panel` | `frontend/panel-crynex` |
| Framework Preset | Vite | Vite |
| Output Directory | `dist` | `dist` |

Variables:

```
VITE_API_URL = https://tu-backend.com/api
```

Y en el Control Center, además, la tienda contra la que previsualiza plantillas:

```
VITE_TIENDA_URL = https://una-tienda-real.crynex.app
```

### Ojo con las variables de Vite

Vite **incrusta** las `VITE_*` en el JavaScript durante el build. Dos
consecuencias:

1. Cambiarlas en Vercel no basta: hay que **volver a desplegar**.
2. **Nunca** un secreto en una `VITE_*`: acaba en el bundle público.

Esto no aplica a la tienda: allí las variables se leen en el servidor en cada
petición, así que cambiarlas y redesplegar solo hace falta para las
`NEXT_PUBLIC_*`.

---

## Configurar el backend para aceptar a Vercel

En el `.env` del backend:

```
DJANGO_ALLOWED_HOSTS=tu-backend.com
CORS_ALLOWED_ORIGINS=https://panel.crynex.app,https://admin.crynex.app
CSRF_TRUSTED_ORIGINS=https://panel.crynex.app,https://admin.crynex.app
```

**La tienda no necesita estar en CORS.** Sus llamadas salen del servidor de
Vercel, no del navegador, así que no hay origen que comprobar. Lo que sí
necesita es que `TENANCY_CLAVE_SERVIDOR` coincida a los dos lados.

Vercel genera un dominio distinto para **cada** despliegue de preview
(`*-git-rama-usuario.vercel.app`). Esos no estarán en CORS, así que las previews
de los paneles no podrán hablar con la API salvo que uses
`CORS_ALLOWED_ORIGIN_REGEX` o pruebes solo en producción.

---

## Qué resuelve `vercel.json`, y dónde

Solo en los **paneles**, que son SPA:

- **Rewrite** `/(.*) -> /index.html`. Sin él, entrar directo a una ruta o
  recargar en ella da 404. Es el fallo más común al subir un SPA.
- **Caché de assets** con `max-age` de un año e `immutable`: es seguro porque
  Vite pone un hash en cada nombre.
- **Cabeceras**: `nosniff` y `Referrer-Policy`; los paneles añaden
  `X-Frame-Options: DENY` y `X-Robots-Tag: noindex`.

La tienda **no lleva `vercel.json`**. Sus rutas las resuelve Next en el
servidor, y `X-Frame-Options: DENY` allí sería un error: el constructor la
enmarca en un iframe para la vista previa.

---

## Si el despliegue falla, en este orden

1. **«No such file or directory» / no encuentra `package.json`** → el *Root
   Directory* apunta a `frontend/storefront`, que ya no existe.
2. **Compila y no encuentra la salida** → el Framework Preset es Vite o el
   *Output Directory* dice `dist`. La tienda es Next y compila a `.next`.
3. **404 en todas las rutas** → el host por el que entras no está en la tabla
   `Domain` del backend, o `API_URL` no apunta a un Django accesible.
4. **La tienda carga sin catálogo** → `TENANCY_CLAVE_SERVIDOR` no coincide con
   la del backend. El backend ignora la llamada y responde como si no hubiera
   negocio.

---

## Alternativa: Docker

`frontend/tienda/Dockerfile` construye una imagen que sirve la tienda con
`node server.js`. Enciende `SALIDA_STANDALONE=1`, que es lo que hace que Next
empaquete el servidor con sus dependencias.

Esa variable **solo se pone ahí**. En Vercel el empaquetado lo hace la
plataforma, y declarar `output: "standalone"` la deja compilando una salida que
luego no sabe servir.

---

## Pendiente: las imágenes

Las fotos de productos y categorías las sirve Django desde disco local
(`backend/media/`) mientras no haya `USE_R2`. Funciona, pero la mayoría de
plataformas tienen disco efímero: en cada despliegue se pierde lo subido. Para
producción de verdad van en Cloudflare R2 —ya está soportado— o en cualquier
almacenamiento externo con `django-storages`.
