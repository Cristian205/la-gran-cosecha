"""
Maquetación adaptativa de la factura: decide cuántas columnas y qué tamaño de
letra usar para que el pedido entre en una sola hoja, sea de 5 artículos o de
100, sin dejar media página en blanco cuando son pocos.

La idea es medir en puntos (pt) lo que va a ocupar cada categoría y elegir,
entre una escala de densidades tipográficas, la letra más grande que todavía
permita cuadrarlo todo en la altura útil de la hoja. Como el modelo de altura
depende de que cada artículo ocupe exactamente una línea, la hoja de estilos
recorta con ellipsis los nombres que no caben en el ancho de su columna.

Cuando sobra sitio se añaden hasta `FILAS_VACIAS_POR_CATEGORIA` renglones en
blanco al final de cada categoría, para anotar a mano productos de última hora.
"""
from dataclasses import dataclass
from fractions import Fraction
from math import floor

# --------------------------------------------------------------------------
# Geometría de la hoja
# --------------------------------------------------------------------------
# Formato "Ejecutivo" (7,25 × 10,5 in) con los márgenes amplios que explica el
# @page de `_factura_styles.html` (se imprime sobre papel de 17 × 24,5 cm).
# Medido sobre el PDF ya renderizado con el encabezado MÁS ALTO posible (logo,
# chip secundario y dirección en dos líneas; la hoja de estilos le pone tope),
# las columnas de productos empiezan a 182,2pt del borde y el pie con el total
# arranca en 636,2pt: quedan 454,0pt. Se reserva un colchón para no pegarse al
# pie (el modelo predice bien, pero un redondeo no debe pisar el total).
ALTO_UTIL_PT = 436.5

# Ancho útil de la fila de columnas (~16cm), para repartirlo entre columnas.
ANCHO_UTIL_PT = 450.0

# Cuando el pedido no cabe en una hoja se reparte en varias (ver
# `_plan_varias_hojas`). Ahí el pie con el total deja de ir anclado abajo y
# fluye tras el último producto, así que cada hoja solo descuenta lo que de
# verdad lleva: la primera, el encabezado (139,7pt en el peor caso); las siguientes,
# nada. Mismo colchón que arriba.
ALTO_CONTENIDO_HOJA_PT = 639.7  # 10,5in menos los márgenes de 1,5 y 2,6cm
ALTO_PRIMERA_HOJA_PT = ALTO_CONTENIDO_HOJA_PT - 139.7 - 17.5
ALTO_HOJA_SIGUIENTE_PT = ALTO_CONTENIDO_HOJA_PT - 17.5

# Renglones en blanco que se le dejan a cada categoría cuando hay espacio.
FILAS_VACIAS_POR_CATEGORIA = 2

# Una sola columna se reserva para el pedido de una única categoría corta; con
# varias categorías siempre se reparte a dos o más, porque una tabla de 19cm de
# ancho para tres datos se ve desangelada. Más de cinco tampoco: por debajo de
# ~3,5cm de ancho ya no cabe un nombre de producto útil.
COLUMNAS_CANDIDATAS = (1, 2, 3, 4, 5)

# Al partir una categoría entre dos columnas, no dejar un trozo ridículo.
MIN_FILAS_AL_PARTIR = 3

# Cuando el pedido es corto sobra media hoja. En vez de dejarla en blanco se
# reparte el sobrante engordando el padding de las filas, hasta este tope (en
# px por lado): pasado ahí las filas se ven despegadas unas de otras.
MAX_PAD_EXTRA_PX = 7.0

# Del sobrante solo se reparte esta fracción, para no comerse el colchón que
# separa la última fila del pie con el total.
FRACCION_SOBRANTE_A_REPARTIR = 0.85

# El ancho de las celdas no es fijo: cantidad y precio miden lo justo para la
# cifra más ancha DE ESTE PEDIDO (ver `_anchos_celdas`) y el resto es para el
# nombre del artículo. Con anchos fijos sobraba sitio en casi todas las filas
# y, aun así, un solo "$ 1.068.000" descartaba las facturas de tres columnas.
# Estos son los de respaldo (un plan sin artículos).
ANCHOS_POR_DEFECTO = (0.48, 0.22, 0.30)
# El nombre nunca se queda con menos que esto de la columna.
MIN_FRACCION_ARTICULO = 0.42
# Holgura sobre lo medido en cantidad y precio: si una cifra no cabe, la celda
# la corta, y un precio "$ 12.…" no se entiende.
HOLGURA_CIFRAS = 1.06
# Y un extra fijo: la píldora de la unidad se dibuja con algo más de lo que da
# la suma de sus letras (medido sobre el PDF: hasta 0,6pt).
EXTRA_CIFRAS_PT = 1.5
# Espaciado entre letras de los títulos "CANT." y "PRECIO" (0,3px): la celda
# tampoco puede quedar más angosta que ellos.
ESPACIADO_TITULO_PT = 0.225

# Relleno de la píldora de la unidad, en em de SU letra (el 85% de la del
# artículo): 0,45 a cada lado y 0,35 de margen, igual que `.unit-pill`. Antes
# eran 10,5pt fijos, que en una columna estrecha se comían la celda y
# descartaban siempre las facturas de tres columnas.
PILL_RELLENO_EM = 0.45 * 2 + 0.35

# Un nombre cuenta como recortado si no entra en el 97% de su celda: el ancho
# se mide letra por letra (ver `_ancho_texto`), así que el margen solo cubre
# el redondeo del renderizado. La información no debe salir cortada.
MARGEN_RECORTE = 0.97

# Anchos reales de Helvetica/Arial (y de Liberation Sans, que es la que usa el
# servidor: tiene las mismas medidas), en milésimas de em, de las métricas AFM
# estándar. Medir con un promedio por letra sobrestimaba las cifras —el punto
# y el espacio miden la mitad que un dígito— y subestimaba las mayúsculas, y
# con eso las celdas salían o muy anchas o cortadas.
_ANCHOS_REGULAR = {
    **dict.fromkeys("0123456789$", 556), " ": 278, ".": 278, ",": 278, "/": 278,
    "-": 333, "(": 333, ")": 333, "#": 556, "%": 889, "&": 667, "@": 1015, "x": 500,
    "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556, "h": 556,
    "i": 222, "j": 222, "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556,
    "q": 556, "r": 333, "s": 500, "t": 278, "u": 556, "v": 500, "w": 722,
    "y": 500, "z": 500,
    "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722,
    "I": 278, "J": 500, "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667,
    "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944, "X": 667,
    "Y": 667, "Z": 611,
}
_ANCHOS_NEGRITA = {
    **_ANCHOS_REGULAR,
    "(": 333, ")": 333, "-": 333, "#": 556, "&": 722, "@": 975,
    "a": 556, "b": 611, "c": 556, "d": 611, "e": 556, "f": 333, "g": 611, "h": 611,
    "i": 278, "j": 278, "k": 556, "l": 278, "m": 889, "n": 611, "o": 611, "p": 611,
    "q": 611, "r": 389, "s": 556, "t": 333, "u": 611, "v": 556, "w": 778, "x": 556,
    "y": 556, "z": 500,
    "A": 722, "B": 722, "J": 556, "K": 722, "L": 611,
}
# Una letra con tilde mide lo mismo que la base.
_SIN_TILDE = str.maketrans("áéíóúÁÉÍÓÚñÑüÜ", "aeiouAEIOUnNuU")


def _ancho_texto(texto: str, fuente_pt: float, negrita: bool = False, mayusculas: bool = False) -> float:
    """Lo que ocupa `texto` en puntos, en Helvetica/Arial del cuerpo dado."""
    tabla = _ANCHOS_NEGRITA if negrita else _ANCHOS_REGULAR
    texto = str(texto or "")
    if mayusculas:
        texto = texto.upper()
    milesimas = sum(tabla.get(c, 600) for c in texto.translate(_SIN_TILDE))
    return milesimas / 1000 * fuente_pt


def pad_horizontal_px(fuente_pt: float) -> float:
    """
    Padding lateral de cada celda: proporcional a la letra, entre 3,5 y 6px.

    Con 6px fijos, en letra pequeña el relleno se comía el ancho que le hacía
    falta al nombre. Debe coincidir con `--pad-h` en la hoja de estilos.
    """
    return round(max(3.5, min(6.0, fuente_pt * 0.72)), 2)

# Por debajo de este cuerpo la factura deja de leerse con comodidad. Se elige
# siempre entre las densidades que lo respetan; solo se baja de aquí cuando el
# pedido es tan grande que de otro modo no cabría en la hoja.
FUENTE_MINIMA_COMODA = 6.1

# Las categorías especiales se maquetan aparte, a lo ancho, en 2 columnas al
# 50% (los renglones de "Otros Productos" llevan dos líneas y a tres columnas
# quedaban demasiado estrechos).
COLUMNAS_ESPECIALES = 2

# La tabla única de las categorías especiales, en la franja o en las columnas.
NOMBRE_OTROS = "Otros Productos"


@dataclass(frozen=True)
class Densidad:
    """Un escalón de la escala tipográfica, con lo que mide cada pieza."""

    nombre: str
    fuente_pt: float
    pad_v_px: float

    @property
    def _pad_pt(self) -> float:
        return self.pad_v_px * 0.75  # 1px = 0.75pt

    # Las tres fórmulas siguientes replican al pie de la letra lo que hace la
    # hoja de estilos (`_factura_styles.html`); si allí cambia un line-height o
    # un padding, hay que cambiarlo aquí o la factura dejará de caber.

    @property
    def fila_pt(self) -> float:
        """
        Alto de una fila de artículo: line-height 1.35 + padding + borde, más
        un cuarto de punto de colchón porque WeasyPrint redondea el alto de
        línea a píxeles enteros y con las letras pequeñas se queda algo por
        encima de la cuenta.
        """
        return self.fuente_pt * 1.35 + self._pad_pt * 2 + 0.75 + 0.3

    @property
    def cabecera_pt(self) -> float:
        """Franja verde de la categoría: fuente al 95%, line-height 1.3, padding 4px."""
        return self.fuente_pt * 0.95 * 1.3 + 4.0 * 2 * 0.75

    @property
    def thead_pt(self) -> float:
        """Fila de títulos: fuente al 85%, line-height 1.3, padding 3px + borde."""
        return self.fuente_pt * 0.85 * 1.3 + 3.0 * 2 * 0.75 + 0.75

    @property
    def marco_pt(self) -> float:
        """Bordes de la tarjeta y separación con la categoría siguiente."""
        return 7.0

    @property
    def fijo_por_categoria_pt(self) -> float:
        return self.cabecera_pt + self.thead_pt + self.marco_pt

    def alto_categoria(self, n_filas: int) -> float:
        return self.fijo_por_categoria_pt + n_filas * self.fila_pt

    def filas_que_caben(self, espacio_pt: float) -> int:
        """Cuántas filas de artículo caben en `espacio_pt`, ya con su cabecera."""
        libre = espacio_pt - self.fijo_por_categoria_pt
        if libre <= 0:
            return 0
        return int(floor(libre / self.fila_pt))


# De la letra más cómoda a la más apretada. La factura elige la primera que
# permita cuadrar el pedido en una hoja.
#
# El techo son 8,5pt: por encima, la letra de los artículos desentona con el
# resto de la factura y, sobre todo, obliga a repartir en más columnas —y por
# tanto más estrechas—, que es justo lo que hace que los nombres de producto
# se corten. Menos letra aquí significa columnas más anchas y nombres enteros.
DENSIDADES = (
    Densidad("amplia", 8.5, 4.0),
    Densidad("normal", 7.8, 3.2),
    Densidad("comoda", 7.2, 2.6),
    Densidad("compacta", 6.6, 2.1),
    Densidad("densa", 6.1, 1.6),
    Densidad("micro", 5.6, 1.1),
    Densidad("minima", 5.1, 0.6),
    Densidad("apretada", 4.7, 0.4),
)


@dataclass
class Seccion:
    """Un trozo de categoría ya colocado en una columna concreta."""

    categoria: object
    items: list
    filas_vacias: int
    continuacion: bool = False   # viene partida de la columna anterior
    continua: bool = False       # sigue en la columna siguiente

    @property
    def rango_vacias(self):
        return range(self.filas_vacias)

    @property
    def nombre(self) -> str:
        nombre = getattr(self.categoria, "nombre_categoria", None) or str(self.categoria)
        return f"{nombre} (cont.)" if self.continuacion else nombre


@dataclass
class Plan:
    """Resultado de la maquetación, listo para la plantilla."""

    columnas: list
    densidad: Densidad
    n_columnas: int
    filas_vacias: int
    alto_maximo_pt: float
    alto_disponible_pt: float
    cabe_en_una_hoja: bool
    pad_extra_px: float = 0.0
    # Solo cuando no cabe en una: las columnas de cada hoja, en orden.
    hojas: list | None = None
    # "Otros Productos" va como una tabla más en las columnas y no en su franja
    # a lo ancho (ver `planificar`): la plantilla no pinta la franja.
    especiales_en_columnas: bool = False
    # Fracción de la columna para artículo, cantidad y precio (ver
    # `_anchos_celdas`). La plantilla los aplica con `variables_css`.
    anchos: tuple = ANCHOS_POR_DEFECTO

    @property
    def paginas(self) -> list:
        """Las filas de columnas a pintar, una por hoja (casi siempre, una)."""
        return self.hojas or [self.columnas]

    @property
    def varias_hojas(self) -> bool:
        return bool(self.hojas) and len(self.hojas) > 1

    @property
    def pad_v_px(self) -> float:
        """Padding vertical final de cada celda, ya con el estirado aplicado."""
        return self.densidad.pad_v_px + self.pad_extra_px

    @property
    def variables_css(self) -> str:
        """
        Las custom properties que la plantilla inyecta en el bloque de columnas.

        Se arma aquí, y no interpolando los números sueltos en el HTML, porque
        el proyecto corre con LANGUAGE_CODE es-co: Django escribiría "11,0pt"
        con coma decimal, que como valor CSS es inválido y hacía que el tamaño
        de letra cayera al heredado, descuadrando toda la maquetación.
        """
        articulo, cantidad, precio = self.anchos
        return (
            f"--fs-item: {self.densidad.fuente_pt:.2f}pt; --pad-v: {self.pad_v_px:.2f}px; "
            f"--pad-h: {pad_horizontal_px(self.densidad.fuente_pt):.2f}px; "
            f"--w-art: {articulo * 100:.2f}%; --w-cant: {cantidad * 100:.2f}%; "
            f"--w-precio: {precio * 100:.2f}%;"
        )

    @property
    def ancho_columna_pt(self) -> float:
        return ANCHO_UTIL_PT / self.n_columnas

    @property
    def aprovechamiento(self) -> float:
        if self.alto_disponible_pt <= 0:
            return 0.0
        return self.alto_maximo_pt / self.alto_disponible_pt


def _contar_recortes(bloques, n_columnas: int, densidad: Densidad, fraccion_articulo: float) -> int:
    """
    Cuántos artículos no caben a lo ancho de su columna y saldrían cortados.

    Es lo que decide entre "más columnas con letra grande" y "menos columnas
    con letra algo menor": repartir 100 productos en cinco columnas deja cada
    una tan estrecha que solo entran diez caracteres del nombre.
    """
    disponible = (ANCHO_UTIL_PT / n_columnas) * fraccion_articulo - _pad_celda_pt(densidad)
    if disponible <= 0:
        return sum(len(items) for _, items in bloques)

    fuente = densidad.fuente_pt
    recortes = 0
    for _, items in bloques:
        for it in items:
            # La plantilla pinta "<b>Nombre</b> presentación".
            ancho = _ancho_texto(it.get("articulo"), fuente, negrita=True) + _ancho_texto(
                f" {it.get('pres') or ''}", fuente
            )
            if ancho > disponible * MARGEN_RECORTE:
                recortes += 1
    return recortes


def _pad_celda_pt(densidad: Densidad) -> float:
    """Los dos rellenos laterales de una celda, en pt (1px = 0,75pt)."""
    return pad_horizontal_px(densidad.fuente_pt) * 2 * 0.75


def _anchos_celdas(bloques, n_columnas: int, densidad: Densidad):
    """
    El ancho justo de cada celda para este pedido, o None si no caben.

    Cantidad y precio miden lo que ocupa su cifra más ancha (o su título, si
    es más ancho), con una holgura; el nombre del artículo se queda con el
    resto. Un nombre recortado se entiende; un precio "$ 12.…" no: si con
    este número de columnas el nombre se quedara con menos del mínimo, el
    reparto se descarta.
    """
    ancho_columna = ANCHO_UTIL_PT / n_columnas
    fuente = densidad.fuente_pt
    pequena = fuente * 0.85  # la unidad y los títulos van en letra al 85%
    pad = _pad_celda_pt(densidad)

    def titulo(texto):
        return _ancho_texto(texto, pequena, negrita=True) + len(texto) * ESPACIADO_TITULO_PT

    cantidad_max = titulo("CANT.")
    precio_max = titulo("PRECIO")
    for _, items in bloques:
        for it in items:
            precio = f"$ {int(it.get('subtotal') or 0):,}"
            precio_max = max(precio_max, _ancho_texto(precio, fuente, negrita=True))
            cantidad = _texto_cantidad(it.get("cant"))
            cantidad_max = max(
                cantidad_max,
                _ancho_texto(cantidad, fuente)
                + _ancho_texto(it.get("unidad"), pequena, negrita=True, mayusculas=True)
                + PILL_RELLENO_EM * pequena,
            )

    f_cantidad = (cantidad_max * HOLGURA_CIFRAS + EXTRA_CIFRAS_PT + pad) / ancho_columna
    f_precio = (precio_max * HOLGURA_CIFRAS + EXTRA_CIFRAS_PT + pad) / ancho_columna
    f_articulo = 1 - f_cantidad - f_precio
    if f_articulo < MIN_FRACCION_ARTICULO:
        return None
    return (f_articulo, f_cantidad, f_precio)


def _cifras_caben(bloques, n_columnas: int, densidad: Densidad) -> bool:
    """Si la cantidad y el precio de todos los artículos caben enteros."""
    return _anchos_celdas(bloques, n_columnas, densidad) is not None


def _texto_cantidad(valor) -> str:
    """La cantidad como la escribe el filtro `fraction` de la plantilla."""
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return str(valor or "")
    if numero.is_integer():
        return str(int(numero))
    fraccion = Fraction(numero).limit_denominator()
    return f"{fraccion.numerator}/{fraccion.denominator}"


def _alto_especiales(categorias_especiales, densidad: Densidad) -> float:
    """
    Alto de la franja de 'Otros Productos', que va a lo ancho al final.

    Cada renglón ocupa dos líneas (artículo y, debajo, su categoría) más la
    separación entre renglones. El reparto en columnas CSS no siempre queda
    exacto, así que se añade un margen: quedarse corto aquí manda la franja
    entera a una segunda hoja.
    """
    n_items = sum(len(items) for items in categorias_especiales.values())
    if n_items == 0:
        return 0.0
    filas = -(-n_items // COLUMNAS_ESPECIALES)  # ceil
    # Coeficientes ajustados midiendo la franja ya renderizada: la segunda
    # línea (la categoría, en letra pequeña) sale sobre media línea más.
    alto_renglon = densidad.fila_pt * 1.55
    estimado = densidad.cabecera_pt + densidad.marco_pt + 10.0 + filas * alto_renglon
    return estimado * 1.15


def _repartir(bloques, n_columnas, alto_columna, densidad, filas_vacias):
    """
    Reparte las categorías en `n_columnas` respetando el orden original.

    Rellena buscando un reparto parejo (objetivo = alto total / nº de columnas)
    y, cuando una categoría no cabe entera en una columna, la parte y la
    continúa en la siguiente: sin esto, una sola categoría con 60 artículos
    empujaría la factura a una segunda hoja por muchas columnas que hubiera.
    """
    columnas = [[] for _ in range(n_columnas)]
    alturas = [0.0] * n_columnas

    def alto_por_colocar(idx, pendientes):
        """Lo que falta por maquetar: el resto de esta categoría y las siguientes."""
        total = densidad.alto_categoria(len(pendientes) + filas_vacias)
        for _, items in bloques[idx + 1:]:
            total += densidad.alto_categoria(len(items) + filas_vacias)
        return total

    i = 0
    for idx, (categoria, items) in enumerate(bloques):
        pendientes = list(items)
        continuacion = False

        while pendientes:
            # Cuota recalculada en cada paso: reparte lo que queda entre las
            # columnas que quedan. Se recalcula en vez de fijarse al principio
            # porque cada corte de categoría añade una cabecera más, y con una
            # cuota fija ese extra se acumularía todo en la última columna.
            objetivo = (alturas[i] + alto_por_colocar(idx, pendientes)) / (n_columnas - i)
            espacio = alto_columna - alturas[i]
            necesarias = len(pendientes) + filas_vacias
            caben = densidad.filas_que_caben(espacio)

            if caben >= necesarias:
                # Cabe entera aquí. Reparto parejo: si meterla aleja a esta
                # columna de su cuota más que dejarla como está, se pasa a la
                # siguiente; sin esto, dos categorías cortas se apilarían en la
                # primera columna dejando el resto de la hoja en blanco.
                alto_bloque = densidad.alto_categoria(necesarias)
                if (
                    i < n_columnas - 1
                    and alturas[i] > 0
                    and abs(alturas[i] + alto_bloque - objetivo) > abs(alturas[i] - objetivo)
                ):
                    i += 1
                    continue
                trozo, resto = pendientes, []
            elif (
                densidad.alto_categoria(necesarias) <= alto_columna
                and i < n_columnas - 1
            ):
                # Cabe entera en una columna, solo que no en el hueco que queda
                # aquí: se pasa a la siguiente en lugar de trocearla. Partir una
                # categoría que cabe entera llena la factura de tablas repetidas
                # con "(cont.)" sin ganar nada.
                i += 1
                continue
            elif caben >= MIN_FILAS_AL_PARTIR and i < n_columnas - 1:
                # Cortar en la cuota de la columna, no en el borde: llenarla a
                # tope dejaría el sobrante amontonado en las últimas columnas.
                hasta_cuota = densidad.filas_que_caben(max(objetivo - alturas[i], 0.0))
                n_filas = min(caben, max(hasta_cuota, MIN_FILAS_AL_PARTIR))
                trozo, resto = pendientes[:n_filas], pendientes[n_filas:]
            elif i < n_columnas - 1 and alturas[i] > 0:
                i += 1  # no vale la pena partir aquí: prueba en la siguiente
                continue
            else:
                # Última columna (o columna vacía demasiado corta): se coloca
                # todo aunque desborde; el plan se marcará como no-cabe y el
                # llamador probará con una densidad más apretada.
                trozo, resto = pendientes, []

            vacias = filas_vacias if not resto else 0
            columnas[i].append(
                Seccion(
                    categoria=categoria,
                    items=trozo,
                    filas_vacias=vacias,
                    continuacion=continuacion,
                    continua=bool(resto),
                )
            )
            alturas[i] += densidad.alto_categoria(len(trozo) + vacias)
            pendientes = resto
            continuacion = True

            if resto:
                if i >= n_columnas - 1:
                    break  # ya no hay dónde continuar
                i += 1

    return columnas, alturas


def _estirar(plan: Plan, hay_especiales: bool = False) -> Plan:
    """
    Reparte el alto sobrante entre las filas, para que un pedido de cinco
    artículos no deje media hoja en blanco. Solo toca el padding: no cambia
    el número de columnas ni el tamaño de la letra, así que lo ya decidido
    sigue siendo válido.
    """
    if not plan.cabe_en_una_hoja:
        return plan

    filas_max = max(
        (sum(len(s.items) + s.filas_vacias for s in columna) for columna in plan.columnas),
        default=0,
    )
    if filas_max == 0:
        return plan

    # Con franja de "Otros Productos" se estira menos: su alto es una
    # estimación, y comerse todo el sobrante la empujaría a una segunda hoja.
    fraccion = 0.4 if hay_especiales else FRACCION_SOBRANTE_A_REPARTIR
    sobrante = (plan.alto_disponible_pt - plan.alto_maximo_pt) * fraccion
    if sobrante <= 0:
        return plan

    # El sobrante se reparte entre las filas y, dentro de cada fila, entre sus
    # dos lados (arriba y abajo). De pt a px: 1px = 0,75pt.
    extra_px = (sobrante / filas_max) / 2 / 0.75
    plan.pad_extra_px = min(extra_px, MAX_PAD_EXTRA_PX)
    plan.alto_maximo_pt += filas_max * plan.pad_extra_px * 2 * 0.75
    return plan


def planificar(categorias_normales, categorias_especiales) -> Plan:
    """
    Elige columnas, densidad y renglones en blanco para este pedido.

    Prioridades, en orden: que quepa en una hoja, que la letra sea lo más
    grande posible, y que cada categoría lleve sus renglones en blanco.

    Las categorías especiales (Desechables, Salsamentaria, Dulcería) van
    SIEMPRE juntas en una sola tabla, "Otros Productos": así lo pidió el
    cliente. Siempre que se pueda es la franja a lo ancho de siempre. Pero esa
    franja gasta dos líneas por artículo y solo tiene dos columnas: con muchos
    artículos especiales se comía la hoja entera y mandaba la factura a una
    segunda. En ese caso "Otros Productos" pasa a las columnas como una tabla
    más —una sola, nunca una por categoría—, una línea por artículo, y se
    queda ese plan si cabe en una hoja con más letra.
    """
    plan = _planificar(list(categorias_normales.items()), categorias_especiales)
    if not categorias_especiales:
        return plan
    comodo = plan.cabe_en_una_hoja and plan.densidad.fuente_pt >= FUENTE_MINIMA_COMODA
    if comodo:
        return plan

    otros = [item for items in categorias_especiales.values() for item in items]
    juntas = list(categorias_normales.items()) + [(NOMBRE_OTROS, otros)]
    fusion = _planificar(juntas, {})
    if fusion.cabe_en_una_hoja and (
        not plan.cabe_en_una_hoja or fusion.densidad.fuente_pt > plan.densidad.fuente_pt
    ):
        fusion.especiales_en_columnas = True
        return fusion
    return plan


def _planificar(bloques, categorias_especiales) -> Plan:
    """El plan para unas categorías dadas, con la franja de especiales aparte."""

    if not bloques:
        densidad = DENSIDADES[2]
        return Plan(
            columnas=[],
            densidad=densidad,
            n_columnas=COLUMNAS_CANDIDATAS[0],
            filas_vacias=0,
            alto_maximo_pt=0.0,
            alto_disponible_pt=ALTO_UTIL_PT - _alto_especiales(categorias_especiales, densidad),
            cabe_en_una_hoja=True,
        )

    respaldo = None
    mejor = None
    mejor_clave = None

    for densidad in DENSIDADES:
        disponible = ALTO_UTIL_PT - _alto_especiales(categorias_especiales, densidad)
        for vacias in range(FILAS_VACIAS_POR_CATEGORIA, -1, -1):
            for n_columnas in COLUMNAS_CANDIDATAS:
                if n_columnas == 1 and len(bloques) > 1:
                    continue

                anchos = _anchos_celdas(bloques, n_columnas, densidad)
                if anchos is None:
                    continue  # el precio o la cantidad saldrían cortados

                if n_columnas > len(bloques):
                    # Más columnas que categorías solo tiene sentido si alguna
                    # se va a partir por no caber entera en una columna.
                    mayor = max(
                        densidad.alto_categoria(len(items) + vacias)
                        for _, items in bloques
                    )
                    if mayor <= disponible:
                        continue

                columnas, alturas = _repartir(
                    bloques, n_columnas, disponible, densidad, vacias
                )

                if any(not col for col in columnas):
                    continue  # dejaría una columna en blanco: desaprovecha

                plan = Plan(
                    columnas=columnas,
                    densidad=densidad,
                    n_columnas=n_columnas,
                    filas_vacias=vacias,
                    alto_maximo_pt=max(alturas),
                    alto_disponible_pt=disponible,
                    cabe_en_una_hoja=max(alturas) <= disponible,
                    anchos=anchos,
                )
                if plan.cabe_en_una_hoja:
                    recortes = _contar_recortes(bloques, n_columnas, densidad, anchos[0])
                    incomoda = densidad.fuente_pt < FUENTE_MINIMA_COMODA
                    if recortes == 0 and not incomoda:
                        # Nada que cortar, con cuerpo legible y la letra más
                        # grande posible (se recorre de mayor a menor): no hay
                        # nada mejor que buscar.
                        return _estirar(plan, bool(categorias_especiales))
                    # Si no, se guarda y se sigue buscando: puede que con una
                    # letra algo menor quepan menos columnas, más anchas, y
                    # los nombres dejen de cortarse. Eso sí, primero manda la
                    # legibilidad: no compensa bajar a cuerpo 5 con tal de
                    # salvar unos cuantos nombres largos.
                    # Primero que no se corte nada; entre los que no cortan,
                    # la letra cómoda y luego la más grande. Solo si todos
                    # cortan algo, el que menos.
                    clave = (recortes > 0, incomoda, recortes, DENSIDADES.index(densidad))
                    if mejor_clave is None or clave < mejor_clave:
                        mejor, mejor_clave = plan, clave
                elif respaldo is None or plan.alto_maximo_pt < respaldo.alto_maximo_pt:
                    respaldo = plan

    if mejor is not None:
        # Cabe en una hoja, aunque algún nombre largo salga recortado.
        return _estirar(mejor, bool(categorias_especiales))

    # No cabe en una hoja con letra legible: mejor varias hojas bien
    # maquetadas que una ilegible o una fila de columnas que se sale de la
    # página (WeasyPrint no puede partir una fila flex entre hojas).
    return _plan_varias_hojas(bloques, respaldo)


def _llenar_hojas(bloques, n_columnas, densidad):
    """
    Reparte las categorías en hojas de `n_columnas`, llenando columna a
    columna en el orden de lectura. La primera hoja tiene menos alto (lleva el
    encabezado). Aquí sí se parten las categorías siempre que en el hueco
    entren al menos `MIN_FILAS_AL_PARTIR` filas: con varias hojas, dejar media
    columna en blanco por no partir una categoría es gastar papel.
    """
    hojas = []
    columnas, alturas, i = None, None, n_columnas  # fuerza abrir la primera hoja

    def alto_hoja():
        return ALTO_PRIMERA_HOJA_PT if len(hojas) <= 1 else ALTO_HOJA_SIGUIENTE_PT

    def siguiente_columna():
        nonlocal columnas, alturas, i
        i += 1
        if i >= n_columnas:
            columnas = [[] for _ in range(n_columnas)]
            alturas = [0.0] * n_columnas
            hojas.append(columnas)
            i = 0

    siguiente_columna()
    for categoria, items in bloques:
        pendientes = list(items)
        continuacion = False
        while pendientes:
            alto = alto_hoja()
            caben = densidad.filas_que_caben(alto - alturas[i])
            if caben < len(pendientes) and alturas[i] > 0 and caben < MIN_FILAS_AL_PARTIR:
                siguiente_columna()  # el hueco no da ni para un trozo digno
                continue
            # Columna vacía y ni así cabe una fila: se coloca igual para no
            # entrar en un bucle; nunca pasa con las densidades definidas.
            n = max(caben, 1) if alturas[i] == 0 else caben
            trozo, pendientes = pendientes[:n], pendientes[n:]
            columnas[i].append(
                Seccion(
                    categoria=categoria,
                    items=trozo,
                    filas_vacias=0,
                    continuacion=continuacion,
                    continua=bool(pendientes),
                )
            )
            alturas[i] += densidad.alto_categoria(len(trozo))
            continuacion = True
            if pendientes:
                siguiente_columna()

    # Una hoja final sin nada (la categoría anterior cerró justo en la última
    # columna) no se imprime.
    return [h for h in hojas if any(h)]


def _plan_varias_hojas(bloques, respaldo) -> Plan:
    """
    El pedido no cabe en una hoja: se reparte en varias con la densidad
    legible más apretada (`FUENTE_MINIMA_COMODA`). Entre 2 y 5 columnas se
    elige la que menos nombres recorta y, a igualdad, la que usa menos hojas.
    """
    densidad = next(
        (d for d in reversed(DENSIDADES) if d.fuente_pt >= FUENTE_MINIMA_COMODA),
        DENSIDADES[-1],
    )
    candidatas = [n for n in COLUMNAS_CANDIDATAS if not (n == 1 and len(bloques) > 1)]
    # Nunca con el precio cortado; si ni con la que menos columnas usa cabe
    # (un subtotal enorme), se queda esa con los anchos por defecto: es la de
    # celdas más anchas.
    con_anchos = [(n, _anchos_celdas(bloques, n, densidad)) for n in candidatas]
    con_anchos = [(n, a) for n, a in con_anchos if a is not None] or [
        (candidatas[0], ANCHOS_POR_DEFECTO)
    ]

    mejor, mejor_clave = None, None
    for n_columnas, anchos in con_anchos:
        hojas = _llenar_hojas(bloques, n_columnas, densidad)
        clave = (_contar_recortes(bloques, n_columnas, densidad, anchos[0]), len(hojas), -n_columnas)
        if mejor_clave is None or clave < mejor_clave:
            mejor, mejor_clave = (n_columnas, hojas, anchos), clave

    if mejor is None:
        return respaldo
    n_columnas, hojas, anchos = mejor
    return Plan(
        columnas=hojas[0],
        densidad=densidad,
        n_columnas=n_columnas,
        filas_vacias=0,
        alto_maximo_pt=0.0,
        alto_disponible_pt=ALTO_HOJA_SIGUIENTE_PT,
        cabe_en_una_hoja=False,
        hojas=hojas,
        anchos=anchos,
    )
