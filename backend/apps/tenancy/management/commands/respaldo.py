"""
Vuelca la base entera a un archivo, atravesando todos los negocios.

Existe porque `dumpdata` a secas **produce un respaldo truncado sin avisar
del todo**. Desde que los modelos de negocio fallan cerrado, el manager por
defecto lanza si nadie declaró el ámbito, y el serializador va escribiendo el
archivo hasta que se topa con el primer modelo con tenant: queda un JSON a
medias, con apariencia de respaldo. `--all` tampoco lo arregla.

Aquí se declara `ambito_de_plataforma()` a propósito y explícitamente, que es
exactamente el caso para el que existe.

    python manage.py respaldo                      # a _backups/, con fecha
    python manage.py respaldo --salida copia.json
"""
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.tenancy.context import ambito_de_plataforma

# Lo que no tiene sentido volcar: se regenera solo o es ruido de sesión.
EXCLUIR = ["contenttypes", "auth.permission", "sessions", "admin.logentry"]


class Command(BaseCommand):
    help = "Respaldo completo de la base, atravesando todos los negocios."

    def add_arguments(self, parser):
        parser.add_argument("--salida", help="Ruta del archivo. Por defecto, _backups/.")
        parser.add_argument(
            "--etiqueta",
            default="respaldo",
            help="Prefijo del nombre, para saber de qué era.",
        )

    def handle(self, *args, **opciones):
        if opciones["salida"]:
            destino = Path(opciones["salida"])
        else:
            carpeta = Path(settings.BASE_DIR).parent / "_backups"
            carpeta.mkdir(exist_ok=True)
            marca = datetime.now().strftime("%Y%m%d_%H%M%S")
            destino = carpeta / f"{opciones['etiqueta']}_{marca}.json"

        destino.parent.mkdir(parents=True, exist_ok=True)

        with ambito_de_plataforma():
            call_command(
                "dumpdata",
                natural_foreign=True,
                natural_primary=True,
                indent=2,
                exclude=EXCLUIR,
                output=str(destino),
            )

        tamano = destino.stat().st_size
        self.stdout.write(
            self.style.SUCCESS(f"{destino}  ({tamano / 1024:.0f} KB)")
        )
        # Un respaldo minúsculo casi siempre significa que se cortó a mitad, y
        # eso solo se descubre el día que hace falta restaurarlo.
        if tamano < 2048:
            self.stdout.write(
                self.style.WARNING(
                    "El archivo es sospechosamente pequeño. Revísalo antes de fiarte."
                )
            )
