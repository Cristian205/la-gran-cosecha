"""
Lotes de despacho: de los pedidos del día a los vehículos cargados.

El recorrido es siempre el mismo y cada paso tiene su función aquí:

    elegibles            qué pedidos se pueden planificar (y para qué fecha).
    crear                toma los pedidos elegidos, los reserva en un lote y
                         calcula el primer reparto.
    distribuir           EL MOTOR: reparte las paradas entre las turbos que
                         salen esa fecha según rutas, carga y capacidad.
    hidratar             el lote con todo lo que la pantalla necesita, leído
                         de los pedidos reales en el momento.
    guardar_distribucion las correcciones del administrador, validadas y
                         anotadas en la bitácora.
    generar              un `PlanoCarga` por vehículo (el constructor 3D).
    resumen              lo que se revisa antes de confirmar.
    confirmar            congela despachos y datos operativos.

# Por qué el reparto no es 50/50

Repartir por mitades ignora lo único que importa: la turbo que ya pasa por la
puerta del cliente. El motor asigna primero las paradas que solo una ruta
visita —esas no se discuten—, después las que varias rutas podrían atender, al
vehículo que vaya más holgado, y al final las que no están en ninguna ruta, al
que tenga sitio. Si algún vehículo queda por encima de su capacidad se intenta
pasar paradas al que tenga hueco, prefiriendo las que la otra ruta también
visita. Lo que no cabe en ningún vehículo queda SIN ASIGNAR con su motivo: el
motor no inventa espacio ni reparte para cuadrar números.

# Qué se lee y qué se guarda

Los pedidos, sus productos y sus cantidades se leen de `orders` cada vez que
se abre el lote: corregir un pedido se ve de inmediato. Lo que el lote guarda
es el REPARTO (qué parada en qué vehículo, en qué orden, con qué canastillas)
y, al confirmar, el resumen y los datos operativos de cada despacho.
"""
import datetime
import math
from collections import OrderedDict

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.orders.models import Pedido

from .models import EventoLote, LoteDespacho, PedidoDespacho, PedidoLote, PlanoCarga
from .planificacion import (
    COLORES,
    DIAS,
    ESTADOS_EXCLUIDOS,
    _capacidad,
    _despacho_json,
    _limpiar,
    clave_de_plano,
    con_detalles,
    confirmar_despacho,
    consolidar_desde_json,
    generar as generar_despachos,
    pedido_json,
    rutas_del_dia,
)

#: Tope de pedidos por lote. Un día de despacho de verdad son decenas; cien
#: mil pedidos en un lote serían un error de selección, no una jornada.
MAX_PEDIDOS = 600
MAX_VEHICULOS = 40
MAX_PARADAS = 200


# ==========================================================================
# Estado logístico de un pedido
# ==========================================================================
#
# El `estado` de `orders.Pedido` dice en qué punto está el PEDIDO como venta
# (pendiente, editado, cerrado, impreso, entregado). Lo que sigue dice en qué
# punto está su DESPACHO, que es otra cosa y se deduce de dónde está el
# pedido: sin fecha, esperando planificación, dentro de un lote, con plano de
# carga, confirmado, en ruta o entregado. Se deduce y no se guarda en una
# columna aparte para que no haya dos verdades que puedan discrepar.

RECIBIDO = "RECIBIDO"
PENDIENTE_PLANIFICACION = "PENDIENTE_PLANIFICACION"
EN_LOTE = "EN_LOTE"
PREPARADO = "PREPARADO"
CONFIRMADO = "CONFIRMADO"
EN_RUTA = "EN_RUTA"
ENTREGADO = "ENTREGADO"

ETIQUETAS_LOGISTICAS = {
    RECIBIDO: "Recibido",
    PENDIENTE_PLANIFICACION: "Pendiente de planificación",
    EN_LOTE: "Lote en preparación",
    PREPARADO: "Despacho preparado",
    CONFIRMADO: "Despacho confirmado",
    EN_RUTA: "En ruta",
    ENTREGADO: "Entregado",
}

#: Del estado del lote al del pedido, cuando el lote ya manda.
_POR_LOTE = {
    LoteDespacho.CONFIRMADO: CONFIRMADO,
    LoteDespacho.EN_RUTA: EN_RUTA,
    LoteDespacho.ENTREGADO: ENTREGADO,
}


def estados_logisticos(tenant, ids) -> dict:
    """
    `{pedido_id: {"estado", "etiqueta", "lote", "lote_numero", "despacho"}}`.

    Una sola consulta por fuente para toda una página de la tabla de pedidos.
    """
    ids = [i for i in ids if isinstance(i, int)]
    if not ids:
        return {}
    pedidos = Pedido.objects.filter(tenant=tenant, id__in=ids).values_list(
        "id", "estado", "fecha_programada"
    )
    en_lote = {
        f.pedido_id: f
        for f in PedidoLote.objects.filter(
            tenant=tenant, pedido_id__in=ids, activo=True, lote__estado__in=LoteDespacho.VIVOS
        ).select_related("lote")
    }
    en_despacho = {
        a.pedido_id: a
        for a in PedidoDespacho.objects.filter(tenant=tenant, pedido_id__in=ids).select_related("plano")
    }
    salida = {}
    for pid, estado_venta, programada in pedidos:
        fila = en_lote.get(pid)
        asignacion = en_despacho.get(pid)
        lote = fila.lote if fila else None
        if estado_venta == "ENTREGADO":
            estado = ENTREGADO
        elif lote is not None and lote.estado in _POR_LOTE:
            estado = _POR_LOTE[lote.estado]
        elif asignacion is not None and asignacion.plano.estado == PlanoCarga.CONFIRMADO:
            estado = CONFIRMADO
        elif asignacion is not None:
            estado = PREPARADO
        elif lote is not None:
            estado = EN_LOTE
        elif programada is not None:
            estado = PENDIENTE_PLANIFICACION
        else:
            estado = RECIBIDO
        salida[pid] = {
            "estado": estado,
            "etiqueta": ETIQUETAS_LOGISTICAS[estado],
            "lote": lote.id if lote else None,
            "lote_numero": lote.numero if lote else None,
            "despacho": asignacion.plano_id if asignacion else None,
        }
    return salida


# ==========================================================================
# Pedidos elegibles
# ==========================================================================
def fecha_de_entrega(pedido) -> datetime.date:
    """
    Cuándo se entrega: la fecha programada, y si no se fijó, el día siguiente
    al pedido. Es la misma regla de la factura (`orders/pdf.py`) y del centro
    del día, para que los tres cuenten lo mismo.
    """
    if pedido.fecha_programada:
        return timezone.localtime(pedido.fecha_programada).date()
    return timezone.localtime(pedido.fecha_pedido).date() + datetime.timedelta(days=1)


def pedidos_sin_planificar(tenant):
    """
    Los pedidos que todavía se pueden meter en un lote: no entregados, sin
    lote vivo y sin despacho propio (los que alguien armó a mano en el 3D).
    """
    en_lote = PedidoLote.objects.filter(
        tenant=tenant, activo=True, lote__estado__in=LoteDespacho.VIVOS
    ).values("pedido_id")
    return (
        con_detalles(Pedido.objects.filter(tenant=tenant).exclude(estado__in=ESTADOS_EXCLUIDOS))
        .exclude(id__in=en_lote)
        .exclude(despacho_asignado__isnull=False)
        .order_by("cliente__nombre_cliente", "id")
    )


def elegibles(tenant, fecha: datetime.date | None = None) -> dict:
    """
    Los pedidos planificables agrupados por fecha de entrega.

    `fecha` acota a un día; sin ella se devuelven todas las fechas con su
    conteo, que es lo que la vista de pedidos muestra para elegir el día.
    """
    por_fecha: "OrderedDict[datetime.date, list]" = OrderedDict()
    for p in pedidos_sin_planificar(tenant):
        por_fecha.setdefault(fecha_de_entrega(p), []).append(p)
    fechas = [
        {
            "fecha": f.isoformat(),
            "dia_nombre": DIAS[f.weekday()],
            "pedidos": len(por_fecha[f]),
            "clientes": len({p.cliente_id for p in por_fecha[f] if p.cliente_id}),
        }
        for f in sorted(por_fecha)
    ]
    if fecha is None:
        return {"fechas": fechas, "pedidos": []}
    datos = [pedido_json(p) for p in por_fecha.get(fecha, [])]
    return {
        "fechas": fechas,
        "fecha": fecha.isoformat(),
        "dia_nombre": DIAS[fecha.weekday()],
        "pedidos": datos,
        "resumen": {
            "pedidos": len(datos),
            "clientes": len({d["cliente_id"] for d in datos if d["cliente_id"]}),
            "canastillas": sum(d["canastillas"] for d in datos),
        },
    }


# ==========================================================================
# El motor de reparto
# ==========================================================================
def _limite(v: dict) -> float:
    """Cuántas canastillas admite el vehículo: la menor de sus dos cotas."""
    cap = v["capacidad"] or {}
    topes = [x for x in (cap.get("canastillas"), cap.get("tope_por_peso")) if x]
    return min(topes) if topes else math.inf


def _parada_nueva(pedido_datos: dict) -> dict:
    cid = pedido_datos["cliente_id"]
    return {
        "key": f"c{cid}" if cid is not None else f"p{pedido_datos['id']}",
        "cliente": cid,
        "nombre": pedido_datos["cliente_nombre"],
        "direccion": pedido_datos["direccion"],
        "pedidos": [pedido_datos],
        "manual": False,
        "nota": "",
        "extra": False,
    }


def _paradas_de(datos: list[dict]) -> list[dict]:
    """Un pedido por cliente es una parada; varios del mismo cliente, una sola."""
    paradas: "OrderedDict[str, dict]" = OrderedDict()
    for d in datos:
        nueva = _parada_nueva(d)
        actual = paradas.get(nueva["key"])
        if actual is None:
            paradas[nueva["key"]] = nueva
        else:
            actual["pedidos"].append(d)
    return list(paradas.values())


def canastillas_de(parada: dict) -> int:
    """Las fijadas a mano, o las que dan las reglas de carga sumando sus pedidos."""
    if parada.get("manual"):
        return max(1, int(parada.get("canastillas") or 1))
    if parada.get("extra"):
        return max(1, int(parada.get("canastillas") or 1))
    fraccion = sum(p.get("fraccion") or 0 for p in parada["pedidos"])
    return max(1, math.ceil(fraccion - 1e-9))


def peso_de(parada: dict) -> float | None:
    pesos = [p.get("peso_kg") for p in parada["pedidos"]]
    if not pesos or any(x is None for x in pesos):
        return None
    return round(sum(pesos), 2)


def _vehiculos_del_dia(tenant, fecha: datetime.date, tipo) -> dict:
    """Las rutas de esa fecha como vehículos vacíos, listos para recibir paradas."""
    dia = rutas_del_dia(tenant, fecha)
    vehiculos: "OrderedDict[str, dict]" = OrderedDict()
    for i, r in enumerate(dia["rutas"]):
        furgon = r["furgon"]
        vehiculos[r["clave"]] = {
            "clave": r["clave"],
            "ruta_id": r["ruta_id"],
            "ajuste_id": r["ajuste_id"],
            "origen": "extra" if r["clave"].startswith("a") else ("ajuste" if r["ajustada"] else "ruta"),
            "nombre": r["nombre"],
            "color": r["color"] or COLORES[i % len(COLORES)],
            "furgon": furgon,
            "capacidad": _capacidad_de(tenant, furgon, tipo),
            "ruta_paradas": r["paradas"],
            "inicio": None,
            "fin": None,
            "paradas": [],
        }
    return {"programacion": dia["programacion"], "canceladas": dia["canceladas"], "vehiculos": vehiculos}


def _capacidad_de(tenant, furgon_json: dict | None, tipo) -> dict | None:
    if not furgon_json:
        return None
    from .models import Furgon  # noqa: PLC0415 — solo cuando hace falta el objeto

    furgon = Furgon.objects.filter(tenant=tenant, pk=furgon_json["id"]).first()
    return _capacidad(furgon, tipo) if furgon else None


def distribuir(vehiculos: list[dict], paradas: list[dict]) -> list[str]:
    """
    Reparte `paradas` entre `vehiculos` (los modifica en sitio) y devuelve las
    notas de lo que hizo por un motivo que no es obvio.

    Cada vehículo necesita `ruta_paradas`, `capacidad` y una lista `paradas`
    vacía; cada parada, su cliente y sus pedidos ya consolidados.
    """
    notas: list[str] = []
    if not vehiculos:
        return notas

    orden_en_ruta = {
        v["clave"]: {p["cliente_id"]: i for i, p in enumerate(v["ruta_paradas"])} for v in vehiculos
    }
    utiles = [v for v in vehiculos if v["furgon"] and (v["capacidad"] or {}).get("canastillas")]
    if not utiles:
        utiles = [v for v in vehiculos if v["furgon"]]

    carga = {v["clave"]: 0 for v in vehiculos}
    kilos = {v["clave"]: 0.0 for v in vehiculos}

    def candidatos(par):
        return [v for v in utiles if par["cliente"] is not None and par["cliente"] in orden_en_ruta[v["clave"]]]

    def ocupacion(v, extra=0):
        limite = _limite(v)
        return (carga[v["clave"]] + extra) / limite if limite != math.inf else 0.0

    def colocar(par, opciones, nota=""):
        """El vehículo más holgado de los que tienen sitio; si ninguno, el más holgado."""
        if not opciones:
            return None
        n = canastillas_de(par)
        con_sitio = [v for v in opciones if carga[v["clave"]] + n <= _limite(v)]
        elegidos = con_sitio or opciones
        destino = min(elegidos, key=lambda v: (ocupacion(v, n), carga[v["clave"]], v["clave"]))
        destino["paradas"].append(par)
        carga[destino["clave"]] += n
        peso = peso_de(par)
        if peso is not None:
            kilos[destino["clave"]] += peso
        if nota:
            notas.append(nota.format(vehiculo=destino["nombre"]))
        return destino

    # 1. Las forzadas: una sola ruta visita a ese cliente, no hay nada que decidir.
    #    Van primero para que las demás se reparten sobre la carga ya comprometida.
    libres, pendientes = [], []
    for par in paradas:
        opciones = candidatos(par)
        if len(opciones) == 1:
            colocar(par, opciones)
        elif opciones:
            pendientes.append((par, opciones))
        else:
            libres.append(par)

    # 2. Las que varias rutas podrían atender: a la que vaya más holgada. De
    #    mayor a menor para que las grandes elijan primero (lo contrario deja
    #    una parada enorme sin sitio al final).
    for par, opciones in sorted(pendientes, key=lambda t: -canastillas_de(t[0])):
        colocar(par, opciones)

    # 3. Fuera de ruta: entra donde quepa, marcada como fuera de ruta para que
    #    el administrador la mueva o la deje.
    for par in sorted(libres, key=lambda p: -canastillas_de(p)):
        par["fuera_de_ruta"] = True
        colocar(
            par, utiles,
            f"«{par['nombre']}» no está en ninguna ruta de ese día: se asignó a {{vehiculo}} por capacidad.",
        )

    # 4. Reequilibrio: si un vehículo pasó de su capacidad, se le pasan paradas
    #    a quien tenga hueco, empezando por las que la otra ruta también
    #    visita (mover esas no alarga el recorrido).
    for _ in range(len(paradas) + len(vehiculos)):
        excedidos = [v for v in utiles if carga[v["clave"]] > _limite(v)]
        if not excedidos:
            break
        movido = False
        for v in sorted(excedidos, key=lambda v: -ocupacion(v)):
            for par in sorted(v["paradas"], key=lambda p: -canastillas_de(p)):
                n = canastillas_de(par)
                otros = [
                    o for o in utiles
                    if o is not v and carga[o["clave"]] + n <= _limite(o)
                ]
                if not otros:
                    continue
                en_ruta = [o for o in otros if par["cliente"] in orden_en_ruta[o["clave"]]]
                destino = min(
                    en_ruta or otros, key=lambda o: (ocupacion(o, n), carga[o["clave"]], o["clave"])
                )
                v["paradas"].remove(par)
                carga[v["clave"]] -= n
                peso = peso_de(par)
                if peso is not None:
                    kilos[v["clave"]] -= peso
                destino["paradas"].append(par)
                carga[destino["clave"]] += n
                if peso is not None:
                    kilos[destino["clave"]] += peso
                if not en_ruta:
                    par["fuera_de_ruta"] = True
                notas.append(
                    f"«{par['nombre']}» pasó de {v['nombre']} a {destino['nombre']}: "
                    f"{v['nombre']} quedaba por encima de su capacidad."
                )
                movido = True
                break
            if movido:
                break
        if not movido:
            break

    # 5. Dentro de cada vehículo, el orden de la ruta; lo que no está en ella,
    #    al final (el administrador lo acomoda donde le convenga).
    for v in vehiculos:
        indice = orden_en_ruta[v["clave"]]
        v["paradas"].sort(
            key=lambda p: (0, indice[p["cliente"]]) if p["cliente"] in indice else (1, -canastillas_de(p))
        )
    return notas


def calcular_distribucion(tenant, fecha, datos_pedidos: list[dict], tipo, previa: dict | None = None) -> dict:
    """
    El reparto de un conjunto de pedidos ya serializados (`pedido_json`).

    `previa` conserva lo que el administrador ya había fijado de los vehículos
    (punto inicial y final, paradas extraordinarias y vehículos agregados a
    mano): recalcular el reparto no borra decisiones que no son del motor.
    """
    dia = _vehiculos_del_dia(tenant, fecha, tipo)
    vehiculos = dia["vehiculos"]
    previa = previa or {}
    por_clave = {v.get("clave"): v for v in previa.get("vehiculos") or []}

    # Los vehículos que alguien agregó a mano siguen estando.
    for clave, guardado in por_clave.items():
        if clave in vehiculos or not guardado.get("furgon"):
            continue
        furgon = _furgon_json(tenant, guardado["furgon"])
        if furgon is None:
            continue
        vehiculos[clave] = {
            "clave": clave, "ruta_id": None, "ajuste_id": None, "origen": "manual",
            "nombre": guardado.get("nombre") or furgon["nombre"],
            "color": guardado.get("color") or COLORES[len(vehiculos) % len(COLORES)],
            "furgon": furgon, "capacidad": _capacidad_de(tenant, furgon, tipo),
            "ruta_paradas": [], "inicio": None, "fin": None, "paradas": [],
        }
    for clave, v in vehiculos.items():
        guardado = por_clave.get(clave) or {}
        v["inicio"] = _punto(guardado.get("inicio"))
        v["fin"] = _punto(guardado.get("fin"))
        v["extras"] = [
            _extra_limpia(p) for p in guardado.get("paradas") or [] if p.get("extra")
        ]

    lista = list(vehiculos.values())
    notas = distribuir(lista, _paradas_de(datos_pedidos))
    if not lista:
        return {
            "vehiculos": [],
            "sin_asignar": [d["id"] for d in datos_pedidos],
            "notas_motor": [f"No hay ninguna ruta programada para el {DIAS[fecha.weekday()].lower()}."],
            "calculado": timezone.now().isoformat(),
        }
    # Lo que el motor no pudo colocar (ningún vehículo con sitio) queda
    # explícitamente sin asignar: no se reparte para cuadrar el número.
    colocados = {d["id"] for v in lista for par in v["paradas"] for d in par["pedidos"]}
    return {
        "vehiculos": [_vehiculo_guardable(v) for v in lista],
        "sin_asignar": [d["id"] for d in datos_pedidos if d["id"] not in colocados],
        "notas_motor": notas,
        "calculado": timezone.now().isoformat(),
    }


def _furgon_json(tenant, furgon_id) -> dict | None:
    from .models import Furgon  # noqa: PLC0415

    f = Furgon.objects.filter(tenant=tenant, pk=furgon_id).first()
    if f is None:
        return None
    return {
        "id": f.id, "nombre": f.nombre, "placa": f.placa, "modelo_3d": f.modelo_3d,
        "carga_util_kg": f.carga_util_kg, "activo": f.activo,
    }


def _punto(valor) -> dict | None:
    """Un punto inicial o final de recorrido: nombre y dirección, nada más."""
    if not isinstance(valor, dict):
        return None
    nombre = str(valor.get("nombre") or "").strip()[:120]
    direccion = str(valor.get("direccion") or "").strip()[:300]
    if not nombre and not direccion:
        return None
    return {"nombre": nombre, "direccion": direccion}


def _extra_limpia(parada: dict) -> dict:
    nombre = str(parada.get("nombre") or "").strip()[:80]
    return {
        "extra": True,
        "pedidos": [],
        "cliente": None,
        "nombre": nombre or "Entrega extraordinaria",
        "direccion": str(parada.get("direccion") or "").strip()[:300],
        "nota": str(parada.get("nota") or "").strip()[:200],
        "canastillas": max(1, min(500, int(parada.get("canastillas") or 1))),
        "manual": True,
    }


def _vehiculo_guardable(v: dict) -> dict:
    """El vehículo tal como se guarda: solo el reparto, sin datos derivados."""
    paradas = [
        {
            "cliente": p["cliente"],
            "pedidos": [d["id"] for d in p["pedidos"]],
            "canastillas": canastillas_de(p),
            "manual": bool(p.get("manual")),
            "nota": p.get("nota", ""),
            "extra": False,
        }
        for p in v["paradas"]
    ]
    return {
        "clave": v["clave"],
        "furgon": v["furgon"]["id"] if v["furgon"] else None,
        "nombre": v["nombre"],
        "color": v["color"],
        "inicio": v.get("inicio"),
        "fin": v.get("fin"),
        "paradas": paradas + list(v.get("extras") or []),
    }


# ==========================================================================
# Crear
# ==========================================================================
def _siguiente_numero(tenant) -> int:
    ultimo = LoteDespacho.all_tenants.filter(tenant=tenant).order_by("-numero").values_list("numero", flat=True).first()
    return (ultimo or 0) + 1


@transaction.atomic
def crear(tenant, fecha: datetime.date, ids: list, tipo, usuario, nombre: str = "") -> LoteDespacho:
    """
    Reserva los pedidos en un lote nuevo y calcula su primer reparto.

    Falla —y no crea nada— si algún pedido ya está en otro lote vivo o en un
    despacho: es la garantía de que un pedido no se despacha dos veces.
    """
    if not isinstance(ids, list) or not ids:
        raise ValidationError("Elige al menos un pedido para el lote.")
    if any(not isinstance(i, int) or isinstance(i, bool) for i in ids):
        raise ValidationError("Los pedidos deben ser identificadores.")
    ids = list(dict.fromkeys(ids))
    if len(ids) > MAX_PEDIDOS:
        raise ValidationError(f"Un lote admite como máximo {MAX_PEDIDOS} pedidos.")

    pedidos = list(con_detalles(Pedido.objects.filter(tenant=tenant, id__in=ids)))
    faltan = set(ids) - {p.id for p in pedidos}
    if faltan:
        raise ValidationError(f"Hay pedidos que no existen: {sorted(faltan)}.")
    entregados = [p.id for p in pedidos if p.estado in ESTADOS_EXCLUIDOS]
    if entregados:
        raise ValidationError(f"El pedido #{entregados[0]} ya está entregado: no entra en un lote.")
    otra_fecha = [p.id for p in pedidos if fecha_de_entrega(p) != fecha]
    if otra_fecha:
        raise ValidationError(
            f"El pedido #{otra_fecha[0]} no se entrega el {fecha:%d/%m/%Y}: "
            "crea un lote por fecha de entrega."
        )
    ocupado = (
        PedidoLote.objects.filter(
            tenant=tenant, pedido_id__in=ids, activo=True, lote__estado__in=LoteDespacho.VIVOS
        )
        .select_related("lote")
        .first()
    )
    if ocupado:
        raise ValidationError(
            f"El pedido #{ocupado.pedido_id} ya está en el lote #{ocupado.lote.numero}."
        )
    en_despacho = PedidoDespacho.objects.filter(tenant=tenant, pedido_id__in=ids).select_related("plano").first()
    if en_despacho:
        raise ValidationError(
            f"El pedido #{en_despacho.pedido_id} ya está en el despacho «{en_despacho.plano.nombre}»."
        )

    lote = LoteDespacho.objects.create(
        tenant=tenant,
        numero=_siguiente_numero(tenant),
        nombre=str(nombre or "").strip()[:120],
        fecha=fecha,
        tipo_canastilla=tipo,
        creado_por=usuario,
    )
    PedidoLote.objects.bulk_create(
        [PedidoLote(tenant=tenant, lote=lote, pedido_id=pid) for pid in ids]
    )
    datos = [pedido_json(p) for p in pedidos]
    lote.distribucion = calcular_distribucion(tenant, fecha, datos, tipo)
    lote.save(update_fields=["distribucion", "actualizado"])
    anotar(
        lote, EventoLote.CREADO, f"Lote creado con {len(ids)} pedidos para el {fecha:%d/%m/%Y}.",
        usuario, {"pedidos": len(ids)},
    )
    anotar(
        lote, EventoLote.DISTRIBUIDO,
        f"Reparto automático entre {len([v for v in lote.distribucion['vehiculos'] if v['paradas']])} vehículos.",
        usuario, {"notas": lote.distribucion["notas_motor"]},
    )
    return lote


def anotar(lote: LoteDespacho, tipo: str, detalle: str, usuario=None, datos=None) -> EventoLote:
    return EventoLote.objects.create(
        tenant=lote.tenant, lote=lote, tipo=tipo, detalle=detalle[:300],
        usuario=usuario if (usuario and usuario.is_authenticated) else None, datos=datos or {},
    )


# ==========================================================================
# Hidratar: el lote con todo lo que la pantalla necesita
# ==========================================================================
def _metricas(v: dict) -> dict:
    canastillas = sum(canastillas_de(p) for p in v["paradas"])
    cap = v["capacidad"] or {}
    pesos = [peso_de(p) for p in v["paradas"] if not p.get("extra")]
    peso = round(sum(pesos), 1) if pesos and all(x is not None for x in pesos) else None
    limite = _limite(v)
    exceso = None
    if cap.get("canastillas") and canastillas > cap["canastillas"]:
        exceso = f"Sobrecapacidad: {canastillas} canastillas y caben {cap['canastillas']}."
    elif cap.get("tope_por_peso") and canastillas > cap["tope_por_peso"]:
        exceso = f"Supera la carga útil: el peso permite {cap['tope_por_peso']} canastillas."
    elif peso is not None and cap.get("carga_util_kg") and peso > cap["carga_util_kg"]:
        exceso = f"El peso de los productos ({peso:.0f} kg) supera la carga útil ({cap['carga_util_kg']} kg)."
    incompleta = None
    if not v["furgon"]:
        incompleta = "La ruta no tiene vehículo."
    elif not v["furgon"]["activo"]:
        incompleta = f"«{v['furgon']['nombre']}» está inactivo."
    elif cap.get("errores"):
        incompleta = cap["errores"][0]
    return {
        "canastillas": canastillas,
        "pedidos": sum(len(p["pedidos"]) for p in v["paradas"]),
        "paradas": len(v["paradas"]),
        "capacidad": cap.get("canastillas"),
        "tope": cap.get("tope_por_peso"),
        "peso_kg": peso,
        "carga_util_kg": cap.get("carga_util_kg"),
        "pct": round(canastillas / limite * 100) if limite not in (0, math.inf) else 0,
        "exceso": exceso,
        "incompleta": incompleta,
    }


def hidratar(lote: LoteDespacho) -> dict:
    """
    El lote completo para la pantalla: vehículos con sus paradas, los productos
    consolidados de cada parada, capacidades, pedidos sin asignar, despachos y
    bitácora. Los pedidos se leen ahora; el reparto, de `distribucion`.
    """
    tenant = lote.tenant
    tipo = lote.tipo_canastilla
    filas = list(lote.pedidos.filter(activo=True).values_list("pedido_id", flat=True))
    pedidos = {p.id: p for p in con_detalles(Pedido.objects.filter(tenant=tenant, id__in=filas))}
    datos = {pid: pedido_json(p) for pid, p in pedidos.items()}

    dia = _vehiculos_del_dia(tenant, lote.fecha, tipo)
    vehiculos = dia["vehiculos"]
    guardado = lote.distribucion or {}
    asignados: set[int] = set()

    for gv in guardado.get("vehiculos") or []:
        clave = gv.get("clave")
        if not clave:
            continue
        v = vehiculos.get(clave)
        if v is None:
            furgon = _furgon_json(tenant, gv.get("furgon"))
            if furgon is None:
                continue
            v = vehiculos[clave] = {
                "clave": clave, "ruta_id": None, "ajuste_id": None,
                "origen": "manual" if clave.startswith("f") else "despacho",
                "nombre": gv.get("nombre") or furgon["nombre"],
                "color": gv.get("color") or COLORES[len(vehiculos) % len(COLORES)],
                "furgon": furgon, "capacidad": _capacidad_de(tenant, furgon, tipo),
                "ruta_paradas": [], "inicio": None, "fin": None, "paradas": [],
            }
        if gv.get("nombre"):
            v["nombre"] = gv["nombre"]
        v["inicio"] = _punto(gv.get("inicio"))
        v["fin"] = _punto(gv.get("fin"))
        orden_ruta = {p["cliente_id"]: i for i, p in enumerate(v["ruta_paradas"])}
        for gp in gv.get("paradas") or []:
            if gp.get("extra"):
                v["paradas"].append({**_extra_limpia(gp), "pedidos": [], "key": f"x{len(v['paradas'])}"})
                continue
            suyos = [datos[pid] for pid in gp.get("pedidos") or [] if pid in datos and pid not in asignados]
            if not suyos:
                continue
            asignados.update(d["id"] for d in suyos)
            cliente = suyos[0]["cliente_id"]
            v["paradas"].append({
                "key": f"c{cliente}" if cliente is not None else f"p{suyos[0]['id']}",
                "cliente": cliente,
                "nombre": suyos[0]["cliente_nombre"],
                "direccion": suyos[0]["direccion"],
                "telefono": suyos[0]["telefono"],
                "pedidos": suyos,
                "manual": bool(gp.get("manual")),
                "canastillas": gp.get("canastillas") or 1,
                "nota": str(gp.get("nota") or "")[:200],
                "extra": False,
                "fuera_de_ruta": cliente not in orden_ruta,
            })

    # Los despachos ya generados, por vehículo.
    planos = list(
        PlanoCarga.objects.filter(tenant=tenant, lote=lote).select_related("furgon", "tipo_canastilla")
    )
    despacho_de = {clave_de_plano(p): p for p in planos}

    salida_vehiculos = []
    for v in vehiculos.values():
        plano = despacho_de.get(v["clave"])
        con_pedido = {p["cliente"] for p in v["paradas"]}
        for i, par in enumerate(v["paradas"]):
            par["orden"] = i + 1
            par["productos"] = [] if par["extra"] else consolidar_desde_json(par["pedidos"])
            par["canastillas_calculadas"] = canastillas_de(par)
            par["peso_kg"] = None if par["extra"] else peso_de(par)
            par["sin_regla"] = sorted({n for p in par["pedidos"] for n in p["sin_regla"]})
            par["en_ruta"] = not par["extra"] and par["cliente"] in {
                rp["cliente_id"] for rp in v["ruta_paradas"]
            }
            par["nota_ruta"] = next(
                (rp["nota"] for rp in v["ruta_paradas"] if rp["cliente_id"] == par["cliente"]), ""
            )
        salida_vehiculos.append({
            **{k: v[k] for k in ("clave", "ruta_id", "ajuste_id", "origen", "nombre", "color", "furgon", "capacidad", "ruta_paradas", "inicio", "fin")},
            "paradas": v["paradas"],
            "paradas_sin_pedido": [rp for rp in v["ruta_paradas"] if rp["cliente_id"] not in con_pedido],
            "metricas": _metricas(v),
            "despacho": _despacho_json(plano) if plano else None,
        })

    sin_asignar = [
        {**d, "motivo": _motivo_sin_asignar(d, salida_vehiculos, lote.fecha)}
        for pid, d in datos.items()
        if pid not in asignados
    ]
    vista = {
        "id": lote.id,
        "numero": lote.numero,
        "nombre": lote.nombre,
        "fecha": lote.fecha.isoformat(),
        "dia_nombre": DIAS[lote.fecha.weekday()],
        "estado": lote.estado,
        "estado_etiqueta": lote.get_estado_display(),
        "abierto": lote.abierto,
        "notas": lote.notas,
        "programacion": dia["programacion"],
        "rutas_canceladas": dia["canceladas"],
        "tipo_canastilla": {
            "id": tipo.id, "nombre": tipo.nombre,
            "peso_lleno_kg": float(tipo.peso_lleno_kg) if tipo.peso_lleno_kg else None,
        },
        "vehiculos": salida_vehiculos,
        "sin_asignar": sin_asignar,
        "notas_motor": guardado.get("notas_motor") or [],
        "despachos": [_despacho_json(p) for p in planos],
        "creado_por": getattr(lote.creado_por, "nombre_usuario", "") or "",
        "confirmado_por": getattr(lote.confirmado_por, "nombre_usuario", "") or "",
        "confirmado_en": lote.confirmado_en.isoformat() if lote.confirmado_en else None,
        "creado": lote.creado.isoformat(),
        "actualizado": lote.actualizado.isoformat(),
    }
    vista["resumen"] = _resumen(lote, vista)
    return vista


def _motivo_sin_asignar(pedido: dict, vehiculos: list[dict], fecha) -> str:
    if pedido["cliente_id"] is None:
        return "El pedido no tiene cliente: asígnalo a un vehículo a mano."
    en_ruta = [v["nombre"] for v in vehiculos if any(rp["cliente_id"] == pedido["cliente_id"] for rp in v["ruta_paradas"])]
    if not en_ruta:
        return f"El cliente no está en ninguna ruta del {DIAS[fecha.weekday()].lower()}."
    return f"Se retiró del reparto. Su ruta habitual es {', '.join(en_ruta)}."


# ==========================================================================
# Guardar las correcciones del administrador
# ==========================================================================
@transaction.atomic
def guardar_distribucion(lote: LoteDespacho, datos, usuario) -> LoteDespacho:
    """
    Valida y guarda el reparto corregido a mano, y anota qué cambió.

    Se valida contra los pedidos del lote: no se pueden colar pedidos de otro
    día ni repetir uno en dos paradas. Lo que no aparece en ningún vehículo
    queda explícitamente sin asignar.
    """
    if not lote.abierto:
        raise ValidationError("El lote ya está confirmado: reábrelo para cambiar el reparto.")
    if not isinstance(datos, dict):
        raise ValidationError("Envía el reparto como objeto.")
    entrada = datos.get("vehiculos")
    if not isinstance(entrada, list):
        raise ValidationError("«vehiculos» debe ser una lista.")
    if len(entrada) > MAX_VEHICULOS:
        raise ValidationError(f"Un lote admite como máximo {MAX_VEHICULOS} vehículos.")

    tenant = lote.tenant
    delote = set(lote.pedidos.filter(activo=True).values_list("pedido_id", flat=True))
    clientes = dict(
        Pedido.objects.filter(tenant=tenant, id__in=delote).values_list("id", "cliente_id")
    )
    vistos_pedidos, vistas_claves, vistos_furgones = set(), set(), set()
    vehiculos = []
    for v in entrada:
        if not isinstance(v, dict):
            raise ValidationError("Cada vehículo debe ser un objeto.")
        clave = str(v.get("clave") or "").strip()[:20]
        if not clave or clave in vistas_claves:
            raise ValidationError("Cada vehículo necesita una clave única.")
        vistas_claves.add(clave)
        furgon = _furgon_json(tenant, v.get("furgon"))
        if furgon is None:
            raise ValidationError(f"El vehículo de «{v.get('nombre') or clave}» no existe.")
        if furgon["id"] in vistos_furgones:
            raise ValidationError(f"«{furgon['nombre']}» está en dos rutas el mismo día.")
        vistos_furgones.add(furgon["id"])
        paradas = v.get("paradas")
        if not isinstance(paradas, list):
            raise ValidationError(f"Las paradas de «{furgon['nombre']}» deben ser una lista.")
        if len(paradas) > MAX_PARADAS:
            raise ValidationError(f"Un vehículo admite como máximo {MAX_PARADAS} paradas.")
        limpias = []
        for par in paradas:
            if not isinstance(par, dict):
                raise ValidationError("Cada parada debe ser un objeto.")
            if par.get("extra"):
                limpias.append(_extra_limpia(par))
                continue
            ids = par.get("pedidos")
            if not isinstance(ids, list) or not ids:
                raise ValidationError("Una parada de cliente necesita al menos un pedido.")
            cliente = par.get("cliente")
            if cliente is not None and (not isinstance(cliente, int) or isinstance(cliente, bool)):
                raise ValidationError("El cliente de la parada es inválido.")
            for pid in ids:
                if pid not in delote:
                    raise ValidationError(f"El pedido #{pid} no es de este lote.")
                if pid in vistos_pedidos:
                    raise ValidationError(f"El pedido #{pid} está en dos paradas.")
                if clientes.get(pid) is not None and clientes[pid] != cliente:
                    raise ValidationError(f"El pedido #{pid} es de otro cliente que el de su parada.")
                vistos_pedidos.add(pid)
            canastillas = par.get("canastillas")
            if not isinstance(canastillas, int) or isinstance(canastillas, bool) or not 1 <= canastillas <= 500:
                raise ValidationError("Las canastillas de una parada van de 1 a 500.")
            limpias.append({
                "cliente": cliente,
                "pedidos": list(dict.fromkeys(ids)),
                "canastillas": canastillas,
                "manual": bool(par.get("manual")),
                "nota": str(par.get("nota") or "").strip()[:200],
                "extra": False,
            })
        vehiculos.append({
            "clave": clave,
            "furgon": furgon["id"],
            "nombre": str(v.get("nombre") or furgon["nombre"]).strip()[:120],
            "color": v.get("color") if isinstance(v.get("color"), str) and len(v["color"]) == 7 else COLORES[len(vehiculos) % len(COLORES)],
            "inicio": _punto(v.get("inicio")),
            "fin": _punto(v.get("fin")),
            "paradas": limpias,
        })

    antes = lote.distribucion or {}
    nueva = {
        "vehiculos": vehiculos,
        "sin_asignar": sorted(delote - vistos_pedidos),
        "notas_motor": antes.get("notas_motor") or [],
        "calculado": antes.get("calculado"),
        "ajustado": timezone.now().isoformat(),
    }
    lote.distribucion = nueva
    lote.save(update_fields=["distribucion", "actualizado"])
    cambios = _diferencias(antes, nueva)
    if cambios:
        anotar(lote, EventoLote.AJUSTE, "; ".join(cambios)[:300], usuario, {"cambios": cambios})
    return lote


def _vehiculo_de_pedido(distribucion: dict) -> dict:
    return {
        pid: v.get("nombre") or v.get("clave")
        for v in distribucion.get("vehiculos") or []
        for par in v.get("paradas") or []
        for pid in par.get("pedidos") or []
    }


def _diferencias(antes: dict, despues: dict) -> list[str]:
    """Qué cambió entre dos repartos, en el lenguaje del operador."""
    a, b = _vehiculo_de_pedido(antes), _vehiculo_de_pedido(despues)
    cambios = []
    for pid, destino in b.items():
        origen = a.get(pid)
        if origen is None:
            cambios.append(f"#{pid} entró a {destino}")
        elif origen != destino:
            cambios.append(f"#{pid} pasó de {origen} a {destino}")
    for pid, origen in a.items():
        if pid not in b:
            cambios.append(f"#{pid} salió de {origen}")
    extras_a = sum(1 for v in antes.get("vehiculos") or [] for p in v.get("paradas") or [] if p.get("extra"))
    extras_b = sum(1 for v in despues.get("vehiculos") or [] for p in v.get("paradas") or [] if p.get("extra"))
    if extras_b != extras_a:
        cambios.append(f"entregas extraordinarias: {extras_a} → {extras_b}")
    orden_a = [(v["clave"], [p.get("pedidos") or p.get("nombre") for p in v.get("paradas") or []]) for v in antes.get("vehiculos") or []]
    orden_b = [(v["clave"], [p.get("pedidos") or p.get("nombre") for p in v.get("paradas") or []]) for v in despues.get("vehiculos") or []]
    if not cambios and orden_a != orden_b:
        cambios.append("se cambió el orden de las paradas")
    puntos_a = {v["clave"]: (v.get("inicio"), v.get("fin")) for v in antes.get("vehiculos") or []}
    puntos_b = {v["clave"]: (v.get("inicio"), v.get("fin")) for v in despues.get("vehiculos") or []}
    if puntos_a != puntos_b:
        cambios.append("se cambió el punto inicial o final de un recorrido")
    return cambios


@transaction.atomic
def redistribuir(lote: LoteDespacho, usuario) -> LoteDespacho:
    """Vuelve a calcular el reparto automático conservando lo que no es del motor."""
    if not lote.abierto:
        raise ValidationError("El lote ya está confirmado: reábrelo para redistribuir.")
    ids = list(lote.pedidos.filter(activo=True).values_list("pedido_id", flat=True))
    pedidos = con_detalles(Pedido.objects.filter(tenant=lote.tenant, id__in=ids))
    datos = [pedido_json(p) for p in pedidos]
    lote.distribucion = calcular_distribucion(
        lote.tenant, lote.fecha, datos, lote.tipo_canastilla, previa=lote.distribucion
    )
    lote.save(update_fields=["distribucion", "actualizado"])
    anotar(
        lote, EventoLote.DISTRIBUIDO, "Se volvió a calcular el reparto automático.", usuario,
        {"notas": lote.distribucion["notas_motor"]},
    )
    return lote


@transaction.atomic
def quitar_pedidos(lote: LoteDespacho, ids: list, usuario) -> LoteDespacho:
    """Saca pedidos del lote: vuelven a quedar pendientes de planificación."""
    if not lote.abierto:
        raise ValidationError("El lote ya está confirmado: reábrelo para cambiar sus pedidos.")
    ids = [i for i in (ids or []) if isinstance(i, int) and not isinstance(i, bool)]
    if not ids:
        raise ValidationError("Indica qué pedidos quitar.")
    filas = lote.pedidos.filter(pedido_id__in=ids, activo=True)
    quitados = list(filas.values_list("pedido_id", flat=True))
    if not quitados:
        raise ValidationError("Esos pedidos no están en el lote.")
    # Si ya había plano de carga, el destino que se queda sin pedidos se
    # retira de él (y sus canastillas bajan): un despacho no puede quedar con
    # una parada fantasma que luego saldría impresa en la guía.
    asignaciones = PedidoDespacho.objects.filter(
        tenant=lote.tenant, pedido_id__in=quitados, plano__lote=lote
    ).select_related("plano", "plano__furgon", "plano__tipo_canastilla")
    tocados = {a.plano for a in asignaciones}
    asignaciones.delete()
    filas.delete()
    for plano in tocados:
        if plano.estado == PlanoCarga.BORRADOR:
            _limpiar(plano)
    dist = lote.distribucion or {}
    for v in dist.get("vehiculos") or []:
        for par in v.get("paradas") or []:
            par["pedidos"] = [p for p in par.get("pedidos") or [] if p not in quitados]
        v["paradas"] = [p for p in v.get("paradas") or [] if p.get("extra") or p["pedidos"]]
    dist["sin_asignar"] = [p for p in dist.get("sin_asignar") or [] if p not in quitados]
    lote.distribucion = dist
    lote.save(update_fields=["distribucion", "actualizado"])
    anotar(
        lote, EventoLote.AJUSTE,
        f"Se quitaron del lote {len(quitados)} pedidos: {', '.join(f'#{p}' for p in quitados[:12])}.",
        usuario, {"pedidos": quitados},
    )
    return lote


@transaction.atomic
def agregar_pedidos(lote: LoteDespacho, ids: list, usuario) -> LoteDespacho:
    """Mete pedidos más al lote (los que llegaron después de crearlo)."""
    if not lote.abierto:
        raise ValidationError("El lote ya está confirmado: reábrelo para cambiar sus pedidos.")
    ids = [i for i in (ids or []) if isinstance(i, int) and not isinstance(i, bool)]
    if not ids:
        raise ValidationError("Indica qué pedidos agregar.")
    disponibles = {p.id: p for p in pedidos_sin_planificar(lote.tenant).filter(id__in=ids)}
    faltan = [i for i in ids if i not in disponibles]
    if faltan:
        raise ValidationError(f"El pedido #{faltan[0]} ya está en otro lote o despacho.")
    otra_fecha = [p.id for p in disponibles.values() if fecha_de_entrega(p) != lote.fecha]
    if otra_fecha:
        raise ValidationError(f"El pedido #{otra_fecha[0]} no se entrega el {lote.fecha:%d/%m/%Y}.")
    if lote.pedidos.filter(activo=True).count() + len(disponibles) > MAX_PEDIDOS:
        raise ValidationError(f"Un lote admite como máximo {MAX_PEDIDOS} pedidos.")
    PedidoLote.objects.bulk_create(
        [PedidoLote(tenant=lote.tenant, lote=lote, pedido_id=pid) for pid in disponibles]
    )
    dist = lote.distribucion or {}
    dist["sin_asignar"] = sorted({*(dist.get("sin_asignar") or []), *disponibles})
    lote.distribucion = dist
    lote.save(update_fields=["distribucion", "actualizado"])
    anotar(
        lote, EventoLote.AJUSTE,
        f"Se agregaron al lote {len(disponibles)} pedidos: {', '.join(f'#{p}' for p in sorted(disponibles)[:12])}.",
        usuario, {"pedidos": sorted(disponibles)},
    )
    return lote


# ==========================================================================
# Generar los despachos (el puente con el constructor 3D)
# ==========================================================================
@transaction.atomic
def generar(lote: LoteDespacho, usuario, contexto: dict) -> list[PlanoCarga]:
    """
    Un `PlanoCarga` en borrador por vehículo con carga, con su acomodo
    automático, listo para abrirse en el constructor 3D.
    """
    if not lote.abierto:
        raise ValidationError("El lote ya está confirmado: reábrelo para volver a generar.")
    dist = lote.distribucion or {}
    conductores = [v for v in dist.get("vehiculos") or [] if v.get("paradas")]
    if not conductores:
        raise ValidationError("Ningún vehículo tiene paradas: reparte los pedidos antes de generar.")
    vehiculos = [
        {
            "clave": v["clave"],
            "furgon": v["furgon"],
            "nombre": v["nombre"],
            "inicio": v.get("inicio"),
            "fin": v.get("fin"),
            "paradas": [
                {
                    "cliente": par.get("cliente"),
                    "pedidos": par.get("pedidos") or [],
                    "canastillas": par.get("canastillas") or 1,
                    "nombre": par.get("nombre", ""),
                    "direccion": par.get("direccion", ""),
                    "nota": par.get("nota", ""),
                }
                for par in v["paradas"]
            ],
        }
        for v in conductores
    ]
    planos = generar_despachos(
        lote.tenant, lote.fecha, lote.tipo_canastilla, vehiculos, usuario, contexto,
        liberar=dist.get("sin_asignar") or [], lote=lote,
    )
    if lote.estado == LoteDespacho.PREPARACION:
        lote.estado = LoteDespacho.PREPARADO
        lote.save(update_fields=["estado", "actualizado"])
    anotar(
        lote, EventoLote.GENERADO,
        f"Se generaron {len(planos)} despachos con su plano de carga.", usuario,
        {"despachos": [p.id for p in planos]},
    )
    return planos


# ==========================================================================
# Resumen, confirmación y estados
# ==========================================================================
def _resumen(lote: LoteDespacho, vista: dict) -> dict:
    """
    Lo que se revisa antes de confirmar: qué se despacha, en qué va, qué queda
    fuera y qué impide cerrar.
    """
    vehiculos = vista["vehiculos"]
    con_carga = [v for v in vehiculos if v["paradas"]]
    errores, advertencias = [], []
    if not con_carga:
        errores.append("Ningún vehículo tiene paradas asignadas.")
    for v in con_carga:
        m = v["metricas"]
        if m["incompleta"]:
            errores.append(f"{v['nombre']}: {m['incompleta']}")
        if m["exceso"]:
            errores.append(f"{v['nombre']}: {m['exceso']}")
        if not v["despacho"]:
            advertencias.append(f"{v['nombre']} todavía no tiene plano de carga: genera los despachos.")
        else:
            for e in v["despacho"]["errores"]:
                errores.append(f"{v['nombre']}: {e}")
        sin_regla = sorted({n for par in v["paradas"] for n in par.get("sin_regla") or []})
        if sin_regla:
            advertencias.append(
                f"{v['nombre']}: sin regla de carga para {', '.join(sin_regla[:4])}"
                f"{'…' if len(sin_regla) > 4 else ''}. Revisa sus canastillas."
            )
        fuera = [par["nombre"] for par in v["paradas"] if par.get("fuera_de_ruta")]
        if fuera:
            advertencias.append(f"{v['nombre']} lleva paradas fuera de su ruta: {', '.join(fuera[:4])}.")
    if vista["sin_asignar"]:
        advertencias.append(
            f"{len(vista['sin_asignar'])} pedidos quedan sin vehículo: no se despachan con este lote."
        )
    return {
        "pedidos_total": sum(len(par["pedidos"]) for v in vehiculos for par in v["paradas"]) + len(vista["sin_asignar"]),
        "pedidos_asignados": sum(len(par["pedidos"]) for v in vehiculos for par in v["paradas"]),
        "pedidos_sin_asignar": len(vista["sin_asignar"]),
        "clientes": len({par["cliente"] for v in vehiculos for par in v["paradas"] if par["cliente"]}),
        "vehiculos": len(con_carga),
        "vehiculos_disponibles": len(vehiculos),
        "paradas": sum(len(v["paradas"]) for v in vehiculos),
        "paradas_extra": sum(1 for v in vehiculos for par in v["paradas"] if par.get("extra")),
        "canastillas": sum(v["metricas"]["canastillas"] for v in vehiculos),
        "capacidad": sum(v["metricas"]["capacidad"] or 0 for v in con_carga),
        "peso_kg": round(sum(v["metricas"]["peso_kg"] or 0 for v in con_carga), 1) or None,
        "despachos": len([v for v in con_carga if v["despacho"]]),
        "despachos_confirmados": len([v for v in con_carga if v["despacho"] and v["despacho"]["estado"] == PlanoCarga.CONFIRMADO]),
        "errores": errores,
        "advertencias": advertencias,
        "puede_confirmar": not errores and bool(con_carga) and all(v["despacho"] for v in con_carga),
    }


def resumen(lote: LoteDespacho) -> dict:
    return hidratar(lote)["resumen"]


@transaction.atomic
def confirmar(lote: LoteDespacho, usuario) -> dict:
    """
    Confirma el lote y todos sus despachos: su geometría y sus datos
    operativos quedan congelados, y los pedidos pasan a «confirmado».
    """
    if lote.estado not in LoteDespacho.ABIERTOS:
        raise ValidationError("El lote ya está confirmado.")
    vista = hidratar(lote)
    if not vista["resumen"]["puede_confirmar"]:
        raise ValidationError(
            vista["resumen"]["errores"][0] if vista["resumen"]["errores"]
            else "Genera los despachos de todos los vehículos antes de confirmar."
        )
    planos = PlanoCarga.objects.select_for_update().filter(
        tenant=lote.tenant, lote=lote
    ).select_related("furgon", "tipo_canastilla")
    for plano in planos:
        if plano.estado == PlanoCarga.CONFIRMADO:
            continue
        rev = confirmar_despacho(plano, usuario)
        if rev["errores"]:
            raise ValidationError(f"«{plano.nombre}»: {rev['errores'][0]}")
    lote.estado = LoteDespacho.CONFIRMADO
    lote.confirmado_por = usuario if (usuario and usuario.is_authenticated) else None
    lote.confirmado_en = timezone.now()
    lote.resumen = vista["resumen"]
    lote.save(update_fields=["estado", "confirmado_por", "confirmado_en", "resumen", "actualizado"])
    anotar(
        lote, EventoLote.CONFIRMADO,
        f"Lote confirmado: {vista['resumen']['pedidos_asignados']} pedidos en "
        f"{vista['resumen']['vehiculos']} vehículos.",
        usuario, {"resumen": vista["resumen"]},
    )
    return hidratar(lote)


#: A qué estado puede pasar un lote desde cada estado.
TRANSICIONES = {
    LoteDespacho.PREPARACION: (LoteDespacho.ANULADO,),
    LoteDespacho.PREPARADO: (LoteDespacho.ANULADO,),
    LoteDespacho.CONFIRMADO: (LoteDespacho.EN_RUTA, LoteDespacho.PREPARADO),
    LoteDespacho.EN_RUTA: (LoteDespacho.ENTREGADO, LoteDespacho.CONFIRMADO),
    LoteDespacho.ENTREGADO: (),
    LoteDespacho.ANULADO: (),
}


@transaction.atomic
def cambiar_estado(lote: LoteDespacho, nuevo: str, usuario) -> LoteDespacho:
    """
    Mueve el lote al siguiente punto de la jornada (o lo devuelve al anterior).

    Volver de CONFIRMADO a PREPARADO es «reabrir»: los despachos vuelven a
    borrador para corregirlos. Marcar ENTREGADO cierra el día y marca como
    entregados los pedidos que todavía no lo estén.
    """
    if nuevo not in TRANSICIONES.get(lote.estado, ()):
        raise ValidationError(
            f"Un lote {lote.get_estado_display().lower()} no puede pasar a «{nuevo.lower()}»."
        )
    anterior = lote.estado
    if nuevo == LoteDespacho.PREPARADO:
        PlanoCarga.objects.filter(tenant=lote.tenant, lote=lote).update(
            estado=PlanoCarga.BORRADOR, confirmado_por=None, confirmado_en=None
        )
        lote.confirmado_por = None
        lote.confirmado_en = None
    if nuevo == LoteDespacho.ENTREGADO:
        ids = list(lote.pedidos.filter(activo=True).values_list("pedido_id", flat=True))
        Pedido.objects.filter(tenant=lote.tenant, id__in=ids).exclude(estado="ENTREGADO").update(
            estado="ENTREGADO"
        )
    lote.estado = nuevo
    lote.save(update_fields=["estado", "confirmado_por", "confirmado_en", "actualizado"])
    anotar(
        lote, EventoLote.ESTADO,
        f"{lote.get_estado_display()} (antes: {dict(LoteDespacho.ESTADOS)[anterior].lower()}).",
        usuario, {"de": anterior, "a": nuevo},
    )
    return lote


@transaction.atomic
def anular(lote: LoteDespacho, usuario, motivo: str = "") -> LoteDespacho:
    """
    Descarta el lote. Sus pedidos vuelven a quedar pendientes de planificación
    y sus despachos en borrador se eliminan; la bitácora se conserva.
    """
    if lote.estado in (LoteDespacho.ANULADO, LoteDespacho.ENTREGADO):
        raise ValidationError("El lote ya está cerrado.")
    if lote.estado in (LoteDespacho.CONFIRMADO, LoteDespacho.EN_RUTA):
        raise ValidationError("El lote está confirmado: reábrelo antes de anularlo.")
    PlanoCarga.objects.filter(tenant=lote.tenant, lote=lote, estado=PlanoCarga.BORRADOR).delete()
    lote.pedidos.update(activo=False)
    lote.estado = LoteDespacho.ANULADO
    lote.notas = (f"{lote.notas}\nAnulado: {motivo}".strip() if motivo else lote.notas)[:2000]
    lote.save(update_fields=["estado", "notas", "actualizado"])
    anotar(lote, EventoLote.ANULADO, (motivo or "Lote anulado.")[:300], usuario)
    return lote


# ==========================================================================
# Listado
# ==========================================================================
def lista(tenant, fecha: datetime.date | None = None, estados=()) -> list[dict]:
    qs = LoteDespacho.objects.filter(tenant=tenant).select_related("tipo_canastilla", "creado_por")
    if fecha:
        qs = qs.filter(fecha=fecha)
    if estados:
        qs = qs.filter(estado__in=estados)
    salida = []
    conteos = {}
    for lote_id in PedidoLote.objects.filter(tenant=tenant, activo=True).values_list("lote_id", flat=True):
        conteos[lote_id] = conteos.get(lote_id, 0) + 1
    planos = {}
    for p in PlanoCarga.objects.filter(tenant=tenant, lote__isnull=False).values_list("lote_id", "estado"):
        d = planos.setdefault(p[0], {"total": 0, "confirmados": 0})
        d["total"] += 1
        d["confirmados"] += 1 if p[1] == PlanoCarga.CONFIRMADO else 0
    for lote in qs:
        dist = lote.distribucion or {}
        d = planos.get(lote.id, {"total": 0, "confirmados": 0})
        salida.append({
            "id": lote.id,
            "numero": lote.numero,
            "nombre": lote.nombre,
            "fecha": lote.fecha.isoformat(),
            "estado": lote.estado,
            "estado_etiqueta": lote.get_estado_display(),
            "pedidos": conteos.get(lote.id, 0),
            "vehiculos": len([v for v in dist.get("vehiculos") or [] if v.get("paradas")]),
            "canastillas": sum(
                par.get("canastillas") or 0
                for v in dist.get("vehiculos") or []
                for par in v.get("paradas") or []
            ),
            "despachos": d["total"],
            "despachos_confirmados": d["confirmados"],
            "tipo_canastilla": lote.tipo_canastilla_id,
            "creado_por": getattr(lote.creado_por, "nombre_usuario", "") or "",
            "creado": lote.creado.isoformat(),
            "actualizado": lote.actualizado.isoformat(),
        })
    return salida


def eventos(lote: LoteDespacho) -> list[dict]:
    return [
        {
            "id": e.id,
            "tipo": e.tipo,
            "tipo_etiqueta": e.get_tipo_display(),
            "detalle": e.detalle,
            "datos": e.datos,
            "usuario": getattr(e.usuario, "nombre_usuario", "") or "Sistema",
            "cuando": e.cuando.isoformat(),
        }
        for e in lote.eventos.select_related("usuario")[:200]
    ]
