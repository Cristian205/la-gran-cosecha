"""
Carga contenido SEO revisado (descripciones, títulos, introducciones de
categoría, preguntas frecuentes) desde un archivo JSON.

    python manage.py importar_contenido_seo docs/seo/contenido-la-gran-cosecha.json
    python manage.py importar_contenido_seo docs/seo/contenido-la-gran-cosecha.json --aplicar

Dos reglas que lo hacen seguro de ejecutar en producción:

1. Sin `--aplicar` no escribe nada: dice qué cambiaría.
2. Solo LLENA campos vacíos. Lo que el negocio ya escribió en el panel manda;
   pisarlo exige `--sobrescribir`, de forma explícita.

Nunca toca nombres, precios, presentaciones, estados ni categorías de un
producto: solo los campos de texto SEO listados en `CAMPOS_*`.

Formato:

    {
      "negocio": "la-gran-cosecha",
      "categorias": {"frutas": {"descripcion": "...", "seo_titulo": "...",
                                "seo_descripcion": "...", "preguntas_frecuentes": [...]}},
      "productos":  {"mango": {"descripcion": "...", "palabra_clave": "..."}},
      "paginas":    {"/": {"seo_titulo": "...", "seo_descripcion": "..."}}
    }

Las claves son los slugs. Un slug que no existe se informa y se salta.
"""
import json
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.catalog.models import Categoria, Producto
from apps.catalog.serializers import CategoriaSerializer
from apps.tenancy.context import usar_tenant
from apps.tenancy.models import Tenant

CAMPOS_PRODUCTO = {
    "descripcion": 500,
    "seo_titulo": 70,
    "seo_descripcion": 160,
    "imagen_alt": 125,
    "palabra_clave": 80,
}
#: Las páginas compuestas en el constructor (inicio, catálogo…), por ruta.
CAMPOS_PAGINA = {"seo_titulo": 160, "seo_descripcion": 255}
CAMPOS_CATEGORIA = {
    "descripcion": 1200,
    "seo_titulo": 70,
    "seo_descripcion": 160,
    "preguntas_frecuentes": None,
}


class Command(BaseCommand):
    help = "Importa contenido SEO revisado desde un JSON (por defecto, solo simula)."

    def add_arguments(self, parser):
        parser.add_argument("archivo")
        parser.add_argument("--negocio", help="Slug del negocio (si el archivo no lo trae).")
        parser.add_argument("--aplicar", action="store_true", help="Escribe los cambios.")
        parser.add_argument(
            "--sobrescribir",
            action="store_true",
            help="Reemplaza también los campos que ya tienen contenido.",
        )

    def handle(self, *args, **opciones):
        try:
            with open(opciones["archivo"], encoding="utf-8") as f:
                datos = json.load(f)
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f"No se pudo leer el archivo: {error}") from error

        slug_negocio = opciones.get("negocio") or datos.get("negocio")
        if not slug_negocio:
            raise CommandError("Indica el negocio con --negocio o en la clave «negocio» del archivo.")
        try:
            tenant = Tenant.objects.get(slug=slug_negocio)
        except Tenant.DoesNotExist as error:
            raise CommandError(f"No existe el negocio «{slug_negocio}».") from error

        self.aplicar = opciones["aplicar"]
        self.sobrescribir = opciones["sobrescribir"]
        self.resumen = {"cambios": 0, "conservados": 0, "inexistentes": []}

        with usar_tenant(tenant), transaction.atomic():
            for slug, valores in (datos.get("categorias") or {}).items():
                categoria = Categoria.objects.filter(slug=slug).first()
                if not categoria:
                    self.resumen["inexistentes"].append(f"categoría {slug}")
                    continue
                if "preguntas_frecuentes" in valores:
                    valores = {
                        **valores,
                        "preguntas_frecuentes": CategoriaSerializer().validate_preguntas_frecuentes(
                            valores["preguntas_frecuentes"]
                        ),
                    }
                self._actualizar(categoria, valores, CAMPOS_CATEGORIA, f"categoría {slug}")

            from apps.storefront.models import Pagina

            for ruta, valores in (datos.get("paginas") or {}).items():
                pagina = Pagina.objects.filter(ruta=ruta).first()
                if not pagina:
                    self.resumen["inexistentes"].append(f"página {ruta}")
                    continue
                self._actualizar(pagina, valores, CAMPOS_PAGINA, f"página {ruta}")

            for slug, valores in (datos.get("productos") or {}).items():
                producto = Producto.objects.filter(slug=slug).first()
                if not producto:
                    self.resumen["inexistentes"].append(f"producto {slug}")
                    continue
                self._actualizar(producto, valores, CAMPOS_PRODUCTO, f"producto {slug}")

            if not self.aplicar:
                transaction.set_rollback(True)

        r = self.resumen
        modo = "APLICADO" if self.aplicar else "SIMULACIÓN (nada se guardó; usa --aplicar)"
        self.stdout.write(self.style.SUCCESS(f"\n{modo}"))
        self.stdout.write(f"  Campos que cambian:            {r['cambios']}")
        self.stdout.write(f"  Campos con contenido propio:   {r['conservados']} (no se tocan sin --sobrescribir)")
        if r["inexistentes"]:
            self.stdout.write(self.style.WARNING(f"  Slugs que no existen ({len(r['inexistentes'])}): {', '.join(r['inexistentes'])}"))

    def _actualizar(self, objeto, valores, permitidos, etiqueta):
        cambiados = []
        for campo, valor in valores.items():
            if campo not in permitidos:
                raise CommandError(f"{etiqueta}: el campo «{campo}» no se puede importar.")
            maximo = permitidos[campo]
            if isinstance(valor, str):
                # Espacios normalizados, pero los párrafos (línea en blanco) se
                # conservan: la introducción de una categoría puede tener varios.
                parrafos = re.split(r"\n\s*\n", valor)
                valor = "\n\n".join(" ".join(p.split()) for p in parrafos if p.strip())
                if maximo and len(valor) > maximo:
                    raise CommandError(f"{etiqueta}: «{campo}» supera {maximo} caracteres ({len(valor)}).")
            if not valor:
                continue
            actual = getattr(objeto, campo)
            if actual == valor:
                continue
            if actual and not self.sobrescribir:
                self.resumen["conservados"] += 1
                continue
            setattr(objeto, campo, valor)
            cambiados.append(campo)
        if cambiados:
            self.resumen["cambios"] += len(cambiados)
            self.stdout.write(f"  {etiqueta}: {', '.join(cambiados)}")
            # `update_fields`: el `save()` de Producto no recalcula código, orden
            # ni slug, y `fecha_actualizacion` (auto_now) sí sube —con razón:
            # la ficha cambió y el sitemap debe decirlo.
            campos = [*cambiados]
            if any(f.name == "fecha_actualizacion" for f in objeto._meta.fields):
                campos.append("fecha_actualizacion")
            objeto.save(update_fields=campos)
