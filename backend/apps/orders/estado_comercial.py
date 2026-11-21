"""
En qué punto va el PEDIDO como documento, antes de salir a la calle.

Es la otra mitad de la pareja: `apps.logistica.lotes.estados_logisticos` dice
dónde va la CARGA (pendiente de planificación, en un lote, en ruta,
entregado) y esto dice qué pasó con el pedido mismo:

    POR_REVISAR  trae productos escritos a mano que nadie ha aprobado todavía;
                 hasta que se revisen, su precio y su unidad no son definitivos.
    RECIBIDO     llegó y está completo: nada pendiente, nada impreso aún.
    IMPRESO      ya se generó su factura.

# Por qué se deduce y no se guarda en una columna

`Pedido.estado` declara cinco valores desde el sistema anterior, pero hoy solo
se escriben dos: `PENDIENTE` al crearse y `ENTREGADO` al entregar. `EDITADO`,
`CERRADO` e `IMPRESO` quedaron sin dueño: ningún código los asigna, así que la
columna de la tabla decía «Pendiente» en casi todo.

Los hechos que faltaban, en cambio, YA están registrados: `EventoPedido`
anota la factura cuando se genera y `DetallePedido.estado_revision` dice si un
producto sugerido sigue sin aprobar. Deducir el estado de ahí tiene dos
ventajas sobre empezar a escribir una columna nueva: no hay dos verdades que
puedan discrepar, y no hace falta migrar los pedidos que ya existen.

`ENTREGADO` no aparece aquí a propósito. Entregar es un hecho del despacho
—lo marcan el botón de entrega y el cierre del lote—, así que vive en la
columna de despacho y no se repite en esta.

Los valores guardados del sistema anterior (`EDITADO`, `CERRADO`, `IMPRESO`) sí
se respetan cuando están: son lo único que se sabe de esos pedidos.

Si alguien piensa en revivir esa columna, hay una trampa: `apps.mensajeria`
le escribe por WhatsApp al CLIENTE cuando el estado pasa a `EDITADO`
(«pedido ajustado») o a `CERRADO` («pedido confirmado») — ver
`mensajeria/disparadores.AVISO_POR_ESTADO`. Empezar a escribir esos dos
valores no es un cambio de presentación: le manda mensajes a la gente.
"""
from .models import DetallePedido, EventoPedido

POR_REVISAR = "POR_REVISAR"
RECIBIDO = "RECIBIDO"
EDITADO = "EDITADO"
CERRADO = "CERRADO"
IMPRESO = "IMPRESO"

ETIQUETAS = {
    POR_REVISAR: "Por revisar",
    RECIBIDO: "Recibido",
    EDITADO: "Editado",
    CERRADO: "Cerrado",
    IMPRESO: "Impreso",
}

#: Estados del sistema anterior que, si están guardados, mandan: de esos
#: pedidos no hay otro rastro.
LEGADO = (EDITADO, CERRADO, IMPRESO)


def estados_comerciales(tenant, crudos: dict) -> dict:
    """
    `{pedido_id: {"estado", "etiqueta", "por_revisar"}}`.

    `crudos` es `{pedido_id: Pedido.estado}` — lo que la lista ya trae, para
    no volver a consultarlo. Dos consultas por página, no una por fila.
    """
    ids = list(crudos)
    if not ids:
        return {}
    por_revisar = set(
        DetallePedido.objects.filter(
            tenant=tenant, pedido_id__in=ids, es_catalogo=False, estado_revision="PENDIENTE"
        ).values_list("pedido_id", flat=True)
    )
    facturados = set(
        EventoPedido.objects.filter(tenant=tenant, pedido_id__in=ids, tipo="FACTURA").values_list(
            "pedido_id", flat=True
        )
    )
    salida = {}
    for pid, crudo in crudos.items():
        if pid in por_revisar:
            estado = POR_REVISAR
        elif pid in facturados:
            estado = IMPRESO
        elif crudo in LEGADO:
            estado = crudo
        else:
            estado = RECIBIDO
        salida[pid] = {
            "estado": estado,
            "etiqueta": ETIQUETAS[estado],
            "por_revisar": pid in por_revisar,
        }
    return salida
