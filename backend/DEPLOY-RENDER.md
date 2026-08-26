# Despliegue del backend en Render

## Por qué Docker y no el runtime nativo de Python

El backend genera facturas en PDF con **WeasyPrint**, que necesita librerías de
sistema (Pango, Cairo, gdk-pixbuf). El runtime nativo de Python de Render no
permite instalar paquetes `apt`, así que hay que usar el runtime **Docker**.
El [`Dockerfile`](Dockerfile) ya las instala.

---

## Opción A — Blueprint (recomendada)

En Render: **New > Blueprint**, conectar el repositorio
`Cristian205/la-gran-cosecha` y elegir la rama. Render lee
[`render.yaml`](../render.yaml) (en la raíz del repo) y crea el servicio con el
disco, el health check y las variables ya configurados. Solo pedirá los valores
marcados como `sync: false`.

## Opción B — Manual

**New > Web Service**, conectar el repo y configurar:

| Ajuste | Valor |
|---|---|
| Runtime | Docker |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Build Context | `./backend` |
| Health Check Path | `/healthz` |

---

## Variables de entorno

| Variable | Valor |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` |
| `DJANGO_SECRET_KEY` | Una cadena larga y aleatoria. En el blueprint la genera Render. |
| `DJANGO_ALLOWED_HOSTS` | Tu dominio propio, si lo hay. Puede quedar vacío. |
| `DATABASE_URL` | La cadena del **pooler** de Supabase |
| `CORS_ALLOWED_ORIGINS` | Los dominios de Vercel, con `https://` y separados por coma |
| `CSRF_TRUSTED_ORIGINS` | Los mismos dominios |
| `MEDIA_ROOT` | `/app/media` |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Cuenta de Gmail y contraseña **de aplicación** |
| `DEFAULT_FROM_EMAIL` | La misma dirección que `EMAIL_HOST_USER`, o Gmail rechaza el envío |
| `WEB_CONCURRENCY` | `2` |
| `R2_*` | Credenciales de Cloudflare R2, ver [CLOUDFLARE-R2.md](CLOUDFLARE-R2.md) |
| `BREVO_API_KEY` | Clave de API de Brevo. **Sin ella el correo OTP no sale**, ver abajo |

No hace falta poner el dominio `*.onrender.com` en `DJANGO_ALLOWED_HOSTS`:
`prod.py` lo añade solo leyendo `RENDER_EXTERNAL_HOSTNAME`.

**`DATABASE_URL` debe usar el pooler**
(`aws-0-<region>.pooler.supabase.com:5432`), nunca `db.<ref>.supabase.co`, que
solo resuelve por IPv6 y da un timeout de conexión desde Render.

---

## Los archivos subidos van a Cloudflare R2

El sistema de archivos de un contenedor de Render es **efímero**: se borra en
cada despliegue, y el plan free no admite discos persistentes. Por eso las
imágenes de productos y categorías se guardan en un bucket de **Cloudflare R2**,
no en el servidor.

El código ya está preparado; solo hay que crear el bucket y pegar las
credenciales. El procedimiento completo está en **[CLOUDFLARE-R2.md](CLOUDFLARE-R2.md)**,
incluido el comando `subir_media_a_r2` para subir las imágenes que ya tienes.

Mientras falte alguna de las variables `R2_*`, Django guarda en disco local y
las imágenes se perderán en el siguiente despliegue.

---

## Cómo arranca el contenedor

`collectstatic` corre en el **build** de la imagen: no toca la base de datos y
su resultado es idéntico en todos los contenedores, así que no tiene sentido
repetirlo en cada arranque.

Al arrancar, el contenedor ejecuta `migrate` y luego gunicorn. Sobre la base de
Supabase actual `migrate` no hará nada (las 37 migraciones ya están aplicadas),
pero deja el despliegue preparado para futuros cambios de modelos.

Gunicorn escucha en `$PORT`, que inyecta Render. El `--timeout 120` está puesto
porque generar una factura con WeasyPrint puede pasar de los 30 s por defecto.

---

## Conectar con el frontend de Vercel

Una vez desplegado, Render te da una URL como
`https://lgc-backend.onrender.com`. Hay que cerrar el círculo por los dos lados:

1. **En Vercel**, en cada uno de los dos proyectos:
   `VITE_API_URL = https://lgc-backend.onrender.com/api` y **volver a
   desplegar** (Vite incrusta la variable en el build, no la lee en runtime).
2. **En Render**, poner los dominios de Vercel en `CORS_ALLOWED_ORIGINS` y
   `CSRF_TRUSTED_ORIGINS`.

Ojo con las *previews* de Vercel: cada una tiene un dominio distinto que no
estará en la lista de CORS. O añades cada una, o usas
`CORS_ALLOWED_ORIGIN_REGEX` en el backend, o pruebas solo contra producción.

---

## Después del primer despliegue

- **Health check**: `https://TU-SERVICIO.onrender.com/healthz` debe devolver
  `{"status": "ok", "database": "ok"}`. Si devuelve 503, el contenedor arrancó
  pero no alcanza Supabase — revisa `DATABASE_URL`.
- **Usuarios**: ya hay 3 en la base de datos migrada. Si necesitas otro
  superusuario, usa la shell de Render:
  `python manage.py createsuperuser`.
- **Correo OTP**: el login del panel manda un código por correo.

  **Render bloquea las conexiones salientes por los puertos de SMTP** (25, 465,
  587) en las instancias free. El backend SMTP de Django falla ahí con
  `OSError: [Errno 101] Network is unreachable` al abrir el socket, antes
  siquiera de autenticarse — así que unas credenciales de Gmail correctas no
  arreglan nada.

  Por eso, con `BREVO_API_KEY` puesta, `prod.py` envía por la API HTTPS de
  Brevo (puerto 443). Hay que verificar la dirección de `EMAIL_HOST_USER` como
  remitente en **Brevo > Senders**, o Brevo rechaza el envío.

  Sin esa clave el login del panel queda bloqueado: no hay forma de recibir el
  código.

## Plan gratuito

El plan gratuito de Render **duerme el servicio tras 15 minutos sin tráfico**, y
despertarlo tarda entre 30 y 60 segundos. La primera visita a la tienda después
de un rato de inactividad se sentirá rota. Para algo de cara al público, el
plan Starter es el mínimo razonable.

Lo que ya no es un problema en el plan free son las imágenes: al estar en
Cloudflare R2 no dependen del disco del contenedor.
