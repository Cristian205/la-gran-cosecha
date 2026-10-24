"""
El optimizador de imágenes (apps/media/optimizador.py).

Protege tres cosas: que lo que se sube quede liviano y sin metadatos, que el
diagnóstico distinga una foto nítida de una pixelada o ampliada, y que eso
pase en TODAS las puertas de entrada (los ImageField por la señal, la
biblioteca por su serializer y lo ya subido por el comando).
"""
import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image, ImageFilter, ImageOps

from apps.media.models import Archivo
from apps.media.optimizador import ACEPTABLE, BAJA, BUENA, diagnosticar, procesar


# --------------------------------------------------------------------------
# Imágenes de prueba
# --------------------------------------------------------------------------
def _foto(ancho=1200, alto=900):
    """
    Algo parecido a una foto: detalle a varias escalas, desde manchas grandes
    hasta grano fino. Sin las escalas grandes, al reducirla para pixelarla
    quedaría un gris liso que ya no se parece a nada.
    """
    capas = [
        Image.effect_noise((max(2, ancho // escala), max(2, alto // escala)), 50).resize((ancho, alto), Image.BICUBIC)
        for escala in (64, 16, 4)
    ]
    gris = Image.blend(Image.blend(capas[0], capas[1], 0.4), capas[2], 0.3)
    fino = Image.effect_noise((ancho, alto), 20).filter(ImageFilter.GaussianBlur(0.6))
    gris = ImageOps.autocontrast(Image.blend(gris, fino, 0.2), cutoff=1)
    return Image.merge("RGB", (gris, gris.transpose(Image.FLIP_LEFT_RIGHT), gris.transpose(Image.FLIP_TOP_BOTTOM)))


def _pixelada(ancho=1200, alto=900, bloque=6):
    pequena = _foto(ancho, alto).resize((ancho // bloque, alto // bloque), Image.LANCZOS)
    return pequena.resize((ancho, alto), Image.NEAREST)


def _ampliada(ancho=1200, alto=900, factor=3):
    pequena = _foto(ancho, alto).resize((ancho // factor, alto // factor), Image.LANCZOS)
    return pequena.resize((ancho, alto), Image.BICUBIC)


def _bytes(img, formato="PNG", **opciones):
    salida = io.BytesIO()
    img.save(salida, formato, **opciones)
    return salida.getvalue()


def _subida(img, nombre="foto.png", formato="PNG", content_type="image/png", **opciones):
    return SimpleUploadedFile(nombre, _bytes(img, formato, **opciones), content_type=content_type)


# --------------------------------------------------------------------------
# Diagnóstico
# --------------------------------------------------------------------------
def test_una_foto_nitida_no_es_pixelada():
    d = diagnosticar(_foto())
    assert not d.pixelada and not d.ampliada
    assert d.calidad == BUENA
    assert d.motivos == []


def test_detecta_la_pixelada_y_estima_el_bloque():
    d = diagnosticar(_pixelada(bloque=6))
    assert d.pixelada
    assert d.calidad == BAJA
    assert 5 <= d.bloque <= 7
    # La resolución real es la de la imagen pequeña que se agrandó.
    assert d.ancho_efectivo < 300
    assert "pixelada" in d.motivos[0]
    assert d.recomendacion


def test_la_pixelada_se_reconoce_aun_recomprimida_en_jpeg():
    recomprimida = Image.open(io.BytesIO(_bytes(_pixelada(bloque=4), "JPEG", quality=75)))
    assert diagnosticar(recomprimida).pixelada


def test_detecta_la_foto_ampliada_con_suavizado():
    d = diagnosticar(_ampliada(factor=3))
    assert d.ampliada and not d.pixelada
    assert d.calidad == BAJA
    assert d.ancho_efectivo <= 600


def test_una_foto_pequena_pero_honesta_es_aceptable():
    d = diagnosticar(_foto(800, 600))
    assert not d.pixelada and not d.ampliada
    assert d.calidad == ACEPTABLE


def test_un_fondo_liso_no_se_confunde_con_bloques():
    """Un producto sobre fondo blanco: lo liso no cuenta como «plano»."""
    lienzo = Image.new("RGB", (1200, 900), "white")
    lienzo.paste(_foto(400, 400), (400, 250))
    assert not diagnosticar(lienzo).pixelada


# --------------------------------------------------------------------------
# Optimización
# --------------------------------------------------------------------------
def test_reduce_al_lado_maximo_y_pasa_a_webp(settings):
    settings.IMAGENES_LADO_MAXIMO = 1000
    original = _bytes(_foto(3000, 2000))
    r = procesar(io.BytesIO(original), "maracuya.png")
    assert r.optimizada
    assert r.nombre == "maracuya.webp"
    assert r.content_type == "image/webp"
    assert (r.ancho, r.alto) == (1000, 667)
    assert r.tamano < r.tamano_original == len(original)
    # El diagnóstico se hace sobre el original, no sobre la reducida.
    assert r.diagnostico.ancho == 3000


def test_conserva_la_transparencia():
    img = _foto(600, 600).convert("RGBA")
    img.putalpha(Image.linear_gradient("L").resize(img.size))
    r = procesar(io.BytesIO(_bytes(img)), "logo.png")
    assert Image.open(io.BytesIO(r.contenido)).mode == "RGBA"


def test_quita_los_metadatos_y_endereza_por_exif():
    img = _foto(400, 300)
    exif = Image.Exif()
    exif[0x0112] = 6  # rotada 90°
    exif[0x010F] = "Teléfono de prueba"
    r = procesar(io.BytesIO(_bytes(img, "JPEG", exif=exif, quality=95)), "foto.jpg")
    salida = Image.open(io.BytesIO(r.contenido))
    assert salida.size == (300, 400)
    assert not salida.getexif()


def test_un_jpeg_ya_liviano_se_queda_como_esta():
    original = _bytes(_foto(600, 450), "JPEG", quality=20)
    r = procesar(io.BytesIO(original), "liviana.jpg")
    assert not r.optimizada
    assert r.contenido == original and r.nombre == "liviana.jpg"
    assert r.content_type == "image/jpeg"


def test_un_webp_del_tamano_justo_no_se_recodifica():
    original = _bytes(_foto(800, 600), "WEBP", quality=80)
    r = procesar(io.BytesIO(original), "ya.webp")
    assert not r.optimizada
    assert r.contenido == original


@pytest.mark.parametrize(
    "datos",
    [
        b"\x89PNG\r\n\x1a\n" + b"\x00" * 64,  # no es una imagen de verdad
        b'<svg xmlns="http://www.w3.org/2000/svg"/>',
    ],
)
def test_lo_que_no_es_un_raster_se_deja_quieto(datos):
    assert procesar(io.BytesIO(datos), "x.png") is None


def test_un_gif_se_deja_quieto():
    assert procesar(io.BytesIO(_bytes(_foto(100, 100), "GIF")), "a.gif") is None


# --------------------------------------------------------------------------
# Puertas de entrada
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_la_foto_de_una_presentacion_se_guarda_optimizada(api_owner, presentacion, negocio):
    r = api_owner.post(
        f"/api/catalog/presentations/{presentacion.id}/imagen/",
        {"imagen": _subida(_foto(2600, 1800), "bulto.jpg", "JPEG", "image/jpeg", quality=92)},
        format="multipart",
    )
    assert r.status_code == 200, r.data
    presentacion.refresh_from_db()
    assert presentacion.imagen.name.startswith(f"tenants/{negocio.uuid}/productos/presentaciones/")
    assert presentacion.imagen.name.endswith(".webp")  # se redujo: deja de ser JPEG
    with presentacion.imagen.open("rb") as f:
        assert max(Image.open(f).size) == 2000


@pytest.mark.django_db
def test_guardar_otra_cosa_no_reprocesa_la_foto(producto):
    producto.imagen = ContentFile(_bytes(_foto(900, 900)), name="mango.png")
    producto.save()
    nombre = producto.imagen.name
    producto.save()
    assert producto.imagen.name == nombre


@pytest.mark.django_db
def test_la_biblioteca_guarda_el_diagnostico(api_owner):
    r = api_owner.post(
        "/api/media/archivos/",
        {"archivo": _subida(_pixelada(bloque=8), "captura.jpg", "JPEG", "image/jpeg", quality=95)},
        format="multipart",
    )
    assert r.status_code == 201, r.data
    datos = r.json()
    assert datos["calidad"] == BAJA
    assert datos["diagnostico"]["pixelada"] is True
    assert datos["content_type"] == "image/webp"
    assert datos["nombre_original"] == "captura.jpg"
    assert datos["tamano"] < datos["tamano_original"]
    assert Archivo.objects.get(id=datos["id"]).archivo.name.endswith(".webp")


@pytest.mark.django_db
def test_el_comando_optimiza_lo_ya_subido(producto, negocio):
    # Lo de antes del optimizador: guardado sin pasar por la señal.
    nombre = producto.imagen.storage.save(
        f"tenants/{negocio.uuid}/productos/vieja.png", ContentFile(_bytes(_foto(2500, 2500)))
    )
    type(producto).all_tenants.filter(pk=producto.pk).update(imagen=nombre)

    salida = io.StringIO()
    call_command("optimizar_imagenes", "--dry-run", stdout=salida)
    producto.refresh_from_db()
    assert producto.imagen.name == nombre
    assert "Se ahorrarían" in salida.getvalue()

    call_command("optimizar_imagenes", stdout=io.StringIO())
    producto.refresh_from_db()
    assert producto.imagen.name.endswith(".webp")
    assert producto.imagen.storage.exists(nombre)  # el original se conserva


@pytest.mark.django_db
def test_el_comando_solo_diagnostica_la_biblioteca(api_owner):
    r = api_owner.post(
        "/api/media/archivos/", {"archivo": _subida(_ampliada(), "banner.png")}, format="multipart"
    )
    archivo = Archivo.objects.get(id=r.json()["id"])
    Archivo.all_tenants.filter(pk=archivo.pk).update(calidad="", diagnostico={})

    call_command("optimizar_imagenes", stdout=io.StringIO())
    archivo.refresh_from_db()
    assert archivo.calidad == BAJA
    assert archivo.diagnostico["ampliada"] is True
