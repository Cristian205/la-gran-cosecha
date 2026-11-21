"""
La documentación de un lote de despacho.

Tres documentos, los mismos que se imprimen hoy por separado, y la posibilidad
de bajarlos juntos:

* **Planos de carga** — una hoja por vehículo, con el plano superior del furgón
  y las fichas de parada. Es `plano_pdf.html_plano`, sin tocar: la hoja que ya
  usa el conductor.
* **Relación de productos** — por vehículo y parada, qué recibe cada cliente,
  con el total del día para quien alista en bodega. Es el documento nuevo.
* **Facturas** — las de los pedidos originales, con el formato de facturación
  del negocio (`orders.pdf.html_facturas`). No se reescriben ni se agrupan: una
  factura por pedido, como siempre.

# Por qué se unen páginas y no HTML

Cada documento trae su propio `@page`: los planos van en carta horizontal y
las facturas en vertical. Pegar los HTML en uno solo haría que el último
`@page` mandara sobre todos. WeasyPrint permite renderizar cada documento por
separado y copiar sus páginas a un PDF único (`Document.copy`), que es
exactamente lo que hace falta y no añade ninguna dependencia.
"""
from html import escape

from .plano_pdf import fecha_larga

#: Qué documentos se pueden pedir y en qué orden salen cuando se piden todos.
DOCUMENTOS = ("planos", "productos", "facturas")

ETIQUETAS = {
    "planos": "Planos de carga y descarga",
    "productos": "Relación de productos por parada",
    "facturas": "Facturas de los pedidos",
    "todo": "Documentación completa del lote",
}


def unir(htmls: list[str], respuesta, base_url=None):
    """
    Escribe en `respuesta` un PDF con las páginas de todos los `htmls`.

    Cada HTML se renderiza con su propio tamaño de página y sus márgenes; el
    resultado es un solo archivo que conserva el formato de cada documento.
    """
    from weasyprint import HTML  # noqa: PLC0415 — ver orders/pdf.py

    documentos = [HTML(string=h, base_url=base_url).render() for h in htmls if h]
    if not documentos:
        raise ValueError("No hay nada que imprimir.")
    paginas = [pagina for doc in documentos for pagina in doc.pages]
    documentos[0].copy(paginas).write_pdf(respuesta)
    return respuesta


# ==========================================================================
# Relación de productos por parada
# ==========================================================================
def _fila_producto(pr: dict) -> str:
    detalle = ""
    if len(pr.get("pedidos") or []) > 1:
        detalle = "<small>" + " · ".join(
            f'#{x["id"]}: {x["cantidad"]}' for x in pr["pedidos"]
        ) + "</small>"
    notas = f'<small class="nota">{escape("; ".join(pr.get("notas") or []))}</small>' if pr.get("notas") else ""
    return (
        f'<tr><td>{escape(pr["producto"])}{detalle}{notas}</td>'
        f'<td class="num">{escape(str(pr["cantidad"]))}</td>'
        f'<td>{escape(pr["unidad"])}</td>'
        f'<td class="chk"></td></tr>'
    )


def _tabla(productos: list[dict], vacio: str) -> str:
    if not productos:
        return f'<p class="vacio">{escape(vacio)}</p>'
    return (
        '<table class="prod"><thead><tr><th>Producto</th><th class="num">Cantidad</th>'
        '<th>Unidad</th><th class="chk">✓</th></tr></thead><tbody>'
        + "".join(_fila_producto(pr) for pr in productos)
        + "</tbody></table>"
    )


def _parada(par: dict, i: int) -> str:
    direccion = par.get("direccion") or ""
    canastillas = par.get("canastillas_calculadas") or par.get("canastillas") or 0
    cabeza = (
        f'<div class="p-cab"><span class="p-num">{par.get("orden", i + 1)}</span>'
        f'<div class="p-datos"><b>{escape(par["nombre"])}</b>'
        + (f"<small>{escape(direccion)}</small>" if direccion else "")
        + f'</div><div class="p-can"><b>{canastillas}</b><small>canastillas</small></div></div>'
    )
    pedidos = par.get("pedidos") or []
    if pedidos:
        referencias = '<p class="refs">Pedidos: ' + ", ".join(f'#{p["id"]}' for p in pedidos) + "</p>"
    else:
        referencias = '<p class="refs">Entrega extraordinaria (sin pedido en el sistema)</p>'
    nota = f'<p class="refs">Nota: {escape(par.get("nota") or "")}</p>' if par.get("nota") else ""
    cuerpo = _tabla(par.get("productos") or [], "Sin productos: se entrega lo que indique la nota.")
    return f'<div class="parada">{cabeza}{referencias}{nota}{cuerpo}</div>'


def _punto(titulo: str, punto) -> str:
    if not punto:
        return ""
    texto = " · ".join(x for x in (punto.get("nombre"), punto.get("direccion")) if x)
    return f'<span class="recorrido">{escape(titulo)}: {escape(texto)}</span>'


def _consolidado(vehiculos: list[dict]) -> list[dict]:
    """Todo el lote sumado por producto: la lista con la que se alista en bodega."""
    acum: dict[str, dict] = {}
    for v in vehiculos:
        for par in v.get("paradas") or []:
            for pr in par.get("productos") or []:
                e = acum.get(pr["clave"])
                if e is None:
                    e = acum[pr["clave"]] = {
                        "clave": pr["clave"], "producto": pr["producto"], "unidad": pr["unidad"],
                        "cantidad": 0.0, "pedidos": [], "notas": [],
                    }
                e["cantidad"] += float(pr["cantidad"])
    salida = sorted(acum.values(), key=lambda e: e["producto"].lower())
    for e in salida:
        entero = round(e["cantidad"], 3)
        e["cantidad"] = f"{entero:g}"
    return salida


def html_relacion(lote, vista: dict, negocio: str = "") -> str:
    """
    La relación de productos del lote: el total de bodega y, por vehículo, lo
    que recibe cada parada. Carta vertical, blanco y negro, con casillas para
    marcar a mano lo que ya se cargó.
    """
    vehiculos = [v for v in vista["vehiculos"] if v["paradas"]]
    resumen = vista["resumen"]
    total = _consolidado(vehiculos)
    bloques = []
    for v in vehiculos:
        m = v["metricas"]
        furgon = v["furgon"] or {}
        placa = furgon.get("placa") or ""
        titulo = escape(v["nombre"]) + (f'<span class="placa">{escape(placa)}</span>' if placa else "")
        cifras = f'{m["paradas"]} paradas · {m["pedidos"]} pedidos · {m["canastillas"]} canastillas'
        if m.get("capacidad"):
            cifras += f' de {m["capacidad"]}'
        if m.get("peso_kg"):
            cifras += f' · {m["peso_kg"]:.0f} kg estimados'
        recorrido = _punto("Salida", v.get("inicio")) + _punto("Regreso", v.get("fin"))
        paradas = "".join(_parada(par, i) for i, par in enumerate(v["paradas"]))
        bloques.append(
            f'<section class="veh"><h2>{titulo}</h2>'
            f'<p class="veh-meta">{cifras}</p>'
            + (f'<p class="veh-meta">{recorrido}</p>' if recorrido else "")
            + paradas
            + "</section>"
        )
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page {{ size: letter portrait; margin: 12mm 10mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 8.5pt; margin: 0; }}
.cab {{ display: flex; justify-content: space-between; align-items: flex-end;
        border-bottom: 3px solid #000; padding-bottom: 4px; margin-bottom: 8px; }}
.cab .tipo {{ font-size: 7pt; letter-spacing: .12em; font-weight: bold; }}
h1 {{ font-size: 15pt; margin: 0; }}
.sub {{ font-size: 9pt; }}
.negocio {{ text-align: right; font-size: 7.5pt; line-height: 1.35; }}
.cifras {{ display: flex; gap: 4px; margin: 0 0 8px; }}
.cifra {{ border: 1.6px solid #000; border-radius: 4px; padding: 1px 7px; text-align: center; }}
.cifra b {{ display: block; font-size: 13pt; line-height: 1.15; }}
.cifra span {{ font-size: 6pt; letter-spacing: .07em; text-transform: uppercase; }}
h2 {{ font-size: 11pt; margin: 10px 0 1px; border-bottom: 1.6px solid #000; padding-bottom: 2px; }}
h2 .placa {{ border: 1.4px solid #000; border-radius: 3px; padding: 0 4px; font-size: 8pt; margin-left: 6px; }}
h3 {{ font-size: 9.5pt; margin: 6px 0 3px; }}
.veh {{ page-break-inside: auto; }}
.veh-meta {{ margin: 1px 0 4px; font-size: 7.6pt; }}
.recorrido {{ margin-right: 10px; }}
.parada {{ border: 1.2px solid #000; border-radius: 4px; margin-bottom: 5px; page-break-inside: avoid; }}
.p-cab {{ display: flex; align-items: stretch; border-bottom: 1px solid #000; }}
.p-num {{ width: 2.2em; flex: none; display: flex; align-items: center; justify-content: center;
          font-size: 1.6em; font-weight: bold; background: #e6e6e6; border-right: 1.2px solid #000; }}
.p-datos {{ flex: 1; min-width: 0; padding: 2px 5px; line-height: 1.25; }}
.p-datos b {{ font-size: 1.1em; }} .p-datos small {{ display: block; font-size: .85em; }}
.p-can {{ width: 4.2em; flex: none; text-align: center; border-left: 1px solid #000; padding: 1px 2px; }}
.p-can b {{ display: block; font-size: 1.4em; line-height: 1.1; }} .p-can small {{ font-size: .62em; }}
.refs {{ margin: 2px 5px; font-size: .86em; }}
table.prod {{ width: 100%; border-collapse: collapse; }}
table.prod th {{ text-align: left; font-size: .78em; text-transform: uppercase; letter-spacing: .05em;
                 border-bottom: 1px solid #000; padding: 1px 5px; }}
table.prod td {{ padding: 1px 5px; border-bottom: .5px dotted #777; vertical-align: top; }}
table.prod td small {{ display: block; font-size: .82em; }}
table.prod td small.nota {{ font-style: italic; }}
table.prod .num {{ text-align: right; white-space: nowrap; font-weight: bold; }}
table.prod .chk {{ width: 1.6em; text-align: center; }}
table.prod tbody .chk {{ border-left: .5px solid #777; }}
.vacio {{ margin: 3px 5px; font-style: italic; font-size: .88em; }}
.total {{ border: 2px solid #000; border-radius: 4px; padding: 3px 0 0; }}
.total h3 {{ margin: 0 5px 2px; }}
.pie {{ margin-top: 10px; font-size: 7pt; border-top: 1px solid #000; padding-top: 3px; }}
</style></head><body>
<div class="cab"><div>
<div class="tipo">RELACIÓN DE PRODUCTOS POR PARADA</div>
<h1>Lote #{lote.numero}{f" · {escape(lote.nombre)}" if lote.nombre else ""}</h1>
<div class="sub"><b>{fecha_larga(lote.fecha)}</b> · {escape(vista["estado_etiqueta"])}</div>
</div><div class="negocio">{escape(negocio)}<br>{resumen["vehiculos"]} vehículos · {resumen["paradas"]} paradas</div></div>
<div class="cifras">
<div class="cifra"><b>{resumen["pedidos_asignados"]}</b><span>Pedidos</span></div>
<div class="cifra"><b>{resumen["clientes"]}</b><span>Clientes</span></div>
<div class="cifra"><b>{resumen["canastillas"]}</b><span>Canastillas</span></div>
<div class="cifra"><b>{f'{resumen["peso_kg"]:,.0f}'.replace(",", ".") + " kg" if resumen.get("peso_kg") else "—"}</b><span>Peso est.</span></div>
</div>
<section class="total"><h3>Total del lote (alistamiento en bodega)</h3>{_tabla(total, "El lote no tiene productos.")}</section>
{"".join(bloques)}
<p class="pie">Las cantidades conservan la unidad de venta de cada pedido: no se convierten.
Un producto pedido en kilos y en bultos aparece en dos líneas.</p>
</body></html>"""
