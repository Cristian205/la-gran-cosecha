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
from math import floor

# --------------------------------------------------------------------------
# Geometría de la hoja
# --------------------------------------------------------------------------
# Hoja carta con márgenes de 1cm. Medido sobre el PDF ya renderizado, las
# columnas de productos empiezan a 214,5pt del borde y el pie con el total
# arranca en 702pt: quedan 487,5pt. Se reserva un colchón para no pegarse al
# pie (el modelo predice bien, pero un redondeo no debe pisar el total).
ALTO_UTIL_PT = 470.0

# Ancho útil de la fila de columnas (~19.4cm), para repartirlo entre columnas.
ANCHO_UTIL_PT = 550.0

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

# Proporción de la columna que ocupa la celda del artículo y padding de la
# celda, según la hoja de estilos. Con Helvetica, un carácter mide de media
# ~0,52 em en negrita (el nombre) y ~0,50 en redonda (la presentación). Sirve
# para saber si un nombre va a caber o va a salir recortado.
ANCHO_CELDA_ARTICULO = 0.50
PAD_CELDA_PT = 9.0
EM_NEGRITA = 0.52
EM_REDONDA = 0.50

# Solo se cuentan como recorte los nombres que se pasan de largo más de un
# 15%: perder un par de letras del final no estorba, y ser estricto obligaba a
# bajar la letra hasta tamaños incómodos con tal de no cortar nada.
TOLERANCIA_RECORTE = 1.15

# Por debajo de este cuerpo la factura deja de leerse con comodidad. Se elige
# siempre entre las densidades que lo respetan; solo se baja de aquí cuando el
# pedido es tan grande que de otro modo no cabría en la hoja.
FUENTE_MINIMA_COMODA = 6.1

# Las categorías especiales se maquetan aparte, a lo ancho, en 2 columnas al
# 50% (los renglones de "Otros Productos" llevan dos líneas y a tres columnas
# quedaban demasiado estrechos).
COLUMNAS_ESPECIALES = 2


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
        return f"--fs-item: {self.densidad.fuente_pt:.2f}pt; --pad-v: {self.pad_v_px:.2f}px;"

    @property
    def ancho_columna_pt(self) -> float:
        return ANCHO_UTIL_PT / self.n_columnas

    @property
    def aprovechamiento(self) -> float:
        if self.alto_disponible_pt <= 0:
            return 0.0
        return self.alto_maximo_pt / self.alto_disponible_pt


def _contar_recortes(bloques, n_columnas: int, densidad: Densidad) -> int:
    """
    Cuántos artículos no caben a lo ancho de su columna y saldrían cortados.

    Es lo que decide entre "más columnas con letra grande" y "menos columnas
    con letra algo menor": repartir 100 productos en cinco columnas deja cada
    una tan estrecha que solo entran diez caracteres del nombre.
    """
    disponible = (ANCHO_UTIL_PT / n_columnas) * ANCHO_CELDA_ARTICULO - PAD_CELDA_PT
    if disponible <= 0:
        return sum(len(items) for _, items in bloques)

    recortes = 0
    for _, items in bloques:
        for it in items:
            nombre = str(it.get("articulo") or "")
            pres = str(it.get("pres") or "")
            ancho = (
                len(nombre) * EM_NEGRITA + (len(pres) + 1) * EM_REDONDA
            ) * densidad.fuente_pt
            if ancho > disponible * TOLERANCIA_RECORTE:
                recortes += 1
    return recortes


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
    """
    bloques = list(categorias_normales.items())

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
                )
                if plan.cabe_en_una_hoja:
                    recortes = _contar_recortes(bloques, n_columnas, densidad)
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
                    clave = (incomoda, recortes, DENSIDADES.index(densidad))
                    if mejor_clave is None or clave < mejor_clave:
                        mejor, mejor_clave = plan, clave
                elif respaldo is None or plan.alto_maximo_pt < respaldo.alto_maximo_pt:
                    respaldo = plan

    if mejor is not None:
        # Cabe en una hoja, aunque algún nombre largo salga recortado.
        return _estirar(mejor, bool(categorias_especiales))

    # Ni con la letra más pequeña cabe: se devuelve el reparto más ajustado y
    # la factura se irá a una segunda hoja, que es lo correcto antes que
    # dejarse artículos fuera.
    return respaldo
