"""
Optimiza y diagnostica las imágenes que ya estaban subidas.

Lo nuevo se optimiza solo al subirse (apps/media/signals.py); esto es para lo
de antes, como el PNG de 4 MB de la maracuyá.

    python manage.py optimizar_imagenes --dry-run          # informe, sin tocar nada
    python manage.py optimizar_imagenes                    # optimizar
    python manage.py optimizar_imagenes --negocio la-gran-cosecha
    python manage.py optimizar_imagenes --borrar-origen    # y borrar los originales

Qué cambia en cada caso:

- Fotos de `ImageField` (productos, presentaciones, categorías, logos,
  banners…): se sube la versión optimizada y la fila apunta a ella. La tienda
  arma esas URL desde la fila, así que nada se rompe.
- Biblioteca de medios: SOLO se guarda el diagnóstico. Sus URL están copiadas
  dentro de las páginas armadas con bloques (el banner, los más vendidos…), y
  cambiar el archivo las dejaría apuntando a algo que no existe.

El original se conserva salvo que se pida borrarlo, igual que en
`mover_media_a_negocios`: primero se comprueba la tienda, después se limpia.
"""
from django.apps import apps
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db.models import ImageField

from apps.media.models import Archivo
from apps.media.optimizador import BAJA, procesar


def _kb(n: int) -> str:
    return f"{n / 1024:,.0f} KB"


class Command(BaseCommand):
    help = "Optimiza las imágenes ya subidas y diagnostica si están pixeladas."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Solo informa; no cambia nada.")
        parser.add_argument("--negocio", help="Slug del negocio. Sin él, todos.")
        parser.add_argument(
            "--borrar-origen",
            action="store_true",
            help="Borra el archivo original tras reemplazarlo. Solo cuando ya se "
            "haya comprobado que la tienda se ve bien.",
        )

    def handle(self, *args, dry_run=False, negocio=None, borrar_origen=False, **opciones):
        self.dry_run = dry_run
        self.borrar_origen = borrar_origen and not dry_run
        self.negocio = negocio
        self.antes = self.despues = 0
        self.bajas = []

        for modelo in apps.get_models():
            campos = [c for c in modelo._meta.concrete_fields if isinstance(c, ImageField)]
            for campo in campos:
                self._campo(modelo, campo)
        self._biblioteca()

        ahorro = self.antes - self.despues
        verbo = "Se ahorrarían" if dry_run else "Se ahorraron"
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"{verbo} {_kb(ahorro)} ({_kb(self.antes)} → {_kb(self.despues)})."))
        if self.bajas:
            self.stdout.write(self.style.WARNING(f"{len(self.bajas)} imágenes de baja calidad:"))
            for linea in self.bajas:
                self.stdout.write(f"  - {linea}")

    def _filas(self, modelo):
        filas = modelo._base_manager.all()
        if self.negocio and any(c.name == "tenant" for c in modelo._meta.fields):
            filas = filas.filter(tenant__slug=self.negocio)
        return filas

    def _abrir(self, archivo):
        try:
            with archivo.open("rb") as f:
                return procesar(f, archivo.name)
        except (FileNotFoundError, OSError) as error:
            self.stdout.write(self.style.ERROR(f"  no se pudo leer {archivo.name}: {error}"))
            return None

    def _campo(self, modelo, campo):
        etiqueta = f"{modelo._meta.label}.{campo.name}"
        for fila in self._filas(modelo).exclude(**{campo.name: ""}).exclude(**{f"{campo.name}__isnull": True}):
            archivo = getattr(fila, campo.attname)
            resultado = self._abrir(archivo)
            if resultado is None:
                continue
            self._anotar(f"{etiqueta} #{fila.pk}", archivo.name, resultado)
            if not resultado.optimizada or resultado.tamano >= resultado.tamano_original:
                continue
            if self.dry_run:
                continue
            anterior = archivo.name
            # `save` del FieldFile sube con la ruta de siempre (upload_to) y
            # deja el archivo ya confirmado: la señal no lo vuelve a procesar.
            archivo.save(resultado.nombre, ContentFile(resultado.contenido), save=False)
            fila.save(update_fields=[campo.name])
            if self.borrar_origen:
                archivo.storage.delete(anterior)

    def _biblioteca(self):
        for fila in self._filas(Archivo).filter(tipo="IMAGEN").exclude(content_type="image/svg+xml"):
            resultado = self._abrir(fila.archivo)
            if resultado is None:
                continue
            diagnostico = resultado.diagnostico
            if diagnostico.calidad == BAJA:
                self.bajas.append(f"biblioteca #{fila.pk} «{fila.nombre_original}»: {' '.join(diagnostico.motivos)}")
            if not self.dry_run:
                fila.calidad = diagnostico.calidad
                fila.diagnostico = diagnostico.como_dict()
                fila.save(update_fields=["calidad", "diagnostico"])

    def _anotar(self, donde, nombre, resultado):
        self.antes += resultado.tamano_original
        self.despues += min(resultado.tamano, resultado.tamano_original)
        d = resultado.diagnostico
        self.stdout.write(
            f"{donde}: {_kb(resultado.tamano_original)} → {_kb(resultado.tamano)} · "
            f"{d.ancho}×{d.alto} · {d.calidad.lower()}"
        )
        if d.calidad == BAJA:
            self.bajas.append(f"{donde} ({nombre.rsplit('/', 1)[-1]}): {' '.join(d.motivos)}")
