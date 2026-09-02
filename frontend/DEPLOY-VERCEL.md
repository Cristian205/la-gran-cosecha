# Despliegue del frontend en Vercel

Este directorio tiene **dos aplicaciones Vite independientes**, cada una con su
propio `package.json` y su propio `vercel.json`:

| App | Directorio | Qué es |
|---|---|---|
| `crynex-tienda` | `frontend/tienda` | Tienda pública (Next.js) |
| `lgc-admin-panel` | `frontend/admin-panel` | Panel administrativo |

Vercel despliega **un directorio por proyecto**, así que hay que crear
**dos proyectos** apuntando al mismo repositorio de GitHub.

---

## Antes de empezar: el backend tiene que estar desplegado

Vercel solo sirve archivos estáticos. **No puede ejecutar Django.** El frontend
compilado llama por HTTP a la API, así que el backend tiene que estar publicado
en algún sitio con soporte para Python (Render, Railway, Fly.io, un VPS…) y ser
accesible por HTTPS desde internet.

Mientras el backend solo exista en `localhost:8000`, el frontend desplegado
compila y carga, pero **todas las peticiones a la API fallan**.

---

## Repositorio

El repositorio git real es este directorio (`la-gran-cosecha/`), con remoto en
`github.com/Cristian205/la-gran-cosecha.git`. El directorio *padre* también
tiene un `.git`, pero está vacío y sin remoto: no es el que hay que conectar.

Al importar en Vercel, elige el repo `Cristian205/la-gran-cosecha`.

---

## Proyecto 1 — Storefront

En Vercel: **Add New > Project > Import** el repo, y luego:

| Ajuste | Valor |
|---|---|
| Root Directory | `frontend/tienda` |
| Framework Preset | Vite (se detecta solo) |
| Build Command | `npm run build` (ya viene en `vercel.json`) |
| Output Directory | `dist` (ya viene en `vercel.json`) |

**Environment Variables** (Settings > Environment Variables):

```
VITE_API_URL = https://TU-BACKEND/api
```

URL absoluta, con `https://`, terminada en `/api` y **sin barra final**.

## Proyecto 2 — Admin panel

Igual, pero con Root Directory = `frontend/admin-panel` y la misma
`VITE_API_URL`.

---

## Ojo con las variables de entorno de Vite

Vite **incrusta** las variables `VITE_*` en el JavaScript durante el build, no
las lee en tiempo de ejecución. Dos consecuencias:

1. Si cambias `VITE_API_URL` en Vercel, hay que **volver a desplegar** para que
   tenga efecto. Cambiarla y recargar la página no basta.
2. **Nunca** pongas un secreto en una variable `VITE_*`: acaba en el bundle
   público y cualquiera puede leerlo.

---

## Configurar el backend para aceptar a Vercel

Una vez tengas los dominios de Vercel, en el `.env` del backend:

```
DJANGO_ALLOWED_HOSTS=tu-backend.com
CORS_ALLOWED_ORIGINS=https://storefront.vercel.app,https://admin.vercel.app
CSRF_TRUSTED_ORIGINS=https://storefront.vercel.app,https://admin.vercel.app
```

Sin esto el navegador bloquea las peticiones por CORS.

Ten en cuenta que Vercel genera un dominio distinto para **cada** despliegue de
preview (`*-git-rama-usuario.vercel.app`). Esos dominios no estarán en la lista
de CORS, así que las previews no podrán hablar con la API salvo que añadas cada
una, uses `CORS_ALLOWED_ORIGIN_REGEX` en el backend, o pruebes solo en producción.

---

## Qué ya está resuelto en `vercel.json`

- **Rewrite SPA**: ambas apps usan `BrowserRouter`. Sin la regla
  `/(.*) -> /index.html`, entrar directo a una ruta (o recargar en ella) daría
  **404**. Es el fallo más común al subir un SPA a Vercel.
- **Caché de assets**: `/assets/*` con `max-age=1 año, immutable`. Es seguro
  porque Vite pone un hash en cada nombre de archivo.
- **Cabeceras de seguridad**: `nosniff` y `Referrer-Policy` en ambas; el panel
  añade además `X-Frame-Options: DENY` y `X-Robots-Tag: noindex` para que no
  lo indexen los buscadores ni se pueda embeber en un iframe.

## Pendiente: las imágenes

Las imágenes de productos y categorías las sirve Django desde disco local
(`backend/media/`). El serializer devuelve URLs absolutas al host del backend,
así que **funcionarán** siempre que el backend esté desplegado y sirva `/media/`.

Pero la mayoría de plataformas tienen disco efímero: en cada despliegue se
pierde lo subido. Para producción de verdad hay que mover `media/` a un
almacenamiento externo (Supabase Storage, S3, Cloudinary) con `django-storages`.
