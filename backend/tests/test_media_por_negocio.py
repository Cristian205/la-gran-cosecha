"""
Fase 6: cada negocio en su propio prefijo dentro del bucket.

El aislamiento de la biblioteca ya lo daba la fase 3 —un negocio no ve ni
lista los archivos de otro—. Lo que aquí se comprueba es distinto y es lo que
faltaba: que las CLAVES dentro del bucket también estén separadas, para que un
negocio no pueda sobrescribir ni adivinar el archivo de otro.
"""
import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.catalog.models import Categoria, Producto
from apps.tenancy.almacenamiento import ruta_en

pytestmark = pytest.mark.django_db

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def imagen(nombre="foto.png"):
    return SimpleUploadedFile(nombre, PNG, content_type="image/png")


# ==========================================================================
# LA FORMA DE LA CLAVE
# ==========================================================================
def test_la_ruta_se_construye_con_el_uuid_y_no_con_el_slug(negocio, categoria):
    """
    El slug se renombra; el UUID no cambia nunca. Si la ruta llevara el slug,
    renombrar un negocio dejaría todos sus archivos huérfanos.
    """
    ruta = ruta_en(categoria, "mango.webp", "categorias")

    assert ruta.startswith(f"tenants/{negocio.uuid}/categorias/")
    assert negocio.slug not in ruta


def test_dos_negocios_que_suben_el_mismo_nombre_no_chocan(negocio, categoria):
    """Sin el uuid antepuesto, el segundo `logo.png` pisaría al primero."""
    primera = ruta_en(categoria, "logo.png", "identidad")
    segunda = ruta_en(categoria, "logo.png", "identidad")

    assert primera != segunda
    assert primera.endswith("-logo.png") and segunda.endswith("-logo.png")


def test_el_nombre_del_archivo_no_puede_escapar_de_su_carpeta(negocio, categoria):
    """
    `path traversal`: el nombre lo elige quien sube, así que componer la ruta
    con él tal cual permitiría escribir en el prefijo de otro negocio.
    """
    ruta = ruta_en(categoria, "../../otro-negocio/identidad/logo.png", "categorias")

    assert ".." not in ruta
    assert ruta.startswith(f"tenants/{negocio.uuid}/categorias/")


@pytest.mark.parametrize(
    "nombre", ["script.php", "app.exe", "config.sh", "x.html", "sin-punto"]
)
def test_una_extension_no_permitida_se_normaliza(negocio, categoria, nombre):
    """
    La extensión acaba en una URL pública y en una cabecera Content-Type, así
    que no puede ser texto libre de quien sube.
    """
    assert ruta_en(categoria, nombre, "categorias").endswith(".bin")


def test_no_se_guarda_un_archivo_sin_saber_de_que_negocio_es(negocio):
    """
    Preferible un error ruidoso a un archivo suelto en la raíz del bucket, que
    después nadie sabría de quién es ni si se puede borrar.
    """

    class SinNegocio:
        tenant = None

    with pytest.raises(ValueError):
        ruta_en(SinNegocio(), "foto.png", "categorias")


# ==========================================================================
# LA SUBIDA REAL, POR LA API Y POR EL MODELO
# ==========================================================================
def test_la_imagen_de_un_producto_va_al_prefijo_del_negocio(negocio, categoria):
    producto = Producto.objects.create(
        nombre_producto="Mango", categoria=categoria, imagen=imagen("mango.png")
    )
    assert producto.imagen.name.startswith(f"tenants/{negocio.uuid}/productos/")


def test_la_imagen_de_una_categoria_va_a_su_carpeta(negocio):
    categoria = Categoria.objects.create(
        nombre_categoria="Frutas", abreviatura="FRU", imagen=imagen("frutas.png")
    )
    assert categoria.imagen.name.startswith(f"tenants/{negocio.uuid}/categorias/")


def test_el_logo_de_la_tienda_va_a_identidad(negocio):
    configuracion = negocio.settings
    configuracion.logo = imagen("logo.png")
    configuracion.save()

    assert configuracion.logo.name.startswith(f"tenants/{negocio.uuid}/identidad/")


def test_la_biblioteca_conserva_el_ano_y_el_mes(negocio, api_owner):
    """
    Es el único destino con subcarpetas por fecha: acumula todo lo que sube el
    panel y sin ellas sería una carpeta con miles de objetos.
    """
    from datetime import datetime

    respuesta = api_owner.post(
        "/api/media/archivos/", {"archivo": imagen("nota.png")}, format="multipart"
    )
    assert respuesta.status_code == 201

    from apps.media.models import Archivo

    archivo = Archivo.objects.get(id=respuesta.json()["id"])
    hoy = datetime.now()
    assert archivo.archivo.name.startswith(
        f"tenants/{negocio.uuid}/biblioteca/{hoy:%Y/%m}/"
    )


def test_dos_negocios_no_comparten_ni_un_prefijo(negocio, categoria):
    """La comprobación de fondo de toda la fase."""
    from apps.tenancy.models import Tenant

    otro = Tenant.objects.create(slug="otro", nombre="Otro negocio", estado="ACTIVO")
    otra_categoria = Categoria.all_tenants.create(
        tenant=otro, nombre_categoria="Perfumes", abreviatura="PER"
    )

    mia = ruta_en(categoria, "foto.png", "categorias")
    suya = ruta_en(otra_categoria, "foto.png", "categorias")

    assert mia.split("/")[1] != suya.split("/")[1]
    # Y ninguno de los dos prefijos es adivinable a partir del otro.
    assert uuid.UUID(mia.split("/")[1]) != uuid.UUID(suya.split("/")[1])
