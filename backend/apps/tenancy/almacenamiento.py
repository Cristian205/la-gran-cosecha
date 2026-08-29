"""
Dónde acaba cada archivo dentro del bucket.

    tenants/<uuid-del-negocio>/<carpeta>/<uuid>-<nombre>.<ext>

Tres decisiones, cada una por su motivo:

**El UUID del negocio, no su slug.** Los slugs se renombran; el día que
«Perfumería XYZ» pase a llamarse otra cosa, todos sus archivos quedarían
huérfanos o habría que moverlos. El UUID no cambia nunca.

**Un UUID antepuesto al nombre.** Elimina las colisiones —dos negocios suben
`logo.png` el mismo día— y, sobre todo, la enumeración: sin él, conociendo el
UUID de un negocio se podrían adivinar sus archivos probando nombres comunes.

**La ruta la construye el servidor, jamás el cliente.** Un nombre de archivo es
texto que envía quien sube, y usarlo tal cual para componer una ruta es
*path traversal* de manual: un `../../otro-negocio/logo.png` escribiría fuera.
Aquí solo se conserva la extensión, y filtrada.

Las funciones son de módulo y no cierres (`closures`) a propósito: Django
serializa el `upload_to` en las migraciones por su ruta de importación, y un
cierre no tiene ninguna.
"""
import posixpath
import re
import uuid
from datetime import datetime

# Extensiones que se conservan tal cual. Cualquier otra cosa se normaliza a
# `.bin`: la extensión acaba en una URL pública y en una cabecera Content-Type,
# así que no puede ser texto libre de quien sube.
EXTENSIONES = {
    "jpg", "jpeg", "png", "webp", "gif", "svg", "avif",
    "mp4", "webm", "mov",
    "pdf", "csv", "txt",
}

_NOMBRE_LIMPIO = re.compile(r"[^a-z0-9]+")


def _partes(nombre_original: str) -> tuple[str, str]:
    """Devuelve (nombre legible y seguro, extensión) a partir del original."""
    # `basename` descarta cualquier carpeta que viniera en el nombre; es la
    # primera línea contra `../`.
    base = posixpath.basename((nombre_original or "").replace("\\", "/"))
    raiz, _, ext = base.rpartition(".")
    if not raiz:  # nombre sin punto: todo es raíz
        raiz, ext = base, ""

    ext = _NOMBRE_LIMPIO.sub("", ext.lower())
    if ext not in EXTENSIONES:
        ext = "bin"

    # Se conserva un resto legible del nombre para que el bucket sea navegable
    # a ojo, pero recortado: no aporta nada y alarga la clave.
    legible = _NOMBRE_LIMPIO.sub("-", raiz.lower()).strip("-")[:40] or "archivo"
    return legible, ext


def ruta_en(instancia, nombre_original: str, carpeta: str) -> str:
    """La clave completa dentro del bucket para este archivo."""
    tenant = getattr(instancia, "tenant", None)
    if tenant is None or tenant.uuid is None:
        # No debería ocurrir: `asegurar_tenant()` corre al principio de save().
        # Si ocurre, es preferible un error ruidoso a un archivo suelto en la
        # raíz del bucket, que nadie sabría de quién es.
        raise ValueError(
            f"No se puede guardar un archivo de {type(instancia).__name__} sin "
            f"saber de qué negocio es."
        )

    legible, ext = _partes(nombre_original)
    return f"tenants/{tenant.uuid}/{carpeta}/{uuid.uuid4().hex}-{legible}.{ext}"


# --------------------------------------------------------------------------
# Un destino por tipo de archivo. Django los referencia por nombre en las
# migraciones, así que renombrarlos exige una migración.
# --------------------------------------------------------------------------
def ruta_categoria(instancia, nombre):
    return ruta_en(instancia, nombre, "categorias")


def ruta_producto(instancia, nombre):
    return ruta_en(instancia, nombre, "productos")


def ruta_identidad(instancia, nombre):
    """Logo y favicon: la identidad visual del negocio."""
    return ruta_en(instancia, nombre, "identidad")


def ruta_banner(instancia, nombre):
    return ruta_en(instancia, nombre, "banners")


def ruta_biblioteca(instancia, nombre):
    """
    Biblioteca de medios, con el año y el mes que ya tenía.

    Es el único destino con subcarpetas por fecha: acumula todo lo que sube el
    panel y sin ellas sería una carpeta con miles de objetos.
    """
    hoy = datetime.now()
    return ruta_en(instancia, nombre, f"biblioteca/{hoy:%Y/%m}")
