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

No hace falta poner el dominio `*.onrender.com` en `DJANGO_ALLOWED_HOSTS`:
`prod.py` lo añade solo leyendo `RENDER_EXTERNAL_HOSTNAME`.

**`DATABASE_URL` debe usar el pooler**
(`aws-0-<region>.pooler.supabase.com:5432`), nunca `db.<ref>.supabase.co`, que
solo resuelve por IPv6 y da un timeout de conexión desde Render.

---

## Los archivos subidos necesitan un disco persistente

El sistema de archivos de un contenedor de Render es **efímero**: en cada
despliegue se borra. Sin un disco persistente, las imágenes de productos y
categorías desaparecen al primer redeploy.

El blueprint declara un disco de 1 GB montado en `/app/media`, que es donde
apunta `MEDIA_ROOT`. Dos consecuencias que conviene saber de antemano:

1. Los discos requieren un plan **de pago** (Starter o superior). No hay discos
   en el plan gratuito.
2. Un servicio con disco **no puede escalar a varias instancias** ni hacer
   despliegues sin corte: Render para el contenedor viejo antes de arrancar el
   nuevo, así que hay unos segundos de caída en cada deploy.

Si eso molesta, la alternativa es mover `media/` a un almacenamiento externo
(Supabase Storage o S3) con `django-storages`, quitar el disco del blueprint y
recuperar el escalado horizontal.

**Las imágenes que ya tienes son locales.** El disco arranca vacío y
[`.dockerignore`](.dockerignore) excluye `media/` a propósito. Hay que subir a
mano el contenido de `backend/media/` una vez creado el servicio, con
`rsync`/`scp` por SSH de Render, o volviéndolas a cargar desde el panel de admin.

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
- **Correo OTP**: el login del panel manda un código por correo. Si
  `EMAIL_HOST_PASSWORD` está mal, el login queda bloqueado sin mensaje claro —
  los errores de SMTP aparecen en los logs de Render.

## Plan gratuito

El plan gratuito de Render **duerme el servicio tras 15 minutos sin tráfico**, y
despertarlo tarda entre 30 y 60 segundos. La primera visita a la tienda después
de un rato de inactividad se sentirá rota. Además no admite discos, así que las
imágenes no sobrevivirían a los despliegues. Para algo de cara al público, el
plan Starter es el mínimo razonable.
