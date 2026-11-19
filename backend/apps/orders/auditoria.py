"""
La línea de tiempo de un pedido: qué le pasó, quién y cuándo.

Se escribe en `EventoPedido` y se lee mezclando tres fuentes, todas reales:

* `EventoPedido` — todo lo registrado desde que existe este módulo.
* `HistorialDetallePedido` — las ediciones de línea anteriores, que se
  conservan tal cual (marcadas como `legado`).
* `Pedido.fecha_pedido` — si el pedido es anterior a este módulo no tiene
  evento «recibido», pero la fecha en que llegó sí es un dato: se muestra
  como tal, sin inventar su contenido.

Nada de lo que devuelve `linea_de_tiempo` es simulado: si una acción no se
registraba cuando ocurrió, no aparece.
"""
from decimal import Decimal

from .models import EventoPedido, HistorialDetallePedido


def _texto(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, Decimal):
        # 2.00 → "2"; 2.50 → "2.5": como lo escribe una persona.
        normal = valor.normalize()
        return format(normal, "f") if normal == normal.to_integral() else str(normal)
    return str(valor)


def foto_de_linea(detalle) -> dict:
    """Copia de una línea que sobrevive a la línea: para eventos y para el recibo."""
    if detalle.presentacion_id:
        presentacion = detalle.presentacion
        nombre = presentacion.producto.nombre_producto
        variante = presentacion.nombre_presentacion
        unidad = presentacion.unidad_venta.abreviatura_unidad
    else:
        nombre = detalle.nombre_personalizado or ""
        variante = ""
        unidad = (
            detalle.unidad_personalizada.abreviatura_unidad if detalle.unidad_personalizada_id else ""
        )
    return {
        "detalle_id": detalle.id,
        "producto": nombre,
        "presentacion": variante,
        "unidad": unidad,
        "cantidad": _texto(detalle.cantidad),
        "precio_unitario": _texto(detalle.precio_unitario),
        "subtotal": _texto(detalle.subtotal),
        "origen": detalle.origen,
        "personalizado": detalle.presentacion_id is None,
    }


def etiqueta_de_linea(foto: dict) -> str:
    if foto.get("presentacion"):
        return f"{foto['producto']} · {foto['presentacion']}"
    return foto.get("producto") or "Producto"


def registrar(pedido, tipo: str, descripcion: str, *, usuario=None, **datos) -> EventoPedido:
    if usuario is not None and not getattr(usuario, "is_authenticated", False):
        usuario = None
    return EventoPedido.objects.create(
        tenant_id=pedido.tenant_id,
        pedido=pedido,
        tipo=tipo,
        descripcion=descripcion[:300],
        datos=datos,
        usuario=usuario,
    )


def registrar_recibido(pedido):
    """El pedido tal como llegó de la tienda: la foto que ninguna edición toca."""
    lineas = [
        foto_de_linea(d)
        for d in pedido.detalles.select_related(
            "presentacion__producto", "presentacion__unidad_venta", "unidad_personalizada"
        )
    ]
    return registrar(
        pedido,
        "RECIBIDO",
        "Pedido recibido desde la tienda",
        lineas=lineas,
        total=_texto(pedido.total_pedido),
        direccion=pedido.direccion_de_entrega,
        observaciones=pedido.observaciones or "",
    )


# ==========================================================================
# LECTURA
# ==========================================================================
def _nombre_usuario(usuario) -> str:
    if usuario is None:
        return ""
    return getattr(usuario, "nombre_usuario", "") or getattr(usuario, "email", "") or str(usuario)


_TIPO_LEGADO = {
    "cantidad": "CANTIDAD",
    "precio_unitario": "PRECIO",
    "presentacion": "PRESENTACION",
}

_ETIQUETA_LEGADO = {
    "cantidad": "Cantidad",
    "precio_unitario": "Precio unitario",
    "nombre_personalizado": "Nombre del producto",
    "presentacion": "Presentación",
    "unidad_personalizada": "Unidad de venta",
}


def linea_de_tiempo(pedido) -> list[dict]:
    """Los eventos del pedido, del más reciente al más antiguo."""
    eventos = []

    propios = list(pedido.eventos.select_related("usuario"))
    for e in propios:
        eventos.append(
            {
                "id": f"e{e.id}",
                "tipo": e.tipo,
                "descripcion": e.descripcion,
                "datos": e.datos,
                "usuario_nombre": _nombre_usuario(e.usuario),
                "fecha": e.fecha,
                "legado": False,
            }
        )

    legado = HistorialDetallePedido.objects.filter(detalle__pedido=pedido).select_related(
        "usuario", "detalle__presentacion__producto"
    )
    for h in legado:
        detalle = h.detalle
        producto = (
            detalle.presentacion.producto.nombre_producto
            if detalle.presentacion_id
            else (detalle.nombre_personalizado or "Producto")
        )
        etiqueta = _ETIQUETA_LEGADO.get(h.campo, h.campo)
        eventos.append(
            {
                "id": f"h{h.id}",
                "tipo": _TIPO_LEGADO.get(h.campo, "PRODUCTO_EDITADO"),
                "descripcion": f"{etiqueta} de {producto}",
                "datos": {
                    "producto": producto,
                    "campo": h.campo,
                    "anterior": h.valor_anterior,
                    "nuevo": h.valor_nuevo,
                },
                "usuario_nombre": _nombre_usuario(h.usuario),
                "fecha": h.fecha,
                "legado": True,
            }
        )

    if not any(e.tipo == "RECIBIDO" for e in propios):
        eventos.append(
            {
                "id": "recibido",
                "tipo": "RECIBIDO",
                "descripcion": "Pedido recibido desde la tienda",
                # Anterior a la auditoría: se sabe CUÁNDO llegó, no la foto
                # exacta de su contenido. No se reconstruye.
                "datos": {"sin_foto": True},
                "usuario_nombre": "",
                "fecha": pedido.fecha_pedido,
                "legado": True,
            }
        )

    eventos.sort(key=lambda e: e["fecha"], reverse=True)
    return eventos
