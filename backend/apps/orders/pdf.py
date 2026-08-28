"""
Generación de facturas en PDF para pedidos, con WeasyPrint.

Portado de la versión original del proyecto (`apps/ui/views.py`), conservando
la misma lógica de agrupación por categoría. La diferencia principal es que el
logo y los datos del emisor (NIT, proveedor, teléfono, dirección) ya no están
fijos en el código: se leen de `apps.content.models.StoreSettings`, editable
desde el admin-panel.
"""
import base64
import io
from collections import OrderedDict
from datetime import timedelta
from decimal import Decimal

from django.http import HttpResponse
from django.template.loader import render_to_string
from PIL import Image
from rest_framework.views import APIView

from apps.tenancy.viewsets import ExigeNegocioMixin
from weasyprint import HTML

from apps.common.permissions import requiere_permiso
from apps.content.models import StoreSettings

from .factura_layout import planificar
from .models import LotePedidos, Pedido

CATEGORIAS_ESPECIALES = ["DESECHABLES", "SALSAMENTARIA", "DULCERIA"]

# Mismo verde del h1/marca de la factura (#065f46).
COLOR_LOGO_FACTURA = (6, 95, 70)
INTENSIDAD_TINTE = 110  # de 255 (~43%): deja ver el dibujo original debajo


def _obtener_logo_base64(tenant=None):
    """
    Lee el logo configurado en StoreSettings y lo devuelve en base64, con un tinte
    verde parcial (mismo verde del h1) superpuesto sobre su silueta, dejando
    ver el dibujo/colores originales por debajo en vez de taparlo del todo.
    """
    config = StoreSettings.get_para(tenant)
    if config is None or not config.logo:
        return ""
    # Igual que en accounts/emails.py: se lee por la API de storage porque con
    # R2 no existe .path. Los bytes van a BytesIO para que Pillow tenga un
    # archivo seekable, que el objeto que devuelve el storage remoto no garantiza.
    try:
        with config.logo.open("rb") as archivo:
            datos_logo = archivo.read()
        with Image.open(io.BytesIO(datos_logo)) as logo:
            base = logo.convert("RGBA")
            alpha_tinte = base.getchannel("A").point(lambda a: min(a, INTENSIDAD_TINTE))
            tinte = Image.new("RGBA", base.size, (*COLOR_LOGO_FACTURA, 0))
            tinte.putalpha(alpha_tinte)
            resultado = Image.alpha_composite(base, tinte)
            buffer = io.BytesIO()
            resultado.save(buffer, format="PNG")
            return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception:  # noqa: BLE001 - cada storage falla distinto
        return ""


def _datos_emisor(tenant=None):
    config = StoreSettings.get_para(tenant) or StoreSettings()
    return {
        "nombre_empresa": config.nombre_empresa or "Mi Empresa",
        "factura_eslogan": config.factura_eslogan,
        "factura_nit": config.factura_nit,
        "factura_proveedor": config.factura_proveedor,
        "factura_telefono": config.factura_telefono,
        "factura_direccion": config.factura_direccion,
    }


def _obtener_datos_factura(pedido):
    """
    Arma el diccionario de contexto (categorías agrupadas, fecha de entrega,
    etc.) para UN pedido. No incluye 'logo_data' ni los datos del emisor,
    que son comunes a todos los pedidos y se resuelven una sola vez en el llamador.
    """
    detalles = pedido.detalles.select_related(
        "presentacion__producto__categoria",
        "presentacion__unidad_venta",
        "categoria_manual",
        "unidad_personalizada",
    ).order_by(
        "presentacion__producto__categoria__orden",
        "presentacion__producto__orden",
        "presentacion__producto__nombre_producto",
    )

    dias_entrega = 1
    fecha_entrega = pedido.fecha_pedido + timedelta(days=dias_entrega)

    categorias_normales = OrderedDict()
    categorias_especiales = OrderedDict()

    for d in detalles:
        if d.presentacion:
            cat_obj = d.presentacion.producto.categoria
            articulo = d.presentacion.producto.nombre_producto
            pres = d.presentacion.nombre_presentacion
            unidad = d.presentacion.unidad_venta.abreviatura_unidad
            subtotal = d.subtotal
        else:
            cat_obj = d.categoria_manual
            articulo = d.nombre_personalizado
            pres = "MANUAL"
            unidad = d.unidad_personalizada.abreviatura_unidad if d.unidad_personalizada else ""
            subtotal = d.subtotal or 0

        if not cat_obj:
            categorias_especiales.setdefault("OTROS", [])
            categorias_especiales["OTROS"].append(
                {"articulo": articulo, "pres": pres, "unidad": unidad, "cant": d.cantidad, "subtotal": subtotal}
            )
            continue

        nombre_upper = cat_obj.nombre_categoria.upper()
        target_dict = (
            categorias_especiales if nombre_upper in CATEGORIAS_ESPECIALES else categorias_normales
        )
        target_dict.setdefault(cat_obj, [])
        target_dict[cat_obj].append(
            {"articulo": articulo, "pres": pres, "unidad": unidad, "cant": d.cantidad, "subtotal": subtotal}
        )

    # El número de columnas y el tamaño de letra no son fijos: se calculan
    # para este pedido en concreto, de forma que cuadre en una sola hoja tanto
    # con 5 artículos como con 100. Ver `factura_layout`.
    plan = planificar(categorias_normales, categorias_especiales)

    return {
        "pedido": pedido,
        "plan": plan,
        "categorias_especiales": categorias_especiales,
        "fecha_entrega": fecha_entrega,
    }


class GenerarPdfPedidoView(ExigeNegocioMixin, APIView):
    """GET /api/orders/<id>/pdf/ — factura en PDF de un solo pedido."""

    permission_classes = [requiere_permiso("orders.view_pedido")]

    def get(self, request, pk):
        try:
            pedido = Pedido.objects.select_related("cliente").get(id=pk)
        except Pedido.DoesNotExist:
            return HttpResponse("El pedido solicitado no existe.", status=404)

        context = _obtener_datos_factura(pedido)
        context["logo_data"] = _obtener_logo_base64(pedido.tenant)
        context["fecha_impresion"] = pedido.fecha_pedido
        context.update(_datos_emisor(pedido.tenant))

        html_string = render_to_string("orders/pdf/factura.html", context)

        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="Pedido_{pk}.pdf"'
        HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
        return response


class GenerarPdfPedidosLoteView(ExigeNegocioMixin, APIView):
    """GET /api/orders/pdf-lote/?ids=1,2,3 — una factura por pedido, un solo PDF."""

    permission_classes = [requiere_permiso("orders.view_pedido")]

    def get(self, request):
        ids_param = request.query_params.get("ids", "")
        ids = [i for i in ids_param.split(",") if i.strip().isdigit()]

        if not ids:
            return HttpResponse("No se especificaron pedidos válidos.", status=400)

        orden = {int(i): idx for idx, i in enumerate(ids)}
        pedidos_qs = Pedido.objects.select_related("cliente").filter(id__in=ids)
        pedidos_ordenados = sorted(pedidos_qs, key=lambda p: orden.get(p.id, 0))

        if not pedidos_ordenados:
            return HttpResponse("Ninguno de los pedidos solicitados existe.", status=404)

        if len(pedidos_ordenados) > 1:
            total_lote = sum((p.total_pedido for p in pedidos_ordenados), Decimal("0"))
            lote = LotePedidos.objects.create(
                tipo="IMPRESION",
                usuario=request.user,
                cantidad_pedidos=len(pedidos_ordenados),
                total_lote=total_lote,
            )
            lote.pedidos.set(pedidos_ordenados)

        # Todos los pedidos del lote son del mismo negocio (la vista ya está
        # acotada), así que basta el del primero para la marca del emisor.
        tenant = pedidos_ordenados[0].tenant
        context = {
            "pedidos_data": [_obtener_datos_factura(p) for p in pedidos_ordenados],
            "logo_data": _obtener_logo_base64(tenant),
            **_datos_emisor(tenant),
        }

        html_string = render_to_string("orders/pdf/factura_lote.html", context)

        response = HttpResponse(content_type="application/pdf")
        ids_str = "-".join(str(p.id) for p in pedidos_ordenados)
        response["Content-Disposition"] = f'inline; filename="Pedidos_{ids_str}.pdf"'
        HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
        return response
