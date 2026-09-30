"""
El cliente de la tienda que se identifica con su cédula.

Es el primer nivel de identificación, pensado para salir a producción ya:
cómodo para el cliente y con la seguridad que da un dato que no es secreto.
Por eso lo que se devuelve al consultar una cédula está recortado a lo mínimo
para que la persona se reconozca —"Juan P.", "•••• 4567", "Cra 12…"— sin que
quien pruebe cédulas ajenas se lleve un teléfono o una dirección. Y las vistas
que lo usan limitan cuántas consultas se hacen por minuto.

El segundo nivel (usuario y contraseña) está declarado en
`StoreSettings.IDENTIFICACIONES` y todavía no se puede elegir.
"""
import re

from rest_framework import serializers

from .models import Cliente, Pedido

LARGO_MINIMO_DOCUMENTO = 5
LARGO_MAXIMO_DOCUMENTO = 15

#: Cuántos pedidos anteriores se muestran para repetir. Un historial largo no
#: ayuda a elegir: lo que se repite es lo reciente.
PEDIDOS_EN_HISTORIAL = 10


def modo_identificacion(tenant) -> str:
    """Cómo se identifican los clientes de este negocio. Sin configuración: por nombre."""
    from apps.content.models import StoreSettings  # noqa: PLC0415

    ajustes = StoreSettings.objects.filter(tenant=tenant).only("identificacion_clientes").first()
    return ajustes.identificacion_clientes if ajustes else StoreSettings.IDENTIFICACION_NOMBRE


def usa_cedula(tenant) -> bool:
    from apps.content.models import StoreSettings  # noqa: PLC0415

    return modo_identificacion(tenant) == StoreSettings.IDENTIFICACION_CEDULA


def normalizar_documento(texto) -> str:
    """
    "1.020.345.678", "1020 345 678" y "1020345678" son la misma cédula: se
    guardan solo los dígitos. Lanza `ValidationError` si no parece una.
    """
    digitos = re.sub(r"\D", "", str(texto or ""))
    if not (LARGO_MINIMO_DOCUMENTO <= len(digitos) <= LARGO_MAXIMO_DOCUMENTO):
        raise serializers.ValidationError(
            f"Escribe tu número de cédula ({LARGO_MINIMO_DOCUMENTO} a "
            f"{LARGO_MAXIMO_DOCUMENTO} dígitos, sin puntos)."
        )
    return digitos


def buscar_por_documento(documento: str):
    return Cliente.objects.filter(documento_cliente=documento).first()


# --------------------------------------------------------------------------
# Lo que se enseña de un cliente a quien escribe su cédula
# --------------------------------------------------------------------------
def enmascarar_nombre(nombre: str) -> str:
    """"Juan Pérez Gómez" -> "Juan P. G."; "Tienda Don José" -> "Tienda D. J."."""
    palabras = nombre.split()
    if not palabras:
        return ""
    return " ".join([palabras[0], *(f"{p[0].upper()}." for p in palabras[1:])])


def enmascarar_telefono(telefono: str) -> str:
    digitos = re.sub(r"\D", "", telefono or "")
    return f"•••• {digitos[-4:]}" if len(digitos) >= 4 else ""


def enmascarar_direccion(direccion: str) -> str:
    """Las dos primeras palabras bastan para reconocerla: "Cra 12…"."""
    palabras = (direccion or "").split()
    if not palabras:
        return ""
    return " ".join(palabras[:2]) + ("…" if len(palabras) > 2 else "")


def resumen_publico(cliente) -> dict:
    return {
        "nombre": enmascarar_nombre(cliente.nombre_cliente),
        "telefono": enmascarar_telefono(cliente.telefono_cliente),
        "direccion": enmascarar_direccion(cliente.direccion_cliente),
        # Si todavía le falta su primer pedido completo, la tienda le pide los
        # datos y el acuerdo de precios; si no, ya no se le vuelve a preguntar.
        "requiere_datos": not cliente.datos_completos,
    }


# --------------------------------------------------------------------------
# El historial, listo para volver a pedirlo
# --------------------------------------------------------------------------
def _url(request, archivo):
    if not archivo:
        return None
    return request.build_absolute_uri(archivo.url) if request else archivo.url


def historial_publico(cliente, request=None) -> list:
    """
    Sus últimos pedidos, cada línea con el precio y la disponibilidad de HOY.

    El pedido se repite con los precios del día, no con los de entonces: es
    exactamente el acuerdo que el cliente aceptó. Lo que ya no se vende sale
    marcado como no disponible para que la tienda lo explique en vez de
    ignorarlo en silencio.
    """
    pedidos = (
        Pedido.objects.filter(cliente=cliente)
        .order_by("-fecha_pedido")
        .prefetch_related(
            "detalles__presentacion__producto",
            "detalles__unidad_personalizada",
        )[:PEDIDOS_EN_HISTORIAL]
    )
    resultado = []
    for pedido in pedidos:
        lineas, personalizados = [], []
        for detalle in pedido.detalles.all():
            presentacion = detalle.presentacion
            if presentacion is None:
                personalizados.append(
                    {
                        "nombre": detalle.nombre_personalizado or "",
                        "cantidad": str(detalle.cantidad),
                        "unidad": detalle.unidad_personalizada.nombre_unidad
                        if detalle.unidad_personalizada
                        else "",
                    }
                )
                continue
            producto = presentacion.producto
            lineas.append(
                {
                    "producto_id": producto.id,
                    "producto_nombre": producto.nombre_producto,
                    "presentacion_id": presentacion.id,
                    "presentacion_nombre": presentacion.nombre_presentacion,
                    "imagen_url": _url(request, presentacion.imagen or producto.imagen),
                    "cantidad": str(detalle.cantidad),
                    "precio_actual": str(presentacion.precio_unitario),
                    "permite_fraccion": producto.permite_fraccion,
                    "tipo_cantidad": producto.tipo_cantidad,
                    "disponible": bool(producto.estado_producto and presentacion.estado_presentacion),
                }
            )
        resultado.append(
            {
                "id": pedido.id,
                "fecha": pedido.fecha_pedido.isoformat(),
                "estado": pedido.get_estado_display(),
                "total": str(pedido.total_pedido),
                "lineas": lineas,
                "personalizados": personalizados,
            }
        )
    return resultado
