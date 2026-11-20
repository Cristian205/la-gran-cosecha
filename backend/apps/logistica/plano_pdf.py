"""
Guía de carga y entrega de un vehículo, en UNA hoja carta horizontal, para el
conductor y el auxiliar.

* Arriba: vehículo, placa, fecha, ruta y los totales en números grandes.
* El plano superior del furgón (el mismo del panel, más pequeño): fila
  delantera, laterales con sus filas numeradas desde la cabina, pasillo,
  cabina y puertas, con el número de parada en cada posición.
* Alrededor del plano, en L, una ficha por parada: la parada 1 arriba a la
  izquierda, bajando por la columna izquierda, y luego de izquierda a derecha
  por debajo del plano. Cada ficha reúne cliente, dirección, canastillas,
  dónde va (filas), pedidos y los productos consolidados en línea.

El tamaño del plano, de la letra y cuántas fichas van en la columna se eligen
renderizando con WeasyPrint hasta que todo quepa en una sola página.

Las entregas salen de `datos_operativos`: en un despacho confirmado es la
copia congelada al confirmar; en un borrador se calculan en el momento.
Nada depende solo del color: cada parada tiene número, nombre y una trama
distinta que se distingue en escala de grises.
"""
import datetime
import math
from html import escape

# Tramas en escala de grises (se reparten por destino en orden).
TRAMAS = [
    '<path d="M0,6 L6,0" stroke="#000" stroke-width="1"/>',
    '<path d="M0,0 L6,6" stroke="#000" stroke-width="1"/>',
    '<path d="M0,3 L6,3" stroke="#000" stroke-width="1"/>',
    '<path d="M3,0 L3,6" stroke="#000" stroke-width="1"/>',
    '<circle cx="3" cy="3" r="1.1" fill="#000"/>',
    '<path d="M0,6 L6,0 M0,0 L6,6" stroke="#000" stroke-width=".8"/>',
    '<path d="M0,3 L6,3 M3,0 L3,6" stroke="#000" stroke-width=".8"/>',
    '<rect width="6" height="6" fill="#bbb"/>',
    '<rect width="6" height="6" fill="#e5e5e5"/>',
    '<path d="M0,1.5 L6,1.5 M0,4.5 L6,4.5" stroke="#000" stroke-width=".7"/>',
]

ZONAS = {"frente": "Fila delantera", "izquierda": "Lateral izquierdo", "derecha": "Lateral derecho", "rejilla": "Piso"}
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


def numero_de(grupo: dict) -> int:
    return grupo.get("numero") or grupo["orden"]


def fecha_larga(fecha) -> str:
    if isinstance(fecha, str):
        fecha = datetime.date.fromisoformat(fecha)
    return f"{DIAS[fecha.weekday()].capitalize()} {fecha.day} de {MESES[fecha.month - 1]} de {fecha.year}"


def _patron(pid: str, i: int) -> str:
    return (
        f'<pattern id="{pid}" width="6" height="6" patternUnits="userSpaceOnUse">'
        f'<rect width="6" height="6" fill="#fff"/>{TRAMAS[i % len(TRAMAS)]}</pattern>'
    )


def svg_planta(medidas: dict, grupos: list, posiciones: list, bloqueos=(), ancho_px: float = 980) -> str:
    """El plano superior como SVG (unidades en px; escala calculada)."""
    L, W = medidas["furgon"]["largo"], medidas["furgon"]["ancho"]
    c = medidas["canastilla"]
    cab = 110                                  # cm dibujados para la cabina
    margen = 26
    s = (ancho_px - 2 * margen - 110) / (L + cab)   # 110 px fijos para el rótulo de las puertas
    alto_px = W * s + 2 * margen + 34
    ox, oy = margen + cab * s, margen + 18

    def X(x):
        return ox + x * s

    def Y(y):
        # y se mide desde la pared IZQUIERDA, que va ABAJO en el dibujo.
        return oy + (W - y) * s

    indice = {g["id"]: i for i, g in enumerate(sorted(grupos, key=lambda g: g["orden"]))}
    por_grupo = {g["id"]: g for g in grupos}
    pilas = medidas["pilas"]
    pila_contenido = {i: [] for i in range(len(pilas))}
    for p in sorted(posiciones, key=lambda p: p["nivel"]):
        pila_contenido[p["pila"]].append(p["grupo"])

    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{ancho_px:.0f}" height="{alto_px:.0f}" '
        f'viewBox="0 0 {ancho_px:.0f} {alto_px:.0f}" font-family="Helvetica, Arial, sans-serif">',
        "<defs>",
    ]
    for gid, i in indice.items():
        partes.append(_patron(f"t{i}", i))
    partes.append(
        '<pattern id="pasillo" width="10" height="10" patternUnits="userSpaceOnUse">'
        '<path d="M0,10 L10,0" stroke="#999" stroke-width=".6"/></pattern></defs>'
    )

    # Cabina y piso del furgón
    partes.append(
        f'<rect x="{margen}" y="{oy + W * s * 0.12:.1f}" width="{cab * s - 6:.1f}" height="{W * s * 0.76:.1f}" '
        f'rx="12" fill="#e6e6e6" stroke="#000" stroke-width="1.6"/>'
        f'<text x="{margen + (cab * s - 6) / 2:.1f}" y="{oy + W * s / 2 + 5:.1f}" font-size="15" '
        f'text-anchor="middle" font-weight="bold">CABINA</text>'
    )
    partes.append(
        f'<rect x="{X(0):.1f}" y="{Y(W):.1f}" width="{L * s:.1f}" height="{W * s:.1f}" '
        f'fill="#fff" stroke="#000" stroke-width="2.6"/>'
    )
    # Pasillo (desde el fondo de la fila delantera hasta la puerta)
    if medidas.get("esquema") == "frente_columnas" and medidas.get("pasillo_cm", 0) > 0:
        lat = [p for p in pilas if p["zona"] in ("izquierda", "derecha")]
        if lat:
            atraviesa = c["ancho"] if lat[0]["rot"] == 0 else c["largo"]
            x0 = medidas.get("frente_fondo_cm", 0)
            partes.append(
                f'<rect x="{X(x0):.1f}" y="{Y(W - atraviesa):.1f}" width="{(L - x0) * s:.1f}" '
                f'height="{(W - 2 * atraviesa) * s:.1f}" fill="url(#pasillo)" stroke="#666" '
                f'stroke-width="1" stroke-dasharray="5 3"/>'
                f'<text x="{X((x0 + L) / 2):.1f}" y="{Y(W / 2) + 6:.1f}" font-size="17" text-anchor="middle" '
                f'font-weight="bold" fill="#444" letter-spacing="8">PASILLO</text>'
            )

    # Pilas: número de parada grande y cuántas canastillas lleva.
    for i, pila in enumerate(pilas):
        dx, dy = (c["largo"], c["ancho"]) if pila["rot"] == 0 else (c["ancho"], c["largo"])
        x0, y_sup = X(pila["x"] - dx / 2), Y(pila["y"] + dy / 2)
        w, h = dx * s, dy * s
        cont = pila_contenido[i]
        relleno = f"url(#t{indice[cont[-1]]})" if cont and cont[-1] in indice else "#fff"
        borde = 'stroke-width="2.8"' if i in bloqueos else 'stroke-width="1"'
        partes.append(
            f'<rect x="{x0 + 1:.1f}" y="{y_sup + 1:.1f}" width="{w - 2:.1f}" height="{h - 2:.1f}" '
            f'fill="{relleno}" stroke="#000" {borde}/>'
        )
        if pila["zona"] in ("izquierda", "derecha", "rejilla"):
            # Número de fila (desde la cabina) por fuera de la caja, junto a su posición.
            fuera = y_sup - 3 if pila["zona"] == "derecha" else y_sup + h + 9
            if pila["zona"] != "rejilla":
                partes.append(
                    f'<text x="{x0 + w / 2:.1f}" y="{fuera:.1f}" font-size="8" text-anchor="middle">{numero_fila(pila)}</text>'
                )
        if not cont:
            continue
        cx, cy = x0 + w / 2, y_sup + h / 2
        numeros = []
        for g in cont:
            if g in por_grupo and numero_de(por_grupo[g]) not in numeros:
                numeros.append(numero_de(por_grupo[g]))
        texto = "/".join(str(n) for n in numeros)
        ancho_caja = max(30, 11 * len(texto) + 10)
        partes.append(
            f'<rect x="{cx - ancho_caja / 2:.1f}" y="{cy - 16:.1f}" width="{ancho_caja:.1f}" height="32" rx="4" '
            f'fill="#fff" stroke="#000" stroke-width="1"/>'
            f'<text x="{cx:.1f}" y="{cy + 1:.1f}" font-size="15" font-weight="bold" text-anchor="middle">{texto}</text>'
            f'<text x="{cx:.1f}" y="{cy + 13:.1f}" font-size="9.5" text-anchor="middle">×{len(cont)}</text>'
        )

    # Rótulos de orientación
    partes.append(
        f'<text x="{X(L) + 8:.1f}" y="{Y(W / 2) - 4:.1f}" font-size="15" font-weight="bold">PUERTAS</text>'
        f'<text x="{X(L) + 8:.1f}" y="{Y(W / 2) + 14:.1f}" font-size="10">(se descarga aquí)</text>'
        f'<text x="{X(0) - 4:.1f}" y="{Y(W) - 3:.1f}" font-size="10" font-weight="bold" text-anchor="end">DERECHO · fila</text>'
        f'<text x="{X(0) - 4:.1f}" y="{Y(0) + 9:.1f}" font-size="10" font-weight="bold" text-anchor="end">IZQUIERDO · fila</text>'
        f'<text x="{X(L):.1f}" y="{Y(0) + 22:.1f}" font-size="8" text-anchor="end">'
        f'Interior {L} × {W} × {medidas["furgon"]["alto"]} cm</text>'
    )
    partes.append("</svg>")
    return "".join(partes)


def _muestra(i: int) -> str:
    return (
        f'<svg width="30" height="18"><defs>{_patron(f"l{i}", i)}</defs>'
        f'<rect x="1" y="1" width="28" height="16" fill="url(#l{i})" stroke="#000"/></svg>'
    )


def numero_fila(pila: dict) -> int:
    """Fila contada desde la cabina (mismo criterio que el editor: `filaDePila`)."""
    digitos = "".join(ch for ch in pila["etiqueta"].split("-")[0] if ch.isdigit())
    return int(digitos or 1)


def _rangos(nums) -> str:
    """[1, 2, 3, 5] → "1–3, 5"."""
    o = sorted(set(nums))
    partes, i = [], 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and o[j + 1] == o[j] + 1:
            j += 1
        partes.append(str(o[i]) if i == j else f"{o[i]}–{o[j]}")
        i = j + 1
    return ", ".join(partes)


def _donde_va(grupo_id: str, posiciones: list, pilas: list) -> str:
    """«Lateral derecho, filas 9–11 (4) · Fila delantera (2)»: filas contadas desde la cabina."""
    filas, cuenta = {}, {}
    for p in posiciones:
        if p["grupo"] != grupo_id:
            continue
        pila = pilas[p["pila"]]
        filas.setdefault(pila["zona"], set()).add(numero_fila(pila))
        cuenta[pila["zona"]] = cuenta.get(pila["zona"], 0) + 1
    partes = []
    if "frente" in cuenta:
        partes.append(f"Fila delantera ({cuenta['frente']})")
    for zona, nombre in (("izquierda", "Lateral izquierdo"), ("derecha", "Lateral derecho")):
        if zona in cuenta:
            plural = "filas" if len(filas[zona]) > 1 else "fila"
            partes.append(f"{nombre}, {plural} {_rangos(filas[zona])} ({cuenta[zona]})")
    if "rejilla" in cuenta:
        plural = "Filas" if len(filas["rejilla"]) > 1 else "Fila"
        partes.append(f"{plural} {_rangos(filas['rejilla'])} ({cuenta['rejilla']})")
    return " · ".join(partes) or "Sin ubicar"


def _ficha(par: dict, grupo: dict | None, i_trama: int | None, posiciones, pilas) -> str:
    """Una parada compacta: cabecera, dónde va, productos en línea y firma."""
    pedidos = par.get("pedidos") or []
    varios = len(pedidos) > 1
    productos = par.get("productos") or []
    if productos:
        items = []
        for pr in productos:
            detalle = ""
            if varios and len(pr.get("pedidos") or []) > 0:
                partes = " + ".join("#%s: %s" % (x["id"], escape(x["cantidad"])) for x in pr["pedidos"])
                detalle = f"<small> ({partes})</small>"
            nota = f'<small> «{escape("; ".join(pr["notas"]))}»</small>' if pr.get("notas") else ""
            items.append(f'<span class="pr"><b>{escape(pr["cantidad"])}</b> {escape(pr["unidad"])} {escape(pr["producto"])}{detalle}{nota}</span>')
        lleva = " · ".join(items)
    else:
        lleva = "<i>Sin pedidos asociados</i>"
    obs = " · ".join(
        f"#{p['id']}: {escape(t)}" for p in pedidos for t in (p.get("observaciones"), p.get("indicaciones")) if t
    )
    contacto = " · ".join(
        escape(x) for x in (par.get("direccion"), f"Tel. {par['telefono']}" if par.get("telefono") else "",
                            f"Recibe: {par['recibe']}" if par.get("recibe") else "") if x
    )
    donde = _donde_va(par["grupo"], posiciones, pilas) if grupo else "Sin ubicar"
    muestra = _muestra(i_trama) if i_trama is not None else ""
    return f"""<div class="t">
<div class="t-cab"><div class="t-num">{par["numero"]}</div>
<div class="t-cli"><b>{escape(par["nombre"])}</b>{"<br><small>" + contacto + "</small>" if contacto else ""}</div>
<div class="t-can"><b>{par["canastillas"]}</b><small>canast.</small></div></div>
<div class="t-donde">{muestra}<span>{escape(donde)}</span><span class="t-ped">{", ".join(f"#{p['id']}" for p in pedidos) or "—"}</span></div>
<div class="t-prod">{lleva}</div>
{f'<div class="t-obs">{obs}</div>' if obs else ""}
<div class="t-pie">☐ Entregado &nbsp;·&nbsp; Recibió: __________ &nbsp;·&nbsp; Hora: _____</div>
</div>"""


def _cabe_en_una_hoja(html: str) -> bool:
    try:
        from weasyprint import HTML  # noqa: PLC0415 — pesado: solo al usarlo
    except Exception:  # sin WeasyPrint (p. ej. un equipo sin GTK) se confía en la estimación
        return True
    return len(HTML(string=html).render().pages) == 1


# Hoja carta horizontal a 96 dpi, sin márgenes: ancho y alto útiles en px.
ANCHO_UTIL, ALTO_UTIL = 975, 705
ALTO_CABECERA = 64
ANCHO_IZQ = 300           # columna izquierda de la L
SEPARACION = 6


def _alto_plano(medidas: dict, ancho: int) -> float:
    L, W = medidas["furgon"]["largo"], medidas["furgon"]["ancho"]
    return W * (ancho - 162) / (L + 110) + 86 + 8


def _opciones(medidas: dict, fichas_texto: list, holgura: float) -> list:
    """
    Combinaciones (letra pt, ancho del plano, fichas en la columna izquierda,
    columnas debajo del plano) que, por estimación, caben en la hoja; de la
    más legible (letra grande, plano grande) a la más compacta.
    """
    n = len(fichas_texto)
    salida = []
    for fs in (11, 10, 9, 8.4, 7.8, 7.2, 6.6, 6.0, 5.5):
        linea = fs * 1.333 * 1.22

        def alto(texto, ancho_px):
            por_linea = max(10, ancho_px / (fs * 1.333 * 0.5))
            return (4 + max(1, -(-len(texto) // int(por_linea)))) * linea + 14

        ancho_der = ANCHO_UTIL - ANCHO_IZQ - SEPARACION
        for ancho in (660, 620, 580, 540, 500, 460, 420):
            ancho = min(ancho, ancho_der)
            alto_abajo = ALTO_UTIL - ALTO_CABECERA - _alto_plano(medidas, ancho) - 16
            for cols in (3, 2):
                ancho_ficha = (ancho_der - (cols - 1) * SEPARACION) / cols
                for k in range(min(n, max(1, -(-n // 2))), n + 1) if n else [0]:
                    izq = sum(alto(t, ANCHO_IZQ) for t in fichas_texto[:k]) * holgura
                    resto = fichas_texto[k:]
                    filas = [resto[i:i + cols] for i in range(0, len(resto), cols)]
                    abajo = sum(max(alto(t, ancho_ficha) for t in f) for f in filas) * holgura
                    if izq <= ALTO_UTIL - ALTO_CABECERA and abajo <= alto_abajo:
                        salida.append((fs, ancho, k, cols))
                        break
    return salida


def html_plano(plano, negocio: str = "", datos: dict | None = None) -> str:
    """El documento completo (una hoja) listo para WeasyPrint."""
    medidas, grupos, posiciones = plano.medidas, plano.grupos, plano.posiciones
    pilas = medidas["pilas"]
    orden = sorted(grupos, key=lambda g: g["orden"])
    indice = {g["id"]: i for i, g in enumerate(orden)}
    por_id = {g["id"]: g for g in grupos}
    datos = datos or {}
    paradas = datos.get("paradas")
    if paradas is None:
        paradas = [
            {"grupo": g["id"], "orden": g["orden"], "numero": numero_de(g), "nombre": g["nombre"],
             "direccion": g.get("direccion", ""), "telefono": "", "recibe": "", "canastillas": g["cantidad"],
             "pedidos": [], "productos": []}
            for g in orden
        ]
    # Los destinos del plano mandan (número, canastillas, orden): son los del 3D y el 2D.
    vistos = {par["grupo"] for par in paradas}
    paradas = [par for par in paradas if par["grupo"] in por_id] + [
        {"grupo": g["id"], "orden": g["orden"], "numero": numero_de(g), "nombre": g["nombre"],
         "direccion": g.get("direccion", ""), "telefono": "", "recibe": "", "canastillas": g["cantidad"],
         "pedidos": [], "productos": []}
        for g in orden if g["id"] not in vistos
    ]
    for par in paradas:
        g = por_id[par["grupo"]]
        par["numero"] = numero_de(g)
        par["canastillas"] = g["cantidad"]
    paradas.sort(key=lambda p: por_id[p["grupo"]]["orden"])

    furgon = plano.furgon
    fur = datos.get("furgon") or {"nombre": furgon.nombre, "placa": furgon.placa, "referencia": furgon.referencia}
    total_pedidos = len({p["id"] for par in paradas for p in par.get("pedidos") or []})
    pesos = [par.get("peso_kg") for par in paradas]
    peso = sum(pesos) if pesos and all(x is not None for x in pesos) else None
    ruta = datos.get("ruta") or ""
    estado = plano.get_estado_display()
    congelado = plano.estado == "CONFIRMADO" and datos.get("tomado_en")
    fichas = [_ficha(par, por_id.get(par["grupo"]), indice.get(par["grupo"]), posiciones, pilas) for par in paradas]
    textos = [
        " ".join(f'{pr["cantidad"]} {pr["unidad"]} {pr["producto"]}' for pr in par.get("productos") or [])
        + " " + " ".join((p.get("observaciones") or "") + (p.get("indicaciones") or "") for p in par.get("pedidos") or [])
        for par in paradas
    ]

    def documento(fs: float, ancho_plano: int, k: int, cols: int) -> str:
        ancho_ficha = f"calc((100% - {(cols - 1) * SEPARACION}px) / {cols})"
        abajo = "".join(f'<div class="celda" style="width: {ancho_ficha}">{f}</div>' for f in fichas[k:])
        return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page {{ size: letter landscape; margin: 7mm 7mm 7mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #000; font-size: {fs}pt; margin: 0; }}
.cab {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; border-bottom: 3px solid #000; padding-bottom: 4px; margin-bottom: 5px; }}
.cab .tipo {{ font-size: 7.5pt; letter-spacing: .12em; font-weight: bold; }}
h1 {{ font-size: 18pt; margin: 0; line-height: 1.05; }} h1 .placa {{ border: 2px solid #000; border-radius: 4px; padding: 0 5px; font-size: 13pt; margin-left: 6px; }}
.sub {{ font-size: 9pt; margin-top: 1px; }}
.cifras {{ display: flex; gap: 5px; }}
.cifra {{ min-width: 58px; border: 2px solid #000; border-radius: 5px; padding: 1px 8px; text-align: center; white-space: nowrap; }}
.cifra b {{ display: block; font-size: 15pt; line-height: 1.1; }} .cifra span {{ font-size: 6.5pt; letter-spacing: .08em; text-transform: uppercase; }}
.negocio {{ text-align: right; font-size: 7.5pt; line-height: 1.3; }}
.cuerpo {{ display: flex; gap: {SEPARACION}px; align-items: flex-start; }}
.izq {{ width: {ANCHO_IZQ}px; flex: none; }}
.der {{ flex: 1; min-width: 0; }}
.plano {{ border: 1px solid #000; padding: 1px; text-align: center; }}
.nota {{ font-size: 6.8pt; margin: 2px 0 4px; }}
.abajo {{ display: flex; flex-wrap: wrap; gap: 0 {SEPARACION}px; align-items: flex-start; }}
.t {{ border: 1.5px solid #000; border-radius: 4px; margin-bottom: 4px; page-break-inside: avoid; }}
.t-cab {{ display: flex; align-items: stretch; border-bottom: 1px solid #000; }}
.t-num {{ width: 2.3em; flex: none; display: flex; align-items: center; justify-content: center; font-size: 1.7em; font-weight: bold; background: #e6e6e6; border-right: 1.5px solid #000; }}
.t-cli {{ flex: 1; min-width: 0; padding: 1px 4px; line-height: 1.2; }} .t-cli b {{ font-size: 1.15em; }} .t-cli small {{ font-size: .82em; }}
.t-can {{ width: 3.6em; flex: none; text-align: center; border-left: 1px solid #000; padding: 1px 2px; line-height: 1; }}
.t-can b {{ display: block; font-size: 1.45em; }} .t-can small {{ font-size: .7em; }}
.t-donde {{ display: flex; align-items: center; gap: 4px; padding: 1px 4px; font-size: .86em; border-bottom: 1px dotted #000; }}
.t-donde svg {{ flex: none; width: 20px; height: 12px; }} .t-donde span:nth-child(2) {{ flex: 1; }}
.t-ped {{ flex: none; font-weight: bold; }}
.t-prod {{ padding: 2px 4px; line-height: 1.3; }} .t-prod .pr {{ white-space: nowrap; }} .t-prod small {{ font-size: .8em; }}
.t-obs {{ padding: 1px 4px; font-size: .82em; font-style: italic; border-top: 1px dotted #000; }}
.t-pie {{ padding: 1px 4px; font-size: .72em; border-top: 1px dotted #000; white-space: nowrap; overflow: hidden; }}
</style></head><body>
<div class="cab"><div><div class="tipo">GUÍA DE CARGA Y ENTREGA</div>
<h1>{escape(fur["nombre"])}{f'<span class="placa">{escape(fur["placa"])}</span>' if fur.get("placa") else ""}</h1>
<div class="sub"><b>{fecha_larga(plano.fecha)}</b>{" · Ruta: " + escape(ruta) if ruta else ""}{" · " + escape(plano.nombre) if plano.nombre != ruta else ""}</div></div>
<div class="cifras">
<div class="cifra"><b>{total_pedidos}</b><span>Pedidos</span></div>
<div class="cifra"><b>{len(grupos)}</b><span>Paradas</span></div>
<div class="cifra"><b>{len(posiciones)}</b><span>Canastillas</span></div>
<div class="cifra"><b>{f"{peso:,.0f}".replace(",", ".") + " kg" if peso is not None else "—"}</b><span>Peso est.</span></div>
</div>
<div class="negocio">{escape(negocio)}<br>Despacho {escape(estado.lower())}{"<br>Datos congelados al confirmar" if congelado else ""}</div></div>
<div class="cuerpo">
<div class="izq">{"".join(fichas[:k])}</div>
<div class="der">
<div class="plano">{svg_planta(medidas, grupos, posiciones, set(plano.bloqueos or []), ancho_px=ancho_plano)}</div>
<div class="nota">En cada posición: <b>número de parada</b> y <b>×N</b> canastillas apiladas · números por fuera de la caja = <b>filas desde la cabina</b> · la <b>parada 1</b> va junto a las puertas.{f" <b>Notas:</b> {escape(plano.notas)}" if plano.notas else ""}</div>
<div class="abajo">{abajo}</div>
</div></div>
</body></html>"""

    # Se parte de lo más legible que, por estimación, cabe; se comprueba
    # renderizando y, si no cabe, se pide una estimación más holgada.
    elegido = None
    for holgura in (1.0, 1.15, 1.3, 1.5, 1.8):
        for opcion in _opciones(medidas, textos, holgura)[:2]:
            if _cabe_en_una_hoja(documento(*opcion)):
                elegido = opcion
                break
        if elegido:
            break
    if elegido is None:
        n = len(fichas)
        elegido = (5.5, 420, -(-n // 2), 3)
    return documento(*elegido)
