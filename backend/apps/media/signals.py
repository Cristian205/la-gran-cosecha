"""
Toda imagen que entra por un `ImageField` sale optimizada.

Una sola señal en vez de tocar cada formulario: la foto de un producto, de una
presentación, de una categoría, el logo o un banner llegan por vistas y
serializers distintos, pero todos acaban en `save()`. Aquí, antes de guardar,
el archivo recién subido (el que aún no está en el almacenamiento) se cambia
por su versión optimizada.

La biblioteca de medios no pasa por aquí: su campo es un `FileField` (también
guarda videos y PDF) y la optimiza su serializer, que además guarda el
diagnóstico para mostrarlo.
"""
import logging

from django.core.files.base import ContentFile
from django.db.models import ImageField
from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.tenancy.almacenamiento import ruta_identidad

from .optimizador import BAJA, procesar

logger = logging.getLogger(__name__)


@receiver(pre_save, dispatch_uid="media.optimizar_imagenes_subidas")
def optimizar_imagenes_subidas(sender, instance, raw=False, update_fields=None, **kwargs):
    if raw:  # loaddata: los datos llegan tal como se exportaron
        return
    for campo in instance._meta.concrete_fields:
        if not isinstance(campo, ImageField):
            continue
        if update_fields is not None and campo.name not in update_fields:
            continue
        archivo = getattr(instance, campo.attname)
        # `_committed` es False solo para lo recién asignado: lo que ya está
        # guardado no se vuelve a procesar en cada save().
        if not archivo or archivo._committed:
            continue
        # El logo también viaja en correos (el del código OTP) y Outlook de
        # escritorio no muestra WebP: la identidad se guarda en PNG.
        formato = "PNG" if getattr(campo, "upload_to", None) is ruta_identidad else "WEBP"
        resultado = procesar(archivo.file, archivo.name, formato)
        if resultado is None:
            continue
        if resultado.diagnostico.calidad == BAJA:
            logger.info(
                "Imagen de baja calidad en %s.%s: %s",
                sender.__name__,
                campo.name,
                " ".join(resultado.diagnostico.motivos),
            )
        if resultado.optimizada:
            setattr(instance, campo.attname, ContentFile(resultado.contenido, name=resultado.nombre))
