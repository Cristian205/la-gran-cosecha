"""
En qué punto va un pedido, contado al CLIENTE en seis pasos.

    Recibido → En revisión → Confirmado → En preparación → Despachado → Entregado

No es una columna nueva: se traduce de los dos estados que el sistema ya
deduce de hechos registrados (ver `estado_comercial.py` y
`apps.logistica.lotes.estados_logisticos`). Así la tienda y el panel nunca
cuentan dos historias distintas del mismo pedido, y lo que cambia el panel
—aprobar un producto, generar la factura, armar el lote, salir a ruta,
entregar— se ve en la tienda sin que nadie lo marque dos veces.

La traducción, del paso más avanzado al menos:

    Entregado       el pedido (o su lote) se marcó entregado.
    Despachado      su lote salió a ruta.
    En preparación  está en un lote de despacho o en un plano de carga.
    Confirmado      el negocio generó su factura (o, en pedidos del sistema
                    anterior, lo cerró).
    En revisión     trae productos escritos a mano que nadie ha aprobado
                    todavía (o, en el sistema anterior, se ajustó).
    Recibido        todo lo demás: llegó y nadie lo ha tocado aún.

Un pedido que solo se recibió se queda en «Recibido»: nunca se adelanta un
paso que no tiene un hecho detrás. Que un pedido salte, por ejemplo, de
«Recibido» a «En preparación» sin factura es real —hay negocios que no
facturan antes de despachar— y la tienda lo muestra con los pasos anteriores
completos, porque meterlo en un lote ya es haberlo aceptado.

Solo se expone el paso, nunca el detalle interno (número de lote, vehículo,
quién lo tocó): esto se lee desde la tienda pública.
"""
from . import estado_comercial as comercial

RECIBIDO = "RECIBIDO"
EN_REVISION = "EN_REVISION"
CONFIRMADO = "CONFIRMADO"
EN_PREPARACION = "EN_PREPARACION"
DESPACHADO = "DESPACHADO"
ENTREGADO = "ENTREGADO"

PASOS = [
    (RECIBIDO, "Recibido"),
    (EN_REVISION, "En revisión"),
    (CONFIRMADO, "Confirmado"),
    (EN_PREPARACION, "En preparación"),
    (DESPACHADO, "Despachado"),
    (ENTREGADO, "Entregado"),
]
_INDICE = {clave: i for i, (clave, _) in enumerate(PASOS)}

#: Estados logísticos (`apps.logistica.lotes`) que ya son trabajo de despacho.
_LOGISTICA_EN_PREPARACION = {"EN_LOTE", "PREPARADO", "CONFIRMADO"}


def paso_del_pedido(crudo: str, estado_comercial: str | None, estado_logistico: str | None) -> str:
    """La clave del paso, a partir de lo que ya se sabe del pedido."""
    if crudo == "ENTREGADO" or estado_logistico == "ENTREGADO":
        return ENTREGADO
    if estado_logistico == "EN_RUTA":
        return DESPACHADO
    if estado_logistico in _LOGISTICA_EN_PREPARACION:
        return EN_PREPARACION
    if estado_comercial in (comercial.IMPRESO, comercial.CERRADO):
        return CONFIRMADO
    if estado_comercial in (comercial.POR_REVISAR, comercial.EDITADO):
        return EN_REVISION
    return RECIBIDO


def _estados_logisticos(tenant, ids) -> dict:
    """Los de despacho, solo si el negocio tiene el módulo (es opcional)."""
    from apps.business.aplicar import modulos_activos  # noqa: PLC0415

    if "plano-carga" not in modulos_activos(tenant):
        return {}
    from apps.logistica.lotes import estados_logisticos  # noqa: PLC0415 — módulo opcional

    return estados_logisticos(tenant, ids)


def seguimiento_de_pedidos(tenant, crudos: dict) -> dict:
    """
    `{pedido_id: {"paso", "clave", "etiqueta"}}` para la tienda pública.

    `crudos` es `{pedido_id: Pedido.estado}`. Pocas consultas para todos los
    pedidos a la vez, no unas por pedido.
    """
    if not crudos:
        return {}
    comerciales = comercial.estados_comerciales(tenant, crudos)
    logisticos = _estados_logisticos(tenant, list(crudos))
    salida = {}
    for pid, crudo in crudos.items():
        clave = paso_del_pedido(
            crudo,
            (comerciales.get(pid) or {}).get("estado"),
            (logisticos.get(pid) or {}).get("estado"),
        )
        indice = _INDICE[clave]
        salida[pid] = {"paso": indice, "clave": clave, "etiqueta": PASOS[indice][1]}
    return salida
