"""
Los campos SEO del catálogo y el comando que importa contenido revisado.

Lo que protegen: el panel puede guardar los campos (y la tienda leerlos), las
preguntas frecuentes no aceptan basura, y el comando de importación no pisa
lo que el negocio escribió ni toca nada fuera de los textos SEO.
"""
import json

import pytest
from django.core.management import call_command

from apps.catalog.models import Categoria, Producto

pytestmark = pytest.mark.django_db


def test_los_campos_seo_se_leen_en_la_api_publica(api, producto, presentacion):
    Producto.objects.filter(pk=producto.pk).update(
        seo_titulo="Título propio", imagen_alt="Foto del producto", palabra_clave="producto prueba"
    )
    datos = api.get(f"/api/catalog/products/?slug={producto.slug}").json()["results"][0]
    assert datos["seo_titulo"] == "Título propio"
    assert datos["imagen_alt"] == "Foto del producto"
    assert datos["palabra_clave"] == "producto prueba"


def test_el_panel_guarda_los_campos_seo_del_producto(api_owner, producto):
    respuesta = api_owner.patch(
        f"/api/catalog/products/{producto.pk}/",
        {"seo_descripcion": "Descripción para buscadores", "imagen_alt": "Caja de mango"},
        format="json",
    )
    assert respuesta.status_code == 200, respuesta.content
    producto.refresh_from_db()
    assert producto.seo_descripcion == "Descripción para buscadores"
    assert producto.imagen_alt == "Caja de mango"


def test_preguntas_frecuentes_se_limpian_y_validan(api_owner, categoria):
    url = f"/api/catalog/categories/{categoria.pk}/"
    ok = api_owner.patch(
        url,
        {
            "preguntas_frecuentes": [
                {"pregunta": "  ¿Venden   por caja? ", "respuesta": "Sí."},
                {"pregunta": "", "respuesta": "fila a medio escribir"},
            ]
        },
        format="json",
    )
    assert ok.status_code == 200, ok.content
    categoria.refresh_from_db()
    assert categoria.preguntas_frecuentes == [{"pregunta": "¿Venden por caja?", "respuesta": "Sí."}]

    malo = api_owner.patch(url, {"preguntas_frecuentes": "no es una lista"}, format="json")
    assert malo.status_code == 400


def _archivo(tmp_path, contenido):
    ruta = tmp_path / "contenido.json"
    ruta.write_text(json.dumps(contenido), encoding="utf-8")
    return str(ruta)


def test_importar_sin_aplicar_no_escribe(tmp_path, negocio, producto):
    archivo = _archivo(
        tmp_path, {"negocio": negocio.slug, "productos": {producto.slug: {"descripcion": "Nueva"}}}
    )
    call_command("importar_contenido_seo", archivo)
    producto.refresh_from_db()
    assert producto.descripcion == ""


def test_importar_llena_vacios_y_respeta_lo_escrito(tmp_path, negocio, producto, categoria):
    Producto.objects.filter(pk=producto.pk).update(descripcion="Escrita por el negocio")
    precio_antes = list(producto.presentaciones.values_list("precio_unitario", flat=True))
    archivo = _archivo(
        tmp_path,
        {
            "negocio": negocio.slug,
            "categorias": {
                categoria.slug: {
                    "descripcion": "Intro de la categoría",
                    "preguntas_frecuentes": [{"pregunta": "¿Q?", "respuesta": "R."}],
                }
            },
            "productos": {
                producto.slug: {"descripcion": "Propuesta", "palabra_clave": "producto prueba"},
                "no-existe": {"descripcion": "x"},
            },
        },
    )
    call_command("importar_contenido_seo", archivo, "--aplicar")

    producto.refresh_from_db()
    categoria.refresh_from_db()
    assert producto.descripcion == "Escrita por el negocio"  # no se pisa
    assert producto.palabra_clave == "producto prueba"  # el vacío sí se llena
    assert categoria.descripcion == "Intro de la categoría"
    assert categoria.preguntas_frecuentes == [{"pregunta": "¿Q?", "respuesta": "R."}]
    assert list(producto.presentaciones.values_list("precio_unitario", flat=True)) == precio_antes

    call_command("importar_contenido_seo", archivo, "--aplicar", "--sobrescribir")
    producto.refresh_from_db()
    assert producto.descripcion == "Propuesta"


def test_importar_rechaza_campos_no_seo(tmp_path, negocio, producto):
    from django.core.management.base import CommandError

    archivo = _archivo(
        tmp_path, {"negocio": negocio.slug, "productos": {producto.slug: {"nombre_producto": "Otro"}}}
    )
    with pytest.raises(CommandError):
        call_command("importar_contenido_seo", archivo, "--aplicar")
    assert Producto.objects.get(pk=producto.pk).nombre_producto == "Producto de prueba"
    assert Categoria.objects.count() == 1


def test_preguntas_frecuentes_llegan_en_multipart(api_owner, categoria):
    """El panel manda la categoría como formulario (por la foto): la lista va como JSON."""
    respuesta = api_owner.patch(
        f"/api/catalog/categories/{categoria.pk}/",
        {
            "descripcion": "Intro",
            "preguntas_frecuentes": json.dumps([{"pregunta": "¿Por caja?", "respuesta": "Sí."}]),
        },
        format="multipart",
    )
    assert respuesta.status_code == 200, respuesta.content
    categoria.refresh_from_db()
    assert categoria.preguntas_frecuentes == [{"pregunta": "¿Por caja?", "respuesta": "Sí."}]
    assert categoria.descripcion == "Intro"


def test_el_archivo_de_contenido_propuesto_se_importa(negocio, categoria, unidad):
    """El JSON de `docs/seo/` es válido y cabe en los campos (dry-run + aplicar)."""
    from pathlib import Path

    archivo = Path(__file__).resolve().parents[2] / "docs" / "seo" / "contenido-la-gran-cosecha.json"
    Categoria.objects.filter(pk=categoria.pk).update(slug="frutas")
    mango = Producto.objects.create(nombre_producto="Mango", categoria=categoria)

    call_command("importar_contenido_seo", str(archivo), "--negocio", negocio.slug, "--aplicar")

    mango.refresh_from_db()
    categoria.refresh_from_db()
    assert "Tommy" in mango.descripcion
    assert mango.palabra_clave == "mango tommy"
    assert categoria.seo_titulo.startswith("Frutas")
    assert "\n\n" in categoria.descripcion  # los párrafos se conservan
    assert len(categoria.preguntas_frecuentes) == 3
