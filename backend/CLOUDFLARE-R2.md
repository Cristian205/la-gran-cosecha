# Archivos subidos en Cloudflare R2

El backend guarda las imágenes de productos, categorías y banners en un bucket
de **Cloudflare R2** en lugar del disco del servidor. R2 habla el protocolo de
S3, así que se usa el backend S3 de `django-storages`.

Todo el código está listo. **Solo falta crear el bucket y pegar las
credenciales**: mientras falte cualquiera de las cuatro variables obligatorias,
Django sigue guardando en disco local, que es lo que se quiere en desarrollo.

---

## Por qué

El sistema de archivos de un contenedor de Render es **efímero**: se borra en
cada despliegue. En el plan free no hay discos persistentes, así que sin un
almacenamiento externo las imágenes desaparecen al primer redeploy.

R2 además no cobra por transferencia de salida, que es justo lo que más consume
una tienda llena de fotos.

---

## Paso 1 — Crear el bucket

1. En el panel de Cloudflare, **R2 > Create bucket**.
2. Ponle un nombre (por ejemplo `lgc-media`) y créalo.

## Paso 2 — Hacerlo público

Las imágenes de la tienda las carga el navegador directamente, así que el bucket
tiene que servir lectura pública. Dos opciones:

- **Rápida**: dentro del bucket, **Settings > Public Development URL > Enable**.
  Cloudflare te da un dominio `https://pub-XXXXXXXX.r2.dev`.
- **Recomendada para producción**: **Settings > Custom Domain**, y conectas un
  subdominio propio, por ejemplo `cdn.lagrancosecha.com`.

Guarda esa URL: es el valor de `R2_PUBLIC_URL`.

> Sin `R2_PUBLIC_URL` el sistema igual funciona, pero Django tiene que **firmar**
> cada URL y esas firmas caducan. Para un catálogo público no interesa.

## Paso 3 — Crear el token de API

1. **R2 > API > Manage API Tokens > Create API Token**.
2. Permiso **Object Read & Write**, limitado a tu bucket.
3. Al crearlo te muestra **una sola vez** el *Access Key ID* y el
   *Secret Access Key*. Cópialos ya.

El **Account ID** está en la página principal de R2, en la barra lateral.

## Paso 4 — Poner las variables

En Render, **Environment**:

| Variable | De dónde sale |
|---|---|
| `R2_ACCOUNT_ID` | Panel de R2, barra lateral |
| `R2_ACCESS_KEY_ID` | Del token creado en el paso 3 |
| `R2_SECRET_ACCESS_KEY` | Del token creado en el paso 3 |
| `R2_BUCKET_NAME` | El nombre del bucket, p. ej. `lgc-media` |
| `R2_PUBLIC_URL` | La URL del paso 2 |
| `R2_LOCATION` | `media` (no lo cambies, ver más abajo) |

En cuanto las cuatro primeras estén puestas y el servicio reinicie, R2 queda
activo. No hay ningún otro cambio que hacer.

## Paso 5 — Subir las imágenes que ya existen

El bucket arranca vacío, pero la base de datos ya tiene rutas guardadas. Hay un
comando que sube el contenido de `media/` respetando esas mismas rutas:

```bash
python manage.py subir_media_a_r2 --dry-run   # ver qué haría, sin subir
python manage.py subir_media_a_r2             # subir lo que falte
```

Se puede ejecutar desde tu máquina (poniendo las variables en `backend/.env`) o
desde la shell de Render. Omite lo que ya exista en el bucket; con `--force`
vuelve a subirlo todo.

---

## Detalles que conviene conocer

**No hay que tocar la base de datos.** Los `FileField` guardan rutas relativas
como `categorias/Banner_frutas.jpg`. Con `R2_LOCATION=media`, la clave en el
bucket queda `media/categorias/Banner_frutas.jpg` y la URL pública
`https://TU-DOMINIO/media/categorias/Banner_frutas.jpg`. Por eso **cambiar
`R2_LOCATION` rompe todas las imágenes existentes** salvo que muevas los objetos
del bucket a la vez.

**Los serializers no cambian.** Usan `request.build_absolute_uri(obj.imagen.url)`,
y Django deja intacta una URL que ya es absoluta. Con R2 activo, `imagen_url`
pasa a apuntar al bucket sin tocar una línea de código.

**Django deja de servir `/media/`.** Con R2 activo no se monta esa ruta: los
archivos ya no están en el servidor. El camino de respaldo en `config/urls.py`
solo se usa cuando R2 no está configurado.

**Ajustes específicos de R2** que ya están puestos en `base.py`, por si alguna
vez dan guerra:

- `default_acl = None` — R2 no implementa las ACL de S3 y falla si se le manda
  una. El acceso público se concede en el panel, no objeto a objeto.
- `region_name = "auto"` — R2 no tiene regiones, pero boto3 exige el parámetro.
- `request_checksum_calculation = "when_required"` — boto3 ≥ 1.36 añade por
  defecto checksums CRC32 que R2 rechaza con *not implemented*.
- `file_overwrite = False` — sin esto, dos archivos con el mismo nombre se
  pisarían el uno al otro.
