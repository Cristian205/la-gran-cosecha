"""
Motor de planificación diaria: de los pedidos de la tienda a un despacho por
vehículo.

    rutas_del_dia      la programación semanal ACTIVA para ese día de la
                       semana, con los ajustes de esa fecha aplicados.
    pedidos_del_dia    los pedidos REALES (`orders.Pedido`) que se entregan
                       ese día. No hay una segunda fuente de pedidos.
    consolidar         suma por producto los detalles de varios pedidos, sin
                       convertir unidades y sin perder qué pedido aportó qué.
    proponer           cruza pedidos y rutas: cada cliente va al vehículo que
                       lo tiene en su ruta; lo que no encaja queda «sin
                       asignar» con su motivo. NO guarda nada.
    generar            convierte la propuesta (ya revisada por el
                       administrador) en despachos `PlanoCarga` en borrador,
                       con su acomodo automático y la copia de los datos
                       operativos.

# Canastillas y peso

Solo se estiman con una regla EXPLÍCITA por presentación (`ReglaCarga`):
cuántas unidades de esa presentación llenan una canastilla y cuánto pesa una
unidad. Una línea sin regla no se convierte: se avisa, y el administrador fija
las canastillas de la parada a mano.

# Fecha de entrega

La de `Pedido.fecha_programada`; si el negocio no la fijó, el día siguiente al
pedido. Es la misma regla que usa la factura (`orders/pdf.py`).
"""
import datetime
import math
from collections import OrderedDict
from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.orders.models import Cliente, DetallePedido, Pedido

from .esquemas import calcular_esquema
from .models import AjusteRuta, Furgon, PedidoDespacho, PlanoCarga, ProgramacionSemanal
from .serializers import PlanoCargaSerializer, coordenadas, revisar

#: Estados que ya no se planifican.
ESTADOS_EXCLUIDOS = ("ENTREGADO",)

#: Mismo orden de llenado que `acomodo.ts` (frontend): de la cabina a la puerta.
ORDEN_ZONA = {"frente": 0, "izquierda": 1, "derecha": 2, "rejilla": 3}

#: Paleta de destinos (igual a `COLORES_GRUPO` del frontend).
COLORES = [
    "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed",
    "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569",
]

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def texto_decimal(valor: Decimal) -> str:
    """35.00 → "35"; 2.50 → "2.5". Sin notación científica."""
    if valor is None:
        return ""
    return format(Decimal(valor).normalize(), "f")


def _regla(presentacion):
    try:
        return presentacion.regla_carga
    except ObjectDoesNotExist:
        return None


# ==========================================================================
# Rutas del día
# ==========================================================================
def _parada(cliente, nota="") -> dict:
    return {
        "cliente_id": cliente.id,
        "nombre": cliente.nombre_cliente,
        "direccion": cliente.direccion_cliente or "",
        "nota": nota or "",
    }


def _furgon(f: Furgon | None) -> dict | None:
    if f is None:
        return None
    return {
        "id": f.id, "nombre": f.nombre, "placa": f.placa, "modelo_3d": f.modelo_3d,
        "carga_util_kg": f.carga_util_kg, "activo": f.activo,
    }


def rutas_del_dia(tenant, fecha: datetime.date) -> dict:
    """
    {"programacion": {...} | None, "rutas": [...], "canceladas": [...]}.

    Cada ruta: {clave, ruta_id, ajuste_id, nombre, color, furgon, paradas,
    ajustada}. La clave identifica la ruta en los despachos: "r<id>" para la
    ruta semanal (también cuando ese día se ajustó) y "a<id>" para una ruta
    extra creada solo para esa fecha.
    """
    prog = ProgramacionSemanal.objects.filter(tenant=tenant, activa=True).first()
    ajustes = list(AjusteRuta.objects.filter(tenant=tenant, fecha=fecha).select_related("furgon"))
    ids_clientes = {p.get("cliente") for a in ajustes for p in a.paradas or []}
    clientes = {c.id: c for c in Cliente.objects.filter(tenant=tenant, id__in=ids_clientes)}
    por_ruta = {a.ruta_id: a for a in ajustes if a.ruta_id}

    def desde_ajuste(a, clave, ruta_id):
        return {
            "clave": clave,
            "ruta_id": ruta_id,
            "ajuste_id": a.id,
            "nombre": a.nombre,
            "color": a.color,
            "furgon": _furgon(a.furgon),
            "paradas": [
                _parada(clientes[p["cliente"]], p.get("nota", ""))
                for p in a.paradas or []
                if p.get("cliente") in clientes
            ],
            "ajustada": True,
            "motivo": a.motivo,
        }

    rutas, canceladas = [], []
    if prog:
        qs = prog.rutas.filter(dia_semana=fecha.weekday()).select_related("furgon").prefetch_related("paradas__cliente")
        for r in qs:
            a = por_ruta.get(r.id)
            if a and a.cancelada:
                canceladas.append({"clave": f"r{r.id}", "ruta_id": r.id, "ajuste_id": a.id, "nombre": r.nombre,
                                   "motivo": a.motivo, "furgon": _furgon(r.furgon)})
            elif a:
                rutas.append(desde_ajuste(a, f"r{r.id}", r.id))
            else:
                rutas.append({
                    "clave": f"r{r.id}",
                    "ruta_id": r.id,
                    "ajuste_id": None,
                    "nombre": r.nombre,
                    "color": r.color,
                    "furgon": _furgon(r.furgon),
                    "paradas": [_parada(p.cliente, p.nota) for p in r.paradas.all()],
                    "ajustada": False,
                    "motivo": "",
                })
    for a in ajustes:
        if a.ruta_id is None and not a.cancelada:
            rutas.append(desde_ajuste(a, f"a{a.id}", None))
    return {
        "programacion": {"id": prog.id, "nombre": prog.nombre} if prog else None,
        "rutas": rutas,
        "canceladas": canceladas,
    }


# ==========================================================================
# Pedidos y consolidación
# ==========================================================================
def filtro_fecha_entrega(fecha: datetime.date) -> Q:
    return Q(fecha_programada__date=fecha) | Q(
        fecha_programada__isnull=True, fecha_pedido__date=fecha - datetime.timedelta(days=1)
    )


def con_detalles(qs):
    return qs.select_related("cliente").prefetch_related(
        Prefetch(
            "detalles",
            queryset=DetallePedido.objects.select_related(
                "presentacion__producto", "presentacion__unidad_venta", "presentacion__regla_carga",
                "unidad_personalizada",
            ).order_by("id"),
        )
    )


def pedidos_del_dia(tenant, fecha: datetime.date):
    return con_detalles(
        Pedido.objects.filter(tenant=tenant).filter(filtro_fecha_entrega(fecha)).exclude(estado__in=ESTADOS_EXCLUIDOS)
    ).order_by("cliente__nombre_cliente", "id")


def _unidad_texto(pres) -> str:
    """Cómo se vende, tal cual: «Kilo», «Bulto de 50 kg», «kg»."""
    unidad = pres.unidad_venta
    abrev = unidad.abreviatura_unidad or unidad.nombre_unidad
    nombre = (pres.nombre_presentacion or "").strip()
    if not nombre or nombre.lower() in (unidad.nombre_unidad.lower(), abrev.lower()):
        return abrev
    if pres.factor_conversion and pres.factor_conversion != 1:
        return f"{nombre} de {texto_decimal(pres.factor_conversion)} {abrev}"
    return nombre


def lineas_de_pedido(pedido) -> list[dict]:
    """Los productos del pedido con su unidad de venta ORIGINAL."""
    lineas = []
    for d in pedido.detalles.all():
        if d.presentacion_id:
            pres = d.presentacion
            regla = _regla(pres)
            lineas.append({
                "clave": f"p{pres.id}",
                "producto": pres.producto.nombre_producto,
                "unidad": _unidad_texto(pres),
                "cantidad": d.cantidad,
                "nota": d.nota or "",
                "upc": regla.unidades_por_canastilla if regla else None,
                "peso": regla.peso_kg_por_unidad if regla else None,
            })
        else:
            nombre = (d.nombre_personalizado or d.nombre_congelado or "Producto").strip()
            unidad = d.unidad_personalizada
            lineas.append({
                "clave": f"n{nombre.lower()}|{d.unidad_personalizada_id or ''}",
                "producto": nombre,
                "unidad": (unidad.abreviatura_unidad or unidad.nombre_unidad) if unidad else "",
                "cantidad": d.cantidad,
                "nota": d.nota or "",
                "upc": None,
                "peso": None,
            })
    return lineas


def consolidar(pedidos) -> list[dict]:
    """
    Suma por producto (misma presentación = misma unidad) los detalles de los
    pedidos, conservando cuánto aportó cada pedido. No convierte unidades: la
    papa por kilo y la papa por bulto son dos filas.
    """
    acum: "OrderedDict[str, dict]" = OrderedDict()
    for p in pedidos:
        for linea in lineas_de_pedido(p):
            e = acum.get(linea["clave"])
            if e is None:
                e = acum[linea["clave"]] = {
                    "clave": linea["clave"], "producto": linea["producto"], "unidad": linea["unidad"],
                    "cantidad": Decimal(0), "pedidos": OrderedDict(), "notas": [],
                    "upc": linea["upc"], "peso": linea["peso"],
                }
            e["cantidad"] += linea["cantidad"]
            e["pedidos"][p.id] = e["pedidos"].get(p.id, Decimal(0)) + linea["cantidad"]
            if linea["nota"] and linea["nota"] not in e["notas"]:
                e["notas"].append(linea["nota"])
    return sorted(acum.values(), key=lambda e: e["producto"].lower())


def estimar(productos: list[dict]) -> dict:
    """Canastillas y peso de unos productos consolidados (solo con reglas)."""
    fraccion = Decimal(0)
    peso = Decimal(0)
    sin_regla, sin_peso = [], []
    for e in productos:
        if e["upc"]:
            fraccion += e["cantidad"] / e["upc"]
        else:
            sin_regla.append(e["producto"])
        if e["peso"] is not None:
            peso += e["cantidad"] * e["peso"]
        else:
            sin_peso.append(e["producto"])
    canastillas = max(1, math.ceil(fraccion)) if productos else 0
    return {
        "fraccion": float(round(fraccion, 3)),
        "canastillas": canastillas,
        "peso_kg": float(round(peso, 1)) if productos and not sin_peso else None,
        "peso_parcial_kg": float(round(peso, 1)),
        "sin_regla": sin_regla,
        "sin_peso": sin_peso,
    }


def productos_json(productos: list[dict]) -> list[dict]:
    return [
        {
            "clave": e["clave"],
            "producto": e["producto"],
            "unidad": e["unidad"],
            "cantidad": texto_decimal(e["cantidad"]),
            "pedidos": [{"id": pid, "cantidad": texto_decimal(c)} for pid, c in e["pedidos"].items()],
            "notas": e["notas"],
            "con_regla": bool(e["upc"]),
            # Fracción de canastilla que ocupa: el frontend la usa para
            # recalcular una parada cuando se mueven pedidos.
            "fraccion": float(round(e["cantidad"] / e["upc"], 3)) if e["upc"] else None,
            "peso_kg": float(round(e["cantidad"] * e["peso"], 2)) if e["peso"] is not None else None,
        }
        for e in productos
    ]


def pedido_json(p) -> dict:
    productos = consolidar([p])
    est = estimar(productos)
    return {
        "id": p.id,
        "estado": p.estado,
        "cliente_id": p.cliente_id,
        "cliente_nombre": p.cliente.nombre_cliente if p.cliente else "Pedido sin cliente",
        "direccion": p.direccion_de_entrega,
        "telefono": p.telefono_de_contacto,
        "recibe": p.recibe_nombre,
        "observaciones": p.observaciones or "",
        "indicaciones": p.indicaciones_entrega or "",
        "total": str(p.total_pedido),
        "fecha_pedido": p.fecha_pedido.isoformat() if p.fecha_pedido else None,
        "fecha_programada": p.fecha_programada.isoformat() if p.fecha_programada else None,
        "productos": productos_json(productos),
        **est,
    }


# ==========================================================================
# Propuesta
# ==========================================================================
def _capacidad(furgon: Furgon, tipo) -> dict:
    esquema = calcular_esquema(furgon, tipo)
    tope_peso = None
    if tipo.peso_lleno_kg and furgon.carga_util_kg:
        tope_peso = int(Decimal(furgon.carga_util_kg) // tipo.peso_lleno_kg)
    return {
        "canastillas": esquema["capacidad"],
        "posiciones": len(esquema["pilas"]),
        "niveles": esquema["niveles"],
        "carga_util_kg": furgon.carga_util_kg,
        "tope_por_peso": tope_peso,
        "errores": esquema["errores"],
    }


def _despacho_json(plano: PlanoCarga) -> dict:
    rev = revisar(
        {"grupos": plano.grupos, "posiciones": plano.posiciones, "medidas": plano.medidas},
        plano.furgon, plano.tipo_canastilla,
    )
    return {
        "errores": rev["errores"],
        "advertencias": len(rev["advertencias"]),
        "listo": plano.estado == PlanoCarga.BORRADOR and not rev["errores"],
        "capacidad": (plano.medidas or {}).get("capacidad", 0),
        "id": plano.id,
        "nombre": plano.nombre,
        "estado": plano.estado,
        "ruta_clave": plano.ruta_clave,
        "furgon": plano.furgon_id,
        "canastillas": len(plano.posiciones or []),
        "destinos": len(plano.grupos or []),
    }


def clave_de_plano(plano: PlanoCarga) -> str:
    return plano.ruta_clave or f"d{plano.id}"


def proponer(tenant, fecha: datetime.date, tipo) -> dict:
    """
    La distribución sugerida para el día. Respeta lo que ya está en un
    despacho (un pedido no cambia de vehículo solo porque se recalculó) y
    deja fuera de la propuesta lo confirmado.
    """
    dia = rutas_del_dia(tenant, fecha)
    pedidos = list(pedidos_del_dia(tenant, fecha))
    asignaciones = {
        a.pedido_id: a
        for a in PedidoDespacho.objects.filter(pedido__in=pedidos).select_related("plano", "plano__furgon", "plano__tipo_canastilla")
    }
    despachos = list(PlanoCarga.objects.filter(tenant=tenant, fecha=fecha).select_related("furgon", "tipo_canastilla").order_by("creado"))

    capacidades = {}

    def capacidad(f):
        if f.id not in capacidades:
            capacidades[f.id] = _capacidad(f, tipo)
        return capacidades[f.id]

    vehiculos: "OrderedDict[str, dict]" = OrderedDict()
    for r in dia["rutas"]:
        f = Furgon.objects.filter(pk=r["furgon"]["id"]).first() if r["furgon"] else None
        vehiculos[r["clave"]] = {
            "clave": r["clave"],
            "ruta_id": r["ruta_id"],
            "ajuste_id": r["ajuste_id"],
            "origen": "extra" if r["clave"].startswith("a") else ("ajuste" if r["ajustada"] else "ruta"),
            "nombre": r["nombre"],
            "color": r["color"],
            "furgon": r["furgon"],
            "capacidad": capacidad(f) if f else None,
            "ruta_paradas": r["paradas"],
            "despacho": None,
            "bloqueado": False,
            "_paradas": OrderedDict(),
        }
    for d in despachos:
        clave = clave_de_plano(d)
        v = vehiculos.get(clave)
        if v is None:
            v = vehiculos[clave] = {
                "clave": clave, "ruta_id": d.ruta_id, "ajuste_id": None, "origen": "despacho",
                "nombre": d.nombre, "color": "#475569", "furgon": _furgon(d.furgon),
                "capacidad": capacidad(d.furgon), "ruta_paradas": [], "despacho": None,
                "bloqueado": False, "_paradas": OrderedDict(),
            }
        # Si hay varios despachos con la misma clave manda el confirmado.
        if v["despacho"] is None or d.estado == PlanoCarga.CONFIRMADO:
            v["despacho"] = _despacho_json(d)
            v["bloqueado"] = d.estado == PlanoCarga.CONFIRMADO
            v["_orden_grupos"] = {g.get("cliente"): g["orden"] for g in d.grupos or [] if g.get("cliente")}

    rutas_de_cliente: dict[int, list[str]] = {}
    for clave, v in vehiculos.items():
        for p in v["ruta_paradas"]:
            rutas_de_cliente.setdefault(p["cliente_id"], []).append(clave)

    sin_asignar = []
    for p in pedidos:
        datos = pedido_json(p)
        a = asignaciones.get(p.id)
        if a:
            clave = clave_de_plano(a.plano)
            datos["despacho"] = _despacho_json(a.plano)
            datos["canastillas_asignadas"] = a.canastillas
            v = vehiculos[clave]
        else:
            datos["despacho"] = None
            if p.cliente_id is None:
                sin_asignar.append({**datos, "motivo": "El pedido no tiene cliente."})
                continue
            candidatas = rutas_de_cliente.get(p.cliente_id, [])
            libres = [c for c in candidatas if not vehiculos[c]["bloqueado"]]
            if not candidatas:
                sin_asignar.append({**datos, "motivo": f"El cliente no está en ninguna ruta del {DIAS[fecha.weekday()].lower()}."})
                continue
            if not libres:
                nombres = ", ".join(vehiculos[c]["nombre"] for c in candidatas)
                sin_asignar.append({**datos, "motivo": f"El despacho de {nombres} ya está confirmado: reábrelo o asigna el pedido a otro vehículo."})
                continue
            v = vehiculos[libres[0]]
            if len(candidatas) > 1:
                datos["aviso"] = "El cliente está en varias rutas de ese día; se propuso la primera."
        clave_parada = p.cliente_id if p.cliente_id is not None else f"p{p.id}"
        parada = v["_paradas"].get(clave_parada)
        if parada is None:
            cliente = p.cliente
            parada = v["_paradas"][clave_parada] = {
                "cliente_id": p.cliente_id,
                "nombre": cliente.nombre_cliente if cliente else datos["cliente_nombre"],
                "direccion": datos["direccion"],
                "telefono": datos["telefono"],
                "en_ruta": any(rp["cliente_id"] == p.cliente_id for rp in v["ruta_paradas"]),
                "nota_ruta": next((rp["nota"] for rp in v["ruta_paradas"] if rp["cliente_id"] == p.cliente_id), ""),
                "pedidos": [],
            }
        parada["pedidos"].append(datos)

    lista = []
    for v in vehiculos.values():
        orden_ruta = {rp["cliente_id"]: i for i, rp in enumerate(v["ruta_paradas"])}
        orden_desp = v.pop("_orden_grupos", {})
        paradas = list(v.pop("_paradas").values())

        def clave_orden(par):
            cid = par["cliente_id"]
            if cid in orden_desp:
                return (0, orden_desp[cid])
            if cid in orden_ruta:
                return (1, orden_ruta[cid])
            return (2, 0)

        paradas.sort(key=clave_orden)
        for i, par in enumerate(paradas):
            par["orden"] = i + 1
            productos = consolidar_desde_json([d for d in par["pedidos"]])
            par["productos"] = productos
            asignadas = [d.get("canastillas_asignadas") for d in par["pedidos"]]
            if all(c is not None for c in asignadas):
                par["canastillas"] = max(1, sum(asignadas))
                par["canastillas_manual"] = True
            else:
                par["canastillas"] = max(1, math.ceil(sum(d["fraccion"] for d in par["pedidos"]) - 1e-9))
                par["canastillas_manual"] = False
            par["sin_regla"] = sorted({n for d in par["pedidos"] for n in d["sin_regla"]})
            pesos = [d["peso_kg"] for d in par["pedidos"]]
            par["peso_kg"] = round(sum(pesos), 1) if pesos and all(x is not None for x in pesos) else None
        con_pedido = {par["cliente_id"] for par in paradas}
        v["paradas"] = paradas
        v["paradas_sin_pedido"] = [rp for rp in v["ruta_paradas"] if rp["cliente_id"] not in con_pedido]
        v["ruta_total_paradas"] = len(v["paradas_sin_pedido"]) + sum(1 for par in paradas if par["en_ruta"])
        lista.append(v)

    return {
        "fecha": fecha.isoformat(),
        "dia_semana": fecha.weekday(),
        "dia_nombre": DIAS[fecha.weekday()],
        "programacion": dia["programacion"],
        "tipo_canastilla": {"id": tipo.id, "nombre": tipo.nombre, "peso_lleno_kg": float(tipo.peso_lleno_kg) if tipo.peso_lleno_kg else None},
        "vehiculos": lista,
        "sin_asignar": sin_asignar,
        "rutas_canceladas": dia["canceladas"],
        "despachos": [_despacho_json(d) for d in despachos],
        "resumen": {
            "pedidos": len(pedidos),
            "asignados_en_despacho": len(asignaciones),
            "sin_asignar": len(sin_asignar),
            "clientes": len({p.cliente_id for p in pedidos if p.cliente_id}),
            "vehiculos": len(lista),
        },
    }


def consolidar_desde_json(pedidos: list[dict]) -> list[dict]:
    """Consolida productos ya serializados (de `pedido_json`) de varios pedidos."""
    acum: "OrderedDict[str, dict]" = OrderedDict()
    for d in pedidos:
        for pr in d["productos"]:
            e = acum.get(pr["clave"])
            if e is None:
                e = acum[pr["clave"]] = {**pr, "cantidad": Decimal(0), "pedidos": [], "notas": list(pr["notas"]),
                                         "fraccion": 0.0 if pr["fraccion"] is not None else None,
                                         "peso_kg": 0.0 if pr["peso_kg"] is not None else None}
            e["cantidad"] += Decimal(pr["cantidad"])
            e["pedidos"] += pr["pedidos"]
            for n in pr["notas"]:
                if n not in e["notas"]:
                    e["notas"].append(n)
            if e["fraccion"] is not None and pr["fraccion"] is not None:
                e["fraccion"] = round(e["fraccion"] + pr["fraccion"], 3)
            if e["peso_kg"] is not None:
                e["peso_kg"] = round(e["peso_kg"] + pr["peso_kg"], 2) if pr["peso_kg"] is not None else None
    salida = []
    for e in sorted(acum.values(), key=lambda x: x["producto"].lower()):
        e["cantidad"] = texto_decimal(e["cantidad"])
        salida.append(e)
    return salida


# ==========================================================================
# Acomodo automático (mismo algoritmo que `acomodo.ts`)
# ==========================================================================
def pilas_en_orden(medidas: dict) -> list[int]:
    pilas = medidas["pilas"]
    return sorted(range(len(pilas)), key=lambda i: (pilas[i]["x"], ORDEN_ZONA.get(pilas[i]["zona"], 9), pilas[i]["y"]))


def acomodar(grupos: list[dict], medidas: dict, tope: int | None = None) -> list[dict]:
    """
    La primera parada queda junto a las puertas y la última hacia la cabina.
    Si hay pilas de sobra, cada parada empieza su propia pila (no se mezclan
    destinos sin necesidad) y se usan las pilas más cercanas a las puertas. Nunca
    inventa espacio: lo que no cabe queda sin ubicar y la revisión lo reporta.
    Mismo algoritmo que `acomodarAutomatico` (frontend, `acomodo.ts`).
    """
    orden = pilas_en_orden(medidas)
    niveles = medidas["niveles"]
    secuencia = [g for _, g in sorted(enumerate(grupos), key=lambda t: (-t[1]["orden"], t[0]))]
    total = sum(g["cantidad"] for g in secuencia)
    limite = total if tope is None else min(total, tope)
    necesarias = sum(math.ceil(g["cantidad"] / niveles) for g in secuencia) if niveles else len(orden) + 1
    separadas = necesarias <= len(orden)
    if separadas:
        # Sobra espacio: se usan las pilas más cercanas a las puertas, así la
        # primera parada queda en la puerta y la última hacia la cabina.
        orden = orden[len(orden) - necesarias:]
    posiciones, i_pila, nivel = [], 0, 0
    for g in secuencia:
        if separadas and nivel > 0:
            i_pila, nivel = i_pila + 1, 0
        for _ in range(g["cantidad"]):
            if len(posiciones) >= limite or i_pila >= len(orden):
                return posiciones
            posiciones.append({"grupo": g["id"], "pila": orden[i_pila], "nivel": nivel})
            nivel += 1
            if nivel >= niveles:
                i_pila, nivel = i_pila + 1, 0
    return posiciones


def adaptar_a_esquema(plano: PlanoCarga) -> bool:
    """
    Pone un despacho en BORRADOR al día con las medidas actuales de su
    vehículo y su canastilla. Cada canastilla se queda en la misma posición
    (por su etiqueta: «I3», «D2», «T1»…) si sigue existiendo y cabe por la
    altura; las demás se ubican en los huecos libres, de la cabina hacia las
    puertas, y lo que no quepa queda pendiente para que la revisión lo diga.
    Los confirmados no se tocan: su geometría es parte del histórico.
    Devuelve si hubo cambios.
    """
    if plano.estado != PlanoCarga.BORRADOR:
        return False
    nuevas = calcular_esquema(plano.furgon, plano.tipo_canastilla)
    viejas = plano.medidas or {}
    if viejas.get("pilas") == nuevas["pilas"] and viejas.get("niveles") == nuevas["niveles"] \
            and viejas.get("canastilla") == nuevas["canastilla"] and viejas.get("furgon") == nuevas["furgon"]:
        return False
    indice = {p["etiqueta"]: i for i, p in enumerate(nuevas["pilas"])}
    etiqueta_vieja = [p["etiqueta"] for p in viejas.get("pilas") or []]
    niveles = nuevas["niveles"]

    por_pila: dict[int, list] = {}
    sueltas = []
    for p in sorted(plano.posiciones or [], key=lambda p: p["nivel"]):
        etq = etiqueta_vieja[p["pila"]] if p["pila"] < len(etiqueta_vieja) else None
        nueva = indice.get(etq)
        if nueva is not None and len(por_pila.get(nueva, [])) < niveles:
            por_pila.setdefault(nueva, []).append(p["grupo"])
        else:
            sueltas.append(p["grupo"])
    orden_de = {g["id"]: g["orden"] for g in plano.grupos or []}
    sueltas.sort(key=lambda gid: -orden_de.get(gid, 0))  # lo de última entrega, hacia la cabina
    for pila in pilas_en_orden(nuevas):
        while sueltas and len(por_pila.get(pila, [])) < niveles:
            por_pila.setdefault(pila, []).append(sueltas.pop(0))

    plano.medidas = nuevas
    plano.posiciones = [
        {"grupo": g, "pila": pila, "nivel": n, **coordenadas(nuevas, pila, n)}
        for pila, grupos in sorted(por_pila.items())
        for n, g in enumerate(grupos)
    ]
    plano.bloqueos = sorted(
        indice[etiqueta_vieja[b]] for b in plano.bloqueos or []
        if b < len(etiqueta_vieja) and etiqueta_vieja[b] in indice
    )
    plano.save(update_fields=["medidas", "posiciones", "bloqueos", "actualizado"])
    return True


def adaptar_borradores(**filtro) -> int:
    """Adapta los borradores de un vehículo o de una canastilla recién editados."""
    planos = PlanoCarga.objects.filter(estado=PlanoCarga.BORRADOR, **filtro).select_related("furgon", "tipo_canastilla")
    return sum(adaptar_a_esquema(p) for p in planos)


# ==========================================================================
# Datos operativos (lo que se imprime y se congela)
# ==========================================================================
def datos_operativos(plano: PlanoCarga) -> dict:
    asignaciones = list(plano.pedidos.all())
    ids = [a.pedido_id for a in asignaciones]
    pedidos = {p.id: p for p in con_detalles(Pedido.objects.filter(tenant=plano.tenant, id__in=ids))}
    grupo_de = {a.pedido_id: a.grupo for a in asignaciones}
    paradas = []
    for g in sorted(plano.grupos or [], key=lambda g: g["orden"]):
        suyos = [pedidos[pid] for pid in sorted(pedidos) if grupo_de.get(pid) == g["id"]]
        productos = consolidar(suyos)
        est = estimar(productos)
        primero = suyos[0] if suyos else None
        paradas.append({
            "grupo": g["id"],
            "orden": g["orden"],
            "numero": g.get("numero") or g["orden"],
            "cliente_id": g.get("cliente"),
            "nombre": g["nombre"],
            "direccion": (primero.direccion_de_entrega if primero else "") or g.get("direccion", ""),
            "telefono": primero.telefono_de_contacto if primero else "",
            "recibe": primero.recibe_nombre if primero else "",
            "canastillas": g["cantidad"],
            "pedidos": [
                {"id": p.id, "estado": p.estado, "observaciones": p.observaciones or "",
                 "indicaciones": p.indicaciones_entrega or ""}
                for p in suyos
            ],
            "productos": productos_json(productos),
            "peso_kg": est["peso_kg"],
            "sin_regla": est["sin_regla"],
        })
    f = plano.furgon
    return {
        "ruta": plano.ruta.nombre if plano.ruta_id and plano.ruta else "",
        "ruta_clave": plano.ruta_clave,
        "furgon": {"nombre": f.nombre, "placa": f.placa, "referencia": f.referencia},
        "fecha": plano.fecha.isoformat() if hasattr(plano.fecha, "isoformat") else str(plano.fecha),
        "tomado_en": timezone.now().isoformat(),
        "paradas": paradas,
    }


# ==========================================================================
# Generación de despachos
# ==========================================================================
def _entero(valor, campo, minimo, maximo):
    if not isinstance(valor, int) or isinstance(valor, bool) or not minimo <= valor <= maximo:
        raise ValidationError(f"«{campo}» debe ser un entero entre {minimo} y {maximo}.")
    return valor


def _repartir(total: int, pesos: list[float]) -> list[int]:
    """Reparte `total` canastillas entre pedidos según su fracción (mayor resto)."""
    if not pesos:
        return []
    suma = sum(pesos)
    if suma <= 0:
        return [total] + [0] * (len(pesos) - 1)
    exactas = [total * p / suma for p in pesos]
    base = [int(math.floor(x)) for x in exactas]
    resto = total - sum(base)
    for i in sorted(range(len(pesos)), key=lambda i: exactas[i] - base[i], reverse=True)[:resto]:
        base[i] += 1
    return base


def _firma(plano: PlanoCarga) -> tuple:
    """Lo que define un despacho generado: si no cambia, se conserva el acomodo manual."""
    pedidos = tuple(sorted((a.pedido_id, a.grupo, a.canastillas) for a in plano.pedidos.all()))
    grupos = tuple(sorted((g["id"], g["cantidad"], g["orden"]) for g in plano.grupos or []))
    return (plano.furgon_id, plano.tipo_canastilla_id, grupos, pedidos)


def _limpiar(plano: PlanoCarga):
    """Un borrador que perdió pedidos: quita los destinos vacíos de cliente."""
    con_pedidos = set(plano.pedidos.values_list("grupo", flat=True))
    grupos = [g for g in plano.grupos or [] if not g.get("cliente") or g["id"] in con_pedidos]
    if not grupos and plano.ruta_clave:
        plano.delete()
        return
    ids = {g["id"] for g in grupos}
    plano.grupos = grupos
    plano.posiciones = [p for p in plano.posiciones or [] if p["grupo"] in ids]
    # Las que quedaron flotando bajan (misma regla que `compactar` del frontend).
    por_pila = {}
    for p in sorted(plano.posiciones, key=lambda p: p["nivel"]):
        por_pila.setdefault(p["pila"], []).append(p)
    plano.posiciones = [
        {**p, "nivel": n, **coordenadas(plano.medidas, p["pila"], n)}
        for lista in por_pila.values()
        for n, p in enumerate(lista)
    ]
    plano.save(update_fields=["grupos", "posiciones", "actualizado"])


def generar(tenant, fecha: datetime.date, tipo, vehiculos: list, usuario, contexto: dict, liberar=()) -> list[PlanoCarga]:
    """
    Crea o actualiza un despacho en borrador por vehículo. `vehiculos`:
    [{"clave", "furgon", "nombre", "paradas": [{"cliente", "pedidos": [ids],
    "canastillas"}]}], con las paradas en orden de entrega. `liberar`: pedidos
    que el administrador retiró de su vehículo y vuelven a quedar sin asignar.
    """
    if not isinstance(vehiculos, list) or not vehiculos:
        raise ValidationError("No hay vehículos para generar.")
    if not isinstance(liberar, (list, tuple)) or any(not isinstance(x, int) or isinstance(x, bool) for x in liberar):
        raise ValidationError("«liberar» debe ser una lista de pedidos.")

    del_dia = {p.id: p for p in pedidos_del_dia(tenant, fecha)}
    furgones = {f.id: f for f in Furgon.objects.filter(tenant=tenant)}
    vistos_pedidos, vistas_claves, vistos_furgones = set(), set(), set()
    limpios = []
    for v in vehiculos:
        if not isinstance(v, dict):
            raise ValidationError("Cada vehículo debe ser un objeto.")
        clave = str(v.get("clave", "")).strip()[:20]
        if not clave or clave in vistas_claves:
            raise ValidationError("Cada vehículo necesita una clave única.")
        vistas_claves.add(clave)
        furgon = furgones.get(v.get("furgon"))
        if furgon is None:
            raise ValidationError(f"El vehículo de «{v.get('nombre', clave)}» no existe.")
        if furgon.id in vistos_furgones:
            raise ValidationError(f"«{furgon.nombre}» está en dos rutas el mismo día.")
        vistos_furgones.add(furgon.id)
        nombre = str(v.get("nombre", "")).strip()[:120] or furgon.nombre
        paradas = v.get("paradas") or []
        if not isinstance(paradas, list):
            raise ValidationError("Las paradas deben ser una lista.")
        limpias = []
        for par in paradas:
            pedidos = par.get("pedidos") if isinstance(par, dict) else None
            if not isinstance(pedidos, list) or not pedidos:
                raise ValidationError(f"«{nombre}»: cada parada necesita al menos un pedido.")
            canastillas = _entero(par.get("canastillas"), "canastillas", 1, 500)
            cliente = par.get("cliente")
            objs = []
            for pid in pedidos:
                p = del_dia.get(pid)
                if p is None:
                    raise ValidationError(f"El pedido #{pid} no se entrega el {fecha:%d/%m/%Y} o ya fue entregado.")
                if pid in vistos_pedidos:
                    raise ValidationError(f"El pedido #{pid} está en dos paradas.")
                if p.cliente_id is not None and p.cliente_id != cliente:
                    raise ValidationError(f"El pedido #{pid} es de otro cliente que el de su parada.")
                vistos_pedidos.add(pid)
                objs.append(p)
            limpias.append({"cliente": cliente, "pedidos": objs, "canastillas": canastillas})
        limpios.append({"clave": clave, "furgon": furgon, "nombre": nombre, "paradas": limpias})

    liberar = set(liberar) - vistos_pedidos
    confirmados = PedidoDespacho.objects.filter(
        pedido_id__in=vistos_pedidos | liberar, plano__estado=PlanoCarga.CONFIRMADO, tenant=tenant
    ).first()
    if confirmados:
        raise ValidationError(f"El pedido #{confirmados.pedido_id} ya está en un despacho confirmado.")

    existentes = {}
    for p in PlanoCarga.objects.filter(tenant=tenant, fecha=fecha).select_related("ruta"):
        existentes.setdefault(clave_de_plano(p), []).append(p)

    resultado = []
    with transaction.atomic():
        firmas = {}
        objetivo = {}
        for v in limpios:
            planos = existentes.get(v["clave"], [])
            if any(p.estado == PlanoCarga.CONFIRMADO for p in planos):
                raise ValidationError(f"El despacho de «{v['nombre']}» ya está confirmado: reábrelo para cambiarlo.")
            plano = planos[0] if planos else None
            objetivo[v["clave"]] = plano
            if plano:
                firmas[plano.id] = _firma(plano)

        # Los pedidos de la propuesta salen de los borradores donde estaban.
        mover = PedidoDespacho.objects.filter(tenant=tenant, pedido_id__in=vistos_pedidos | liberar)
        tocados = set(mover.values_list("plano_id", flat=True))
        mover.delete()

        for v in limpios:
            if not v["paradas"]:
                continue
            plano = objetivo[v["clave"]]
            grupos, asignados = [], []
            for i, par in enumerate(v["paradas"]):
                primero = par["pedidos"][0]
                gid = f"c{par['cliente']}" if par["cliente"] is not None else f"p{primero.id}"
                nombre = (primero.cliente.nombre_cliente if primero.cliente else f"Pedido #{primero.id}")[:80]
                grupo = {
                    "id": gid, "nombre": nombre, "cantidad": par["canastillas"], "orden": i + 1, "numero": i + 1,
                    "color": COLORES[i % len(COLORES)],
                }
                direccion = (primero.direccion_de_entrega or "").strip()[:300]
                if direccion:
                    grupo["direccion"] = direccion
                if par["cliente"] is not None:
                    grupo["cliente"] = par["cliente"]
                grupos.append(grupo)
                fracciones = [estimar(consolidar([p]))["fraccion"] for p in par["pedidos"]]
                for p, n in zip(par["pedidos"], _repartir(par["canastillas"], fracciones)):
                    asignados.append({"pedido": p.id, "grupo": gid, "canastillas": n})

            furgon = v["furgon"]
            medidas = calcular_esquema(furgon, tipo)
            tope = None
            if tipo.peso_lleno_kg and furgon.carga_util_kg:
                tope = int(Decimal(furgon.carga_util_kg) // tipo.peso_lleno_kg)
            datos = {
                "nombre": v["nombre"],
                "fecha": fecha.isoformat(),
                "furgon": furgon.id,
                "tipo_canastilla": tipo.id,
                "grupos": grupos,
                "pedidos": asignados,
                "posiciones": acomodar(grupos, medidas, tope),
                "bloqueos": [],
            }
            if plano is not None:
                # Si la composición no cambió, se respeta el acomodo hecho a mano.
                nueva = (
                    furgon.id, tipo.id,
                    tuple(sorted((g["id"], g["cantidad"], g["orden"]) for g in grupos)),
                    tuple(sorted((a["pedido"], a["grupo"], a["canastillas"]) for a in asignados)),
                )
                if firmas.get(plano.id) == nueva:
                    datos["posiciones"] = [{"grupo": p["grupo"], "pila": p["pila"], "nivel": p["nivel"]} for p in plano.posiciones]
                    datos["bloqueos"] = plano.bloqueos
                    datos["nombre"] = plano.nombre
                    datos["grupos"] = [
                        {**g, "color": viejo.get("color", g["color"]), "numero": viejo.get("numero", g["numero"])}
                        for g in grupos
                        for viejo in [next((x for x in plano.grupos if x["id"] == g["id"]), {})]
                    ]
                else:
                    # Se recalcula el esquema: el vehículo o sus medidas pudieron cambiar.
                    plano.medidas = {}
            ser = PlanoCargaSerializer(instance=plano, data=datos, context=contexto)
            ser.is_valid(raise_exception=True)
            if plano is None:
                plano = ser.save(tenant=tenant, creado_por=usuario)
            else:
                plano = ser.save()
            ruta_id = int(v["clave"][1:]) if v["clave"].startswith("r") and v["clave"][1:].isdigit() else None
            plano.ruta_clave = v["clave"]
            plano.ruta_id = ruta_id
            plano.datos_operativos = datos_operativos(plano)
            plano.save(update_fields=["ruta_clave", "ruta", "datos_operativos", "actualizado"])
            resultado.append(plano)

        usados = {p.id for p in resultado}
        for plano in PlanoCarga.objects.filter(id__in=tocados - usados, estado=PlanoCarga.BORRADOR):
            _limpiar(plano)
    return resultado
