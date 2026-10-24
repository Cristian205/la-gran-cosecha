"""
Optimizador de imágenes: lo que se sube se guarda listo para la web y con un
diagnóstico de calidad.

Por qué existe: los paneles guardaban las fotos tal como salían del teléfono
o de internet (un PNG de 4 MB para una miniatura), y la tienda las servía así.
Aquí cada imagen que entra a la plataforma:

1. Se endereza según su EXIF y pierde los metadatos (ubicación del teléfono
   incluida: no tienen por qué acabar en un bucket público).
2. Se reduce si pasa del lado máximo; nunca se agranda.
3. Se recodifica en WebP, que conserva la transparencia de los PNG. Si el
   resultado no es más liviano que el original y no hubo que reducirla, se
   queda el original: recomprimir un JPEG ya bueno solo le resta calidad.
4. Se diagnostica: ¿está pixelada?, ¿es una foto pequeña que alguien amplió?,
   ¿le alcanza la resolución? El diagnóstico NO bloquea la subida; la
   biblioteca lo muestra para que quien la subió decida si busca otra.

Todo con Pillow y sin numpy: las medidas salen de operaciones de imagen
(diferencias y promedios por reducción en caja), que Pillow hace en C.

Cómo se reconoce una imagen pixelada
------------------------------------
Al ampliar una foto pequeña «por vecino más cercano» cada píxel original se
vuelve un bloque de NxN idénticos. Dentro de un bloque la diferencia entre
columnas vecinas es cero; solo en el borde del bloque salta. En una foto real
esas diferencias se reparten de forma continua. Así que, en las zonas con
textura (en un fondo blanco liso todo es «plano» y no dice nada), se mide qué
parte de las columnas y de las filas es plana frente a las que tienen borde:
más de la mitad plana en ambos sentidos es una cuadrícula de bloques, y la
distancia entre bordes da el tamaño del bloque.

Cómo se reconoce una foto ampliada (borrosa)
--------------------------------------------
Una foto agrandada con suavizado no tiene bloques, pero tampoco detalle fino:
si se reduce a la mitad y se vuelve a agrandar, casi no cambia. En una foto
nacida a ese tamaño se pierde bastante. La razón entre lo que se pierde y la
textura de la imagen estima la resolución que de verdad tiene.
"""
from __future__ import annotations

import io
import logging
import posixpath
from dataclasses import asdict, dataclass, field
from statistics import median

from django.conf import settings
from PIL import Image, ImageChops, ImageOps, ImageStat, UnidentifiedImageError

logger = logging.getLogger(__name__)

# Más píxeles que esto no se abren: una «bomba de descompresión» (un PNG de
# pocos KB que declara 50.000x50.000) tumbaría el servidor al decodificarla.
PIXELES_MAXIMOS = 60_000_000

FORMATOS_RASTER = {"JPEG", "PNG", "WEBP", "MPO", "BMP", "TIFF"}

# Calidades del diagnóstico. Los textos para el panel van en `motivos`.
BUENA = "BUENA"
ACEPTABLE = "ACEPTABLE"
BAJA = "BAJA"

# --- Pixelado (bloques) ---
TESELA = 64
DESVIACION_TEXTURA = 12      # gris: menos que esto es una zona lisa
# Una diferencia por debajo de esta fracción del borde típico (percentil 90
# del perfil) cuenta como plana. 0,4 y no menos: el JPEG deja ruido dentro
# de los bloques y con un umbral más estricto la cuadrícula se le escapa.
FACTOR_PLANO = 0.4
# Calibrado con 22 fotos reales del catálogo de La Gran Cosecha: las
# originales (y recomprimidas a JPEG 30) dan como mucho 0,30; las mismas
# ampliadas por vecino más cercano x2 a x6, aun recomprimidas, desde 0,35.
FRACCION_PLANA_PIXELADA = 0.36
TESELAS_MINIMAS = 6

# --- Ampliación (borrosa) ---
# Razón entre lo que se pierde al reducir y volver a ampliar, y la textura.
# Por debajo de esto, la versión reducida ya contaba toda la imagen. En la
# calibración las originales dieron desde 0,36 y las ampliadas x3 con
# suavizado hasta 0,26 (las x2 entre 0,19 y 0,48: solo se detectan algunas).
DETALLE_MINIMO = 0.30
FACTORES_AMPLIACION = (2, 3, 4)

# --- Resolución ---
LADO_BUENO = 1000
LADO_ACEPTABLE = 600


def lado_maximo() -> int:
    return getattr(settings, "IMAGENES_LADO_MAXIMO", 2000)


def calidad_webp() -> int:
    return getattr(settings, "IMAGENES_CALIDAD_WEBP", 80)


# --------------------------------------------------------------------------
# Diagnóstico
# --------------------------------------------------------------------------
@dataclass
class Diagnostico:
    calidad: str
    pixelada: bool
    ampliada: bool
    ancho: int
    alto: int
    # La resolución que de verdad tiene: menor que ancho x alto cuando está
    # pixelada o ampliada.
    ancho_efectivo: int
    alto_efectivo: int
    bloque: int | None = None
    motivos: list[str] = field(default_factory=list)
    recomendacion: str = ""
    # Las medidas en bruto, para ajustar umbrales sin tener que volver a
    # descargar las imágenes.
    medidas: dict = field(default_factory=dict)

    def como_dict(self) -> dict:
        return asdict(self)


def _a_gris(img: Image.Image) -> Image.Image:
    """Escala de grises; lo transparente cuenta como fondo blanco."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        fondo = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        return Image.alpha_composite(fondo, rgba).convert("L")
    return img.convert("L")


def _zona_central(gris: Image.Image, lado: int = 1024) -> Image.Image:
    """
    Un recorte central a resolución NATIVA. Reducir antes de medir borraría
    justo los bloques que se buscan; recortar acota el costo en fotos grandes.
    """
    w, h = gris.size
    if w <= lado and h <= lado:
        return gris
    x = max(0, (w - lado) // 2)
    y = max(0, (h - lado) // 2)
    return gris.crop((x, y, x + min(w, lado), y + min(h, lado)))


def _perfil_plano(perfil: list[float]) -> tuple[float, int] | None:
    """
    (fracción de posiciones planas, cuántas son borde) de un perfil de
    diferencias. None si el perfil no tiene contraste suficiente para opinar.
    """
    ordenado = sorted(perfil)
    referencia = ordenado[int(len(ordenado) * 0.9)]
    if referencia < 4:
        return None
    umbral = referencia * FACTOR_PLANO
    planas = sum(1 for v in perfil if v < umbral)
    return planas / len(perfil), len(perfil) - planas


def _medir_bloques(zona: Image.Image) -> dict:
    w, h = zona.size
    if w < TESELA + 1 or h < TESELA + 1:
        return {"teselas": 0}
    # |columna x+1 − columna x| y |fila y+1 − fila y|, en flotante para que
    # los promedios pequeños no se redondeen a cero.
    dif_col = ImageChops.difference(zona.crop((1, 0, w, h)), zona.crop((0, 0, w - 1, h))).convert("F")
    dif_fil = ImageChops.difference(zona.crop((0, 1, w, h)), zona.crop((0, 0, w, h - 1))).convert("F")

    fracciones, bloques = [], []
    for y in range(0, h - TESELA, TESELA):
        for x in range(0, w - TESELA, TESELA):
            tesela = zona.crop((x, y, x + TESELA, y + TESELA))
            if ImageStat.Stat(tesela).stddev[0] < DESVIACION_TEXTURA:
                continue
            n = TESELA - 1
            # Reducir en caja a una sola fila promedia cada columna: el perfil
            # de la tesela sale de una operación en C, sin recorrer píxeles.
            columnas = list(dif_col.crop((x, y, x + n, y + TESELA)).resize((n, 1), Image.BOX).get_flattened_data())
            filas = list(dif_fil.crop((x, y, x + TESELA, y + n)).resize((1, n), Image.BOX).get_flattened_data())
            pc, pf = _perfil_plano(columnas), _perfil_plano(filas)
            if pc is None or pf is None:
                continue
            fracciones.append(min(pc[0], pf[0]))
            bordes = (pc[1] + pf[1]) / 2
            if bordes:
                bloques.append(n / bordes)
    if not fracciones:
        return {"teselas": 0}
    return {
        "teselas": len(fracciones),
        "fraccion_plana": round(median(fracciones), 3),
        "bloque": round(median(bloques), 1) if bloques else None,
    }


def _medir_detalle(zona: Image.Image, factor: int) -> float | None:
    """Lo que se pierde al reducir `factor` veces, relativo a la textura."""
    w, h = zona.size
    if w // factor < 32 or h // factor < 32:
        return None
    textura = ImageStat.Stat(ImageChops.difference(zona.crop((1, 0, w, h)), zona.crop((0, 0, w - 1, h)))).mean[0]
    if textura < 1:
        return None  # una imagen casi lisa no dice nada
    ida_y_vuelta = zona.resize((w // factor, h // factor), Image.LANCZOS).resize((w, h), Image.BICUBIC)
    perdido = ImageStat.Stat(ImageChops.difference(zona, ida_y_vuelta)).mean[0]
    return round(perdido / textura, 3)


def _factor_ampliacion(zona: Image.Image) -> tuple[int, dict]:
    """
    Cuántas veces se amplió la imagen (1 si no): el mayor factor al que se
    puede reducir sin perder detalle.
    """
    detalles = {f: _medir_detalle(zona, f) for f in FACTORES_AMPLIACION}
    factor = 1
    for f, detalle in detalles.items():
        if detalle is None or detalle >= DETALLE_MINIMO:
            break
        factor = f
    return factor, {f"detalle_x{f}": d for f, d in detalles.items()}


def diagnosticar(img: Image.Image) -> Diagnostico:
    """El diagnóstico de calidad de una imagen ya abierta (y enderezada)."""
    ancho, alto = img.size
    zona = _zona_central(_a_gris(img))
    bloques = _medir_bloques(zona)

    pixelada = (
        bloques.get("teselas", 0) >= TESELAS_MINIMAS
        and bloques.get("fraccion_plana", 0) >= FRACCION_PLANA_PIXELADA
        and (bloques.get("bloque") or 0) >= 1.6
    )
    # Una imagen pixelada pasa la prueba de detalle de sobra (sus bordes de
    # bloque son puro detalle falso), así que solo se mide si no lo está.
    factor_ampliacion, detalles = (1, {}) if pixelada else _factor_ampliacion(zona)
    ampliada = factor_ampliacion > 1

    factor = 1.0
    bloque = None
    if pixelada:
        bloque = max(2, round(bloques["bloque"]))
        factor = bloques["bloque"]
    elif ampliada:
        factor = factor_ampliacion
    ancho_ef, alto_ef = int(ancho / factor), int(alto / factor)
    lado_ef = max(ancho_ef, alto_ef)

    motivos = []
    if pixelada:
        motivos.append(
            f"Está pixelada: se ven bloques de unos {bloque} px. Es una imagen pequeña "
            f"que alguien agrandó; su resolución real es de unos {ancho_ef}×{alto_ef} px."
        )
    elif ampliada:
        motivos.append(
            f"Se ve borrosa: parece una foto de unos {ancho_ef}×{alto_ef} px agrandada "
            f"a {ancho}×{alto}. No tiene detalle fino."
        )
    if lado_ef < LADO_ACEPTABLE:
        motivos.append(f"Resolución baja ({ancho_ef}×{alto_ef} px): se verá pixelada en pantallas grandes.")
    elif lado_ef < LADO_BUENO:
        motivos.append(f"Resolución justa ({ancho_ef}×{alto_ef} px): bien para tarjetas, corta para un banner.")

    if pixelada or ampliada or lado_ef < LADO_ACEPTABLE:
        calidad = BAJA
        recomendacion = (
            f"Busca el archivo original o toma una foto nueva de al menos {LADO_BUENO} px "
            "en su lado más largo. Evita capturas de pantalla e imágenes descargadas de redes."
        )
    elif lado_ef < LADO_BUENO:
        calidad = ACEPTABLE
        recomendacion = f"Sirve para el catálogo; para banners usa una de al menos {LADO_BUENO} px."
    else:
        calidad = BUENA
        recomendacion = ""

    return Diagnostico(
        calidad=calidad,
        pixelada=pixelada,
        ampliada=ampliada,
        ancho=ancho,
        alto=alto,
        ancho_efectivo=ancho_ef,
        alto_efectivo=alto_ef,
        bloque=bloque,
        motivos=motivos,
        recomendacion=recomendacion,
        medidas={**bloques, **detalles},
    )


# --------------------------------------------------------------------------
# Optimización
# --------------------------------------------------------------------------
@dataclass
class Resultado:
    contenido: bytes
    nombre: str
    content_type: str
    ancho: int
    alto: int
    tamano_original: int
    tamano: int
    # False: se conserva el archivo original (ya era liviano).
    optimizada: bool
    diagnostico: Diagnostico


def _leer(archivo) -> bytes:
    if hasattr(archivo, "seek"):
        archivo.seek(0)
    datos = archivo.read()
    if hasattr(archivo, "seek"):
        archivo.seek(0)
    return datos


def _con_extension(nombre: str, ext: str) -> str:
    base = posixpath.basename((nombre or "imagen").replace("\\", "/"))
    raiz = base.rsplit(".", 1)[0] if "." in base else base
    return f"{raiz or 'imagen'}.{ext}"


def procesar(archivo, nombre: str = "", formato: str = "WEBP") -> Resultado | None:
    """
    Optimiza y diagnostica un archivo de imagen (cualquier objeto con `read`).

    `formato` es el de salida: WebP para la web, PNG para lo que también va
    en correos (el logo): Outlook de escritorio no muestra WebP.

    Devuelve None cuando no es una imagen que convenga tocar —SVG, GIF
    (puede ser animado), algo que Pillow no lee o demasiado grande para
    abrirse con seguridad— y en ese caso el archivo se guarda tal cual.
    """
    datos = _leer(archivo)
    nombre = nombre or getattr(archivo, "name", "") or "imagen"
    try:
        with Image.open(io.BytesIO(datos)) as abierta:
            if abierta.format not in FORMATOS_RASTER:
                return None
            if abierta.width * abierta.height > PIXELES_MAXIMOS:
                return None
            if getattr(abierta, "n_frames", 1) > 1 and abierta.format != "MPO":
                return None  # WebP o PNG animados
            img = ImageOps.exif_transpose(abierta)
            img.load()
            formato_original = abierta.format
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None

    diagnostico = diagnosticar(img)

    def original() -> Resultado:
        return Resultado(
            contenido=datos,
            nombre=nombre,
            content_type=Image.MIME.get(formato_original, "application/octet-stream"),
            ancho=diagnostico.ancho,
            alto=diagnostico.alto,
            tamano_original=len(datos),
            tamano=len(datos),
            optimizada=False,
            diagnostico=diagnostico,
        )

    lado = lado_maximo()
    reducida = max(img.size) > lado
    # Un WebP del tamaño justo se queda como está: recodificarlo solo le
    # restaría calidad. Pasa, por ejemplo, al reusar una imagen de la
    # biblioteca (ya optimizada) en otro formulario.
    if not reducida and formato_original == formato:
        return original()
    if reducida:
        img.thumbnail((lado, lado), Image.LANCZOS)

    con_alfa = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if con_alfa:
        img = img.convert("RGBA")
        # Un canal alfa todo opaco no aporta nada y pesa.
        if img.getchannel("A").getextrema() == (255, 255):
            img = img.convert("RGB")
    else:
        img = img.convert("RGB")

    salida = io.BytesIO()
    # Sin `exif` ni `icc_profile`: los metadatos se quedan fuera. `method=4`
    # es el punto medio de velocidad: 6 comprime un poco más y tarda el doble.
    if formato == "PNG":
        img.save(salida, "PNG", optimize=True)
    else:
        img.save(salida, "WEBP", quality=calidad_webp(), method=4)
    nuevo = salida.getvalue()

    # Si el original ya era más liviano que su versión WebP, se queda: no se
    # ganaría nada y se perdería calidad (pasa con JPEG bien comprimidos y con
    # PNG de pocos colores, como un logo o una captura pixelada).
    if not reducida and len(nuevo) >= len(datos):
        return original()

    return Resultado(
        contenido=nuevo,
        nombre=_con_extension(nombre, formato.lower()),
        content_type=f"image/{formato.lower()}",
        ancho=img.width,
        alto=img.height,
        tamano_original=len(datos),
        tamano=len(nuevo),
        optimizada=True,
        diagnostico=diagnostico,
    )
