"""Sube a Cloudflare R2 los archivos que estan en el MEDIA_ROOT local.

Se usa una sola vez, al migrar de disco local a R2. Recorre la carpeta media/
y sube cada archivo con la MISMA ruta relativa, que es exactamente lo que
guardan los FileField en la base de datos (por ejemplo
"categorias/Banner_frutas.jpg"). Asi las rutas ya almacenadas siguen siendo
validas y no hay que tocar ni una fila.

    python manage.py subir_media_a_r2 --dry-run   # ver que haria
    python manage.py subir_media_a_r2             # subir lo que falte
"""
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Sube los archivos de MEDIA_ROOT a Cloudflare R2."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra que se subiria, sin subir nada.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Vuelve a subir tambien los archivos que ya existan en R2.",
        )
        parser.add_argument(
            "--origen",
            default=None,
            help="Carpeta local a subir. Por defecto, MEDIA_ROOT.",
        )

    def handle(self, *args, **opciones):
        if not getattr(settings, "USE_R2", False):
            raise CommandError(
                "R2 no esta configurado. Faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
                "R2_SECRET_ACCESS_KEY o R2_BUCKET_NAME."
            )

        origen = Path(opciones["origen"] or settings.MEDIA_ROOT)
        if not origen.is_dir():
            raise CommandError(f"La carpeta de origen no existe: {origen}")

        seco = opciones["dry_run"]
        forzar = opciones["force"]

        archivos = [p for p in origen.rglob("*") if p.is_file()]
        if not archivos:
            self.stdout.write(self.style.WARNING(f"No hay archivos en {origen}"))
            return

        self.stdout.write(
            f"{len(archivos)} archivos en {origen}\n"
            f"Destino: bucket {settings.R2_BUCKET_NAME}, prefijo {settings.R2_LOCATION}/\n"
        )

        subidos = omitidos = fallidos = 0
        for ruta in sorted(archivos):
            # Clave relativa: la misma cadena que guarda el FileField.
            clave = ruta.relative_to(origen).as_posix()

            if not forzar and default_storage.exists(clave):
                self.stdout.write(f"  = ya existe   {clave}")
                omitidos += 1
                continue

            if seco:
                self.stdout.write(f"  + subiria     {clave}")
                subidos += 1
                continue

            try:
                with ruta.open("rb") as fh:
                    # save() puede renombrar si hay colision; con file_overwrite
                    # en False eso solo pasaria con --force sobre un existente.
                    guardado = default_storage.save(clave, fh)
                self.stdout.write(self.style.SUCCESS(f"  + subido      {guardado}"))
                subidos += 1
            except Exception as exc:  # noqa: BLE001 - se reporta y se sigue
                self.stderr.write(self.style.ERROR(f"  ! fallo       {clave}: {exc}"))
                fallidos += 1

        resumen = f"\nSubidos: {subidos} | Ya estaban: {omitidos} | Fallidos: {fallidos}"
        estilo = self.style.ERROR if fallidos else self.style.SUCCESS
        self.stdout.write(estilo(resumen + ("  (simulacion)" if seco else "")))
