"""
Esquemas de carga: dónde va cada PILA de canastillas dentro del furgón.

Una pila es un lugar en el piso (centro x, y en cm) con su orientación y su
zona; encima se apilan hasta `niveles` canastillas. Una posición del plano es
(pila, nivel). El generador calcula las pilas con las medidas REALES del
furgón y de la canastilla y garantiza que no se cruzan ni se salen del furgón:
si algo no cabe lo dice en `errores` (con la restricción y una sugerencia) y
NO lo ubica. Nunca se inventa espacio.

Sistema de coordenadas (cm, interior del furgón):
    x: a lo largo, desde la pared frontal (cabina) hacia la puerta.
    y: a lo ancho, desde la pared IZQUIERDA (lado del conductor).
    rot: 0 = el LARGO de la canastilla va a lo largo del furgón (longitudinal);
         90 = atravesado (transversal).

Esquemas:
    "rejilla"          todo el piso en rejilla uniforme, una sola orientación.
                       Se descarga desde la puerta.
    "frente_columnas"  la metodología de La Gran Cosecha:
                       A. una fila contra la pared delantera que ocupa el
                          ancho (cuántas caben se calcula; se puede fijar a
                          mano si cabe);
                       B. dos laterales independientes, pegados a cada pared,
                          de esa fila hacia la puerta, con la orientación
                          CONTRARIA a la de la fila delantera. Por defecto los
                          laterales llevan la canastilla ATRAVESADA (su largo a
                          lo ancho del furgón), que es como carga La Gran
                          Cosecha; la fila delantera, entonces, longitudinal;
                       y un PASILLO central libre que empieza DESPUÉS de la fila
                       transversal, con un ancho mínimo configurable. Lo lateral
                       se descarga desde el pasillo.
"""

TIPOS = ("rejilla", "frente_columnas")
ORIENT_LATERALES = ("longitudinal", "transversal")

POR_DEFECTO_FRENTE_COLUMNAS = {
    "tipo": "frente_columnas",
    "frente": None,          # None = las que quepan a lo ancho
    "izquierda": None,       # None = las que quepan a lo largo
    "derecha": None,
    "niveles": 5,
    "pasillo_min_cm": 40,
    "orientacion_laterales": "transversal",
}


def _niveles(furgon, tipo, tope=None) -> int:
    n = furgon.alto_cm // tipo.alto_cm
    if tipo.max_apiladas:
        n = min(n, tipo.max_apiladas)
    if tope:
        n = min(n, tope)
    return max(0, n)


def _base(furgon, tipo) -> dict:
    return {
        "furgon": {"largo": furgon.largo_cm, "ancho": furgon.ancho_cm, "alto": furgon.alto_cm},
        "canastilla": {"largo": tipo.largo_cm, "ancho": tipo.ancho_cm, "alto": tipo.alto_cm},
    }


def _huella(pila, c) -> tuple:
    """(largo a lo largo del furgón, ancho a lo ancho) que ocupa una pila."""
    return (c["largo"], c["ancho"]) if pila["rot"] == 0 else (c["ancho"], c["largo"])


def comprobar_pilas(pilas, furgon_m, c) -> list:
    """Errores geométricos: pilas fuera del furgón o encimadas (tolerancia 0,5 cm)."""
    errores = []
    L, W = furgon_m["largo"], furgon_m["ancho"]
    cajas = []
    for i, p in enumerate(pilas):
        dx, dy = _huella(p, c)
        x0, x1, y0, y1 = p["x"] - dx / 2, p["x"] + dx / 2, p["y"] - dy / 2, p["y"] + dy / 2
        if x0 < -0.5 or y0 < -0.5 or x1 > L + 0.5 or y1 > W + 0.5:
            errores.append(f"La posición {i + 1} se sale del furgón.")
        cajas.append((x0, x1, y0, y1))
    for i in range(len(cajas)):
        for j in range(i + 1, len(cajas)):
            a, b = cajas[i], cajas[j]
            if min(a[1], b[1]) - max(a[0], b[0]) > 0.5 and min(a[3], b[3]) - max(a[2], b[2]) > 0.5:
                errores.append(f"Las posiciones {i + 1} y {j + 1} se superponen.")
    return errores


def esquema_rejilla(furgon, tipo) -> dict:
    """Rejilla uniforme: prueba las dos orientaciones y usa la que mete más."""
    L, W, cl, ca = furgon.largo_cm, furgon.ancho_cm, tipo.largo_cm, tipo.ancho_cm
    normal = (L // cl, W // ca)
    girada = (L // ca, W // cl)
    usar_girada = girada[0] * girada[1] > normal[0] * normal[1]
    filas, columnas = girada if usar_girada else normal
    paso_x, paso_y = (ca, cl) if usar_girada else (cl, ca)
    niveles = _niveles(furgon, tipo)
    pilas = [
        {
            "x": round((f + 0.5) * paso_x, 1),
            "y": round((c + 0.5) * paso_y, 1),
            "rot": 90 if usar_girada else 0,
            "zona": "rejilla",
            "acceso": "puerta",
            "etiqueta": f"F{f + 1}-C{c + 1}",
        }
        for f in range(filas)
        for c in range(columnas)
    ]
    errores = [] if pilas else ["La canastilla no cabe en este furgón: revisa las medidas."]
    return {
        **_base(furgon, tipo),
        "esquema": "rejilla",
        "girada": usar_girada,
        "filas": filas,
        "columnas": columnas,
        "niveles": niveles,
        "pilas": pilas,
        "capacidad": len(pilas) * niveles,
        "avisos": [],
        "errores": errores,
    }


def esquema_frente_columnas(furgon, tipo, cfg: dict) -> dict:
    """Fila delantera contra la cabina + dos laterales (atravesados por defecto) con pasillo."""
    L, W = furgon.largo_cm, furgon.ancho_cm
    cl, ca = tipo.largo_cm, tipo.ancho_cm
    avisos, errores = [], []
    cfg = {**POR_DEFECTO_FRENTE_COLUMNAS, **(cfg or {})}

    # Laterales: longitudinal = el largo de la canastilla a lo largo del furgón.
    if cfg["orientacion_laterales"] == "longitudinal":
        lat_rot, lat_atraviesa, lat_paso = 0, ca, cl
    else:
        lat_rot, lat_atraviesa, lat_paso = 90, cl, ca
    # A. Fila delantera: perpendicular a los laterales.
    fr_rot = 90 if lat_rot == 0 else 0
    fr_atraviesa, fr_fondo = (cl, ca) if fr_rot == 90 else (ca, cl)

    caben_frente = int(W // fr_atraviesa)
    pedidas = cfg["frente"]
    if pedidas is None:
        n_frente = caben_frente
    elif pedidas > caben_frente:
        errores.append(
            f"En la fila delantera caben {caben_frente} canastillas, no {pedidas}: "
            f"{pedidas} × {fr_atraviesa} cm superan los {W} cm de ancho. Sugerencia: bájala a {caben_frente}."
        )
        n_frente = caben_frente
    else:
        n_frente = pedidas
    if n_frente == 0:
        fr_fondo = 0
    if fr_fondo > L:
        errores.append("La fila delantera es más honda que el furgón.")

    # B. Pasillo: lo que queda entre los dos laterales.
    pasillo = W - 2 * lat_atraviesa
    minimo = cfg["pasillo_min_cm"]
    if pasillo < minimo:
        errores.append(
            f"El pasillo central quedaría de {max(pasillo, 0)} cm y el mínimo es {minimo} cm "
            f"(dos laterales de {lat_atraviesa} cm en {W} cm de ancho). Sugerencias: baja el mínimo del pasillo, "
            "gira los laterales o usa un solo lateral."
        )

    pilas = []
    paso_frente = W / n_frente if n_frente else 0
    for i in range(n_frente):
        pilas.append({
            "x": round(fr_fondo / 2, 1),
            "y": round(paso_frente * (i + 0.5), 1),
            "rot": fr_rot,
            "zona": "frente",
            "acceso": "pasillo",
            "etiqueta": f"T{i + 1}",
        })
    caben_lat = int((L - fr_fondo) // lat_paso) if L > fr_fondo else 0
    for lado, y, letra in (("izquierda", lat_atraviesa / 2, "I"), ("derecha", W - lat_atraviesa / 2, "D")):
        pedidas = cfg[lado]
        if pedidas is None:
            n = caben_lat
        elif pedidas > caben_lat:
            errores.append(
                f"En el lateral {lado} caben {caben_lat} canastillas a lo largo, no {pedidas}. "
                f"Sugerencia: bájalo a {caben_lat}."
            )
            n = caben_lat
        else:
            n = pedidas
        if pasillo < 0:
            n = 0  # los laterales se cruzarían: no se inventa espacio
        for i in range(n):
            pilas.append({
                "x": round(fr_fondo + (i + 0.5) * lat_paso, 1),
                "y": round(y, 1),
                "rot": lat_rot,
                "zona": lado,
                "acceso": "pasillo",
                "etiqueta": f"{letra}{i + 1}",
            })

    niveles = _niveles(furgon, tipo, cfg["niveles"] or None)
    if cfg["niveles"] and niveles < cfg["niveles"]:
        avisos.append(
            f"Se pidieron {cfg['niveles']} niveles, pero caben {niveles} "
            f"(alto del furgón {furgon.alto_cm} cm, canastilla {tipo.alto_cm} cm"
            f"{', máximo apilable ' + str(tipo.max_apiladas) if tipo.max_apiladas else ''})."
        )
    if not pilas:
        errores.append("No cabe ninguna posición con esta configuración.")
    errores += comprobar_pilas(pilas, {"largo": L, "ancho": W}, {"largo": cl, "ancho": ca})

    fondo_lat = max([p["x"] + lat_paso / 2 for p in pilas if p["zona"] != "frente"], default=fr_fondo)
    return {
        **_base(furgon, tipo),
        "esquema": "frente_columnas",
        "config": {**cfg, "frente": n_frente},
        "niveles": niveles,
        "pilas": pilas,
        "capacidad": len(pilas) * niveles,
        "frente_fondo_cm": fr_fondo,
        "pasillo_cm": max(0, pasillo),
        "largo_usado_cm": round(fondo_lat, 1),
        "avisos": avisos,
        "errores": errores,
    }


def calcular_esquema(furgon, tipo) -> dict:
    """El esquema del vehículo con esta canastilla (rejilla si no tiene uno)."""
    cfg = furgon.esquema_carga or {}
    if cfg.get("tipo") == "frente_columnas":
        return esquema_frente_columnas(furgon, tipo, cfg)
    return esquema_rejilla(furgon, tipo)


def _entero_o_auto(valor, campo, tope):
    if valor is None or valor == "":
        return None
    if not isinstance(valor, int) or isinstance(valor, bool) or not 0 <= valor <= tope:
        raise ValueError(f"«{campo}» debe ser un entero entre 0 y {tope}, o vacío para calcularlo.")
    return valor


def validar_config(cfg) -> dict:
    """Limpia lo que llega del formulario del vehículo; lanza ValueError si no sirve."""
    if not cfg:
        return {}
    if not isinstance(cfg, dict) or cfg.get("tipo") not in TIPOS:
        raise ValueError("Esquema de carga desconocido.")
    if cfg["tipo"] == "rejilla":
        return {"tipo": "rejilla"}
    limpio = {"tipo": "frente_columnas"}
    limpio["frente"] = _entero_o_auto(cfg.get("frente"), "frente", 12)
    limpio["izquierda"] = _entero_o_auto(cfg.get("izquierda"), "izquierda", 40)
    limpio["derecha"] = _entero_o_auto(cfg.get("derecha"), "derecha", 40)
    niveles = cfg.get("niveles", 5)
    if not isinstance(niveles, int) or isinstance(niveles, bool) or not 1 <= niveles <= 20:
        raise ValueError("«niveles» debe ser un entero entre 1 y 20.")
    limpio["niveles"] = niveles
    pasillo = cfg.get("pasillo_min_cm", 40)
    if not isinstance(pasillo, int) or isinstance(pasillo, bool) or not 0 <= pasillo <= 200:
        raise ValueError("«pasillo_min_cm» debe ser un entero entre 0 y 200.")
    limpio["pasillo_min_cm"] = pasillo
    orient = cfg.get("orientacion_laterales", "transversal")
    if orient not in ORIENT_LATERALES:
        raise ValueError("Orientación de los laterales inválida.")
    limpio["orientacion_laterales"] = orient
    return limpio
