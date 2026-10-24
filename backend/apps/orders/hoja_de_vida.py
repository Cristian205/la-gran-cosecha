"""
La «hoja de vida» de un cliente: qué ha sido para el negocio, de un vistazo.

Todo sale de sus pedidos y de su ficha; aquí no se estima ni se inventa nada.
Lo que no se puede saber con los datos (por ejemplo, la frecuencia con un solo
pedido) va como `None` y el panel no lo muestra.

La «relación» es una regla simple y explícita, no un modelo: el panel enseña
la regla junto a la etiqueta para que nadie la lea como una predicción.
"""
from collections import Counter
from decimal import Decimal

from django.db.models import Count
from django.utils import timezone

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
RECIENTES = 10
TOP_PRODUCTOS = 5
#: Sin frecuencia propia (un solo pedido), a partir de cuántos días sin pedir
#: se considera que la relación se enfría.
DIAS_SIN_PEDIR = 45


def _nombre_linea(detalle) -> str:
    if detalle.nombre_congelado:
        return detalle.nombre_congelado
    if detalle.presentacion_id and detalle.presentacion and detalle.presentacion.producto_id:
        return detalle.presentacion.producto.nombre_producto
    return detalle.nombre_personalizado or "Producto"


def _relacion(total, dias_desde_ultimo, frecuencia, dias_como_cliente):
    """(código, etiqueta, regla). La regla se muestra tal cual en el panel."""
    if total == 0:
        return "SIN_PEDIDOS", "Aún sin pedidos", "No ha hecho ningún pedido."
    umbral = max(int(frecuencia * 2), 14) if frecuencia else DIAS_SIN_PEDIR
    if dias_desde_ultimo > umbral:
        return (
            "INACTIVO",
            "Hace tiempo que no pide",
            f"Lleva {dias_desde_ultimo} días sin pedir; lo habitual en él son {umbral} como máximo.",
        )
    if total == 1 and dias_como_cliente <= 30:
        return "NUEVO", "Cliente nuevo", "Hizo su primer pedido en los últimos 30 días."
    if total >= 3:
        return "FRECUENTE", "Cliente frecuente", "Tres pedidos o más, y sigue pidiendo a su ritmo habitual."
    return "OCASIONAL", "Cliente ocasional", "Pide de vez en cuando y sigue activo."


def calcular(cliente) -> dict:
    ahora = timezone.now()
    pedidos = list(
        cliente.pedidos.all().order_by("fecha_pedido").only("id", "fecha_pedido", "estado", "total_pedido")
    )
    total = len(pedidos)
    valor_total = sum((p.total_pedido or Decimal("0") for p in pedidos), Decimal("0"))

    primer = pedidos[0] if pedidos else None
    ultimo = pedidos[-1] if pedidos else None
    mayor = max(pedidos, key=lambda p: p.total_pedido or 0) if pedidos else None
    dias_desde_ultimo = (ahora - ultimo.fecha_pedido).days if ultimo else None

    frecuencia = None
    if total >= 2:
        frecuencia = round((ultimo.fecha_pedido - primer.fecha_pedido).days / (total - 1), 1)

    dia_favorito = None
    if total >= 2:
        conteo_dias = Counter(timezone.localtime(p.fecha_pedido).weekday() for p in pedidos)
        dia, veces = conteo_dias.most_common(1)[0]
        # Solo si de verdad destaca: un empate entre días no es una costumbre.
        if veces >= 2 and list(conteo_dias.values()).count(veces) == 1:
            dia_favorito = {"dia": DIAS[dia], "veces": veces}

    from .models import DetallePedido  # noqa: PLC0415

    detalles = DetallePedido.all_tenants.filter(pedido__cliente=cliente).select_related(
        "presentacion__producto"
    )
    veces_por_producto: Counter = Counter()
    fuera_de_catalogo = 0
    for d in detalles:
        veces_por_producto[_nombre_linea(d)] += 1
        if not d.es_catalogo and not d.presentacion_id:
            fuera_de_catalogo += 1

    inicio = cliente.fecha_registro_cliente
    dias_como_cliente = (ahora - inicio).days if inicio else 0
    codigo, etiqueta, regla = _relacion(total, dias_desde_ultimo or 0, frecuencia, dias_como_cliente)

    hitos = [{"fecha": inicio, "tipo": "REGISTRO", "texto": "Se registró como cliente"}] if inicio else []
    if primer:
        hitos.append({"fecha": primer.fecha_pedido, "tipo": "PRIMER_PEDIDO", "texto": f"Primer pedido (#{primer.pk})"})
    if cliente.autorizo_datos_en:
        hitos.append({"fecha": cliente.autorizo_datos_en, "tipo": "DATOS", "texto": "Autorizó el tratamiento de sus datos"})
    if cliente.acepta_whatsapp and cliente.whatsapp_decidido_en:
        hitos.append({"fecha": cliente.whatsapp_decidido_en, "tipo": "WHATSAPP", "texto": "Aceptó recibir avisos por WhatsApp"})
    if mayor and total >= 2:
        hitos.append({"fecha": mayor.fecha_pedido, "tipo": "MAYOR", "texto": f"Su pedido de mayor valor (#{mayor.pk})", "valor": mayor.total_pedido})
    if ultimo and total >= 2:
        hitos.append({"fecha": ultimo.fecha_pedido, "tipo": "ULTIMO", "texto": f"Último pedido (#{ultimo.pk})"})
    hitos.sort(key=lambda h: h["fecha"])

    estados = dict(Counter(p.estado for p in pedidos))
    recientes = cliente.pedidos.all().order_by("-fecha_pedido")[:RECIENTES]
    lineas = {
        fila["pedido_id"]: fila["n"]
        for fila in DetallePedido.all_tenants.filter(pedido__in=[p.pk for p in recientes])
        .values("pedido_id")
        .annotate(n=Count("id"))
    }

    return {
        "cliente_desde": inicio,
        "dias_como_cliente": dias_como_cliente,
        "total_pedidos": total,
        "valor_total": valor_total,
        "ticket_promedio": (valor_total / total).quantize(Decimal("1")) if total else None,
        "primer_pedido": primer.fecha_pedido if primer else None,
        "ultimo_pedido": ultimo.fecha_pedido if ultimo else None,
        "dias_desde_ultimo": dias_desde_ultimo,
        "frecuencia_dias": frecuencia,
        "dia_favorito": dia_favorito,
        "pedido_mayor": {"id": mayor.pk, "total": mayor.total_pedido, "fecha": mayor.fecha_pedido} if mayor else None,
        "estados": estados,
        "productos_favoritos": [{"nombre": n, "veces": v} for n, v in veces_por_producto.most_common(TOP_PRODUCTOS)],
        "productos_distintos": len(veces_por_producto),
        "lineas_fuera_de_catalogo": fuera_de_catalogo,
        "relacion": {"codigo": codigo, "etiqueta": etiqueta, "regla": regla},
        "hitos": hitos,
        "pedidos_recientes": [
            {
                "id": p.pk,
                "fecha": p.fecha_pedido,
                "estado": p.estado,
                "estado_etiqueta": p.get_estado_display(),
                "total": p.total_pedido,
                "productos": lineas.get(p.pk, 0),
            }
            for p in recientes
        ],
    }
