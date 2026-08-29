"""
Reubica los archivos ya existentes bajo el prefijo de su negocio.

    media/productos/mango.webp  ->  tenants/<uuid>/productos/<uuid>-mango.webp

Es un comando y no una migración a propósito: mover objetos en un bucket no
participa de la transacción de la base de datos, así que una migración que
fallara a mitad dejaría filas apuntando a claves que no existen. Como comando
se puede ensayar, repetir y revisar.

    python manage.py mover_media_a_negocios --dry-run   # ver qué haría
    python manage.py mover_media_a_negocios             # mover
    python manage.py mover_media_a_negocios --borrar-origen

El original se conserva salvo que se pida borrarlo: primero se comprueba que el
sitio funciona con las rutas nuevas, y solo después se limpia.
"""
from django.apps import apps
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.tenancy.almacenamiento import ruta_en

# Modelo, campo y carpeta de destino. La carpeta se repite aquí en vez de
# reutilizar el `upload_to` porque este comando debe producir la MISMA clave
# que produciría una subida nueva, y `upload_to` genera un uuid distinto cada
# vez que se le llama.
def _carpeta_biblioteca(fila):
    """
    Conserva el año y el mes que la biblioteca ya usaba, tomados de la fila y
    NO de la fecha de hoy: si no, mover archivos viejos los amontonaría todos
    en el mes en que se ejecutó el comando.
    """
    fecha = getattr(fila, "fecha_creacion", None)
    return f"biblioteca/{fecha:%Y/%m}" if fecha else "biblioteca"


ARCHIVOS = [
    ("catalog", "Categoria", "imagen", "categorias"),
    ("catalog", "Producto", "imagen", "productos"),
    ("content", "StoreSettings", "logo", "identidad"),
    ("content", "PromoBanner", "imagen", "banners"),
    ("media", "Archivo", "archivo", _carpeta_biblioteca),
]

PREFIJO = "tenants/"


class Command(BaseCommand):
    help = "Mueve los archivos existentes bajo tenants/<uuid-del-negocio>/."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Muestra qué haría, sin tocar nada."
        )
        parser.add_argument(
            "--borrar-origen",
            action="store_true",
            help="Borra el archivo original tras copiarlo. Solo cuando ya se "
            "haya comprobado que el sitio funciona con las rutas nuevas.",
        )

    def handle(self, *args, **opciones):
        ensayo = opciones["dry_run"]
        movidos = fallidos = saltados = ausentes = 0

        for etiqueta, nombre_modelo, campo, carpeta in ARCHIVOS:
            modelo = apps.get_model(etiqueta, nombre_modelo)
            self.stdout.write(f"\n{etiqueta}.{nombre_modelo}.{campo}")

            # `all_tenants` cuando existe: este comando atraviesa todos los
            # negocios a propósito y corre fuera de cualquier petición.
            # `StoreSettings` no hereda de ModeloConTenant —lleva su propio
            # OneToOne al negocio— y su manager normal ya es sin ámbito.
            gestor = getattr(modelo, "all_tenants", modelo._default_manager)

            for fila in gestor.exclude(**{campo: ""}).iterator():
                archivo = getattr(fila, campo)
                if not archivo or not archivo.name:
                    continue
                if archivo.name.startswith(PREFIJO):
                    saltados += 1
                    continue

                destino = ruta_en(
                    fila, archivo.name, carpeta(fila) if callable(carpeta) else carpeta
                )
                self.stdout.write(f"  {archivo.name}\n    -> {destino}")

                if ensayo:
                    movidos += 1
                    continue

                try:
                    self._copiar(fila, campo, archivo, destino, opciones)
                    movidos += 1
                except FileNotFoundError:
                    # La fila apunta a un archivo que ya no está. Se deja
                    # intacta: sigue apuntando a la ruta vieja, el sitio se
                    # comporta igual que antes y el comando se puede repetir.
                    ausentes += 1
                    self.stdout.write(
                        self.style.WARNING("    no está en el almacenamiento; se deja igual")
                    )
                except Exception as error:  # noqa: BLE001 — cada storage falla distinto
                    fallidos += 1
                    self.stdout.write(self.style.ERROR(f"    fallo: {error}"))

        self._resumen(movidos, saltados, ausentes, fallidos, ensayo)

    # ------------------------------------------------------------------
    def _copiar(self, fila, campo, archivo, destino, opciones):
        """
        Lee, escribe en la clave nueva y actualiza la fila.

        Se pasa por la API de storage y no por rutas del sistema de archivos
        porque con R2 no existe `.path`: el mismo código sirve para disco local
        y para el bucket.
        """
        archivo.open("rb")
        try:
            datos = archivo.read()
        finally:
            archivo.close()

        campo_archivo = fila._meta.get_field(campo)
        almacen = campo_archivo.storage
        # `save=False` en el campo: la fila se guarda una sola vez, abajo.
        nombre_final = almacen.save(destino, ContentFile(datos))

        origen = archivo.name
        setattr(fila, campo, nombre_final)
        fila.save(update_fields=[campo])

        if opciones["borrar_origen"]:
            almacen.delete(origen)

    def _resumen(self, movidos, saltados, ausentes, fallidos, ensayo):
        verbo = "se moverían" if ensayo else "movidos"
        self.stdout.write("")
        self.stdout.write(f"{verbo}: {movidos} · ya estaban: {saltados}")
        if ausentes:
            self.stdout.write(
                self.style.WARNING(
                    f"sin archivo en el almacenamiento: {ausentes} "
                    "(las filas quedan como estaban)"
                )
            )
        if fallidos:
            self.stdout.write(self.style.ERROR(f"fallidos: {fallidos}"))
        elif not ensayo and movidos:
            self.stdout.write(
                self.style.SUCCESS(
                    "Listo. Comprueba el sitio antes de usar --borrar-origen."
                )
            )
