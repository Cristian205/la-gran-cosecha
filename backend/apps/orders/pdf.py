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
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from apps.tenancy.viewsets import ExigeNegocioMixin

from apps.common.permissions import EsStaff, requiere_permiso
from apps.content.models import StoreSettings

from .factura_layout import planificar
from .models import LotePedidos, Pedido

CATEGORIAS_ESPECIALES = ["DESECHABLES", "SALSAMENTARIA", "DULCERIA"]


def _html(*args, **kwargs):
    """
    `weasyprint.HTML`, importado al usarlo y no al arrancar Django.

    WeasyPrint carga GLib/Pango al importarse, y en Windows eso llena la
    terminal de avisos («GLib-GIO-WARNING: Unexpectedly, UWP app …») en CADA
    comando (`migrate`, `runserver`, las pruebas…) aunque no se genere ningún
    PDF. Importarlo aquí hace que solo se cargue al crear una factura.
    """
    from weasyprint import HTML

    return HTML(*args, **kwargs)

# Mismo verde del h1/marca de la factura (#065f46).
COLOR_LOGO_FACTURA = (6, 95, 70)
INTENSIDAD_TINTE = 110  # de 255 (~43%): deja ver el dibujo original debajo


def _obtener_logo_base64(tenant=None, datos=None, tinte=None):
    """
    Lee el logo de la factura y lo devuelve en base64.

    `factura_logo` es el logo propio de la factura, si el negocio subió uno;
    sin él, cae al mismo `logo` del sitio — el comportamiento de siempre. El
    tinte verde institucional (mismo verde del h1) es OPCIONAL desde
    `factura_aplicar_tinte_logo`: activo por defecto (reproduce lo que la
    factura hacía siempre), pero un negocio cuyo logo ya no combine con ese
    verde puede apagarlo y usarlo tal cual.

    La vista previa de la configuración pasa `datos` (un logo recién elegido,
    aún sin guardar) y `tinte` (el interruptor tal como está en el formulario).
    """
    config = StoreSettings.get_para(tenant) or StoreSettings()
    if tinte is None:
        tinte = config.factura_aplicar_tinte_logo
    try:
        if datos is None:
            origen = config.factura_logo or config.logo
            if not origen:
                return ""
            # Igual que en accounts/emails.py: se lee por la API de storage
            # porque con R2 no existe .path. Los bytes van a BytesIO para que
            # Pillow tenga un archivo seekable, que el objeto que devuelve el
            # storage remoto no garantiza.
            with origen.open("rb") as archivo:
                datos = archivo.read()
        with Image.open(io.BytesIO(datos)) as logo:
            base = logo.convert("RGBA")
            if tinte:
                alpha_tinte = base.getchannel("A").point(lambda a: min(a, INTENSIDAD_TINTE))
                tinte = Image.new("RGBA", base.size, (*COLOR_LOGO_FACTURA, 0))
                tinte.putalpha(alpha_tinte)
                resultado = Image.alpha_composite(base, tinte)
            else:
                resultado = base
            buffer = io.BytesIO()
            resultado.save(buffer, format="PNG")
            return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception:  # noqa: BLE001 - cada storage falla distinto
        return ""


def _datos_emisor(tenant=None):
    """
    Todo lo que la factura de este negocio necesita, aparte del pedido en sí:
    los datos del emisor y la configuración de marca de agua / chip / nota de
    pie. Cada campo que puede quedar vacío tiene su respaldo aquí y no en la
    plantilla, para que "sin configurar" y "como estaba siempre" sean el
    mismo resultado.
    """
    config = StoreSettings.get_para(tenant) or StoreSettings()
    nombre_empresa = config.nombre_empresa or "Mi Empresa"
    return {
        "nombre_empresa": nombre_empresa,
        "factura_eslogan": config.factura_eslogan,
        "factura_nit": config.factura_nit,
        "factura_proveedor": config.factura_proveedor,
        "factura_telefono": config.factura_telefono,
        "factura_direccion": config.factura_direccion,
        "marca_agua_activa": config.factura_marca_agua_activa,
        "marca_agua_texto": config.factura_marca_agua_texto or nombre_empresa,
        # De porcentaje (1-40) a fracción, que es lo que espera el `rgba()` del
        # CSS. Va como TEXTO ya formateado: con LANGUAGE_CODE "es-co" la
        # plantilla localiza un float a "0,05", `rgba(..., 0,05)` es CSS
        # inválido, WeasyPrint descarta el color y la marca de agua salía
        # opaca, con el color del texto.
        "marca_agua_opacidad": f"{config.factura_marca_agua_opacidad / 100:.2f}",
        "nota_pie": config.factura_nota_pie
        or f"¡Gracias por preferir la calidad de {nombre_empresa}!",
        "chip_secundario": config.factura_chip_secundario,
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

    lineas = []
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

        lineas.append(
            (cat_obj, {"articulo": articulo, "pres": pres, "unidad": unidad, "cant": d.cantidad, "subtotal": subtotal})
        )

    return _contexto_de_lineas(pedido, lineas)


def _contexto_de_lineas(pedido, lineas):
    """
    Agrupa las líneas `(categoría, artículo)` como las pinta la factura y
    planifica la hoja. Lo usan el pedido real y el de prueba de la vista
    previa: así la vista previa es la factura de verdad, no una imitación.
    """
    dias_entrega = 1
    fecha_entrega = pedido.fecha_pedido + timedelta(days=dias_entrega)

    categorias_normales = OrderedDict()
    categorias_especiales = OrderedDict()

    for cat_obj, item in lineas:
        if not cat_obj:
            categorias_especiales.setdefault("OTROS", []).append(item)
            continue

        nombre_upper = cat_obj.nombre_categoria.upper()
        target_dict = (
            categorias_especiales if nombre_upper in CATEGORIAS_ESPECIALES else categorias_normales
        )
        target_dict.setdefault(cat_obj, []).append(item)

    # El número de columnas y el tamaño de letra no son fijos: se calculan
    # para este pedido en concreto, de forma que cuadre en una sola hoja tanto
    # con 5 artículos como con 100. Ver `factura_layout`.
    plan = planificar(categorias_normales, categorias_especiales)

    return {
        "pedido": pedido,
        "plan": plan,
        # Con muchos especiales, "Otros Productos" va como una tabla más en
        # las columnas (una línea por artículo) y la franja no se pinta:
        # saldría dos veces.
        "categorias_especiales": {} if plan.especiales_en_columnas else categorias_especiales,
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
        _html(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
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
        _html(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
        return response


# ==========================================================================
# VISTA PREVIA (Configuración → Facturación)
# ==========================================================================
class _CategoriaDePrueba:
    """Categoría del pedido de prueba cuando el negocio aún no tiene catálogo."""

    def __init__(self, nombre):
        self.nombre_categoria = nombre

    def __str__(self):
        return self.nombre_categoria


#: Si el catálogo está vacío, la vista previa usa estas líneas genéricas.
LINEAS_GENERICAS = [
    ("Frutas", "Producto de ejemplo A", "Unidad", "und", Decimal("3"), Decimal("2500")),
    ("Frutas", "Producto de ejemplo B", "Libra", "lb", Decimal("2"), Decimal("4200")),
    ("Verduras", "Producto de ejemplo C", "Kilogramo", "kg", Decimal("1.5"), Decimal("3800")),
    ("Verduras", "Producto de ejemplo D", "Atado", "und", Decimal("4"), Decimal("1500")),
]
#: Cuántas líneas lleva el pedido de prueba, y cuántas por categoría como mucho.
LINEAS_DE_PRUEBA = 14
POR_CATEGORIA = 3
CANTIDADES = [Decimal(c) for c in ("2", "1", "5", "0.5", "3", "1.5", "4")]


def _pedido_de_prueba(tenant):
    """
    Un pedido que no existe, armado con productos y precios REALES del
    catálogo del negocio (varias categorías, cantidades variadas), para que
    la vista previa se parezca a una factura de verdad. No se guarda nada.
    """
    from types import SimpleNamespace

    from django.utils import timezone

    from apps.catalog.models import PresentacionProducto

    presentaciones = (
        PresentacionProducto.objects.filter(
            estado_presentacion=True,
            producto__estado_producto=True,
            producto__categoria__isnull=False,
        )
        .select_related("producto__categoria", "unidad_venta")
        .order_by("producto__categoria__orden", "producto__orden", "orden", "id")
    )
    lineas, por_categoria, productos = [], {}, set()
    for pres in presentaciones[:400]:
        categoria = pres.producto.categoria
        if pres.producto_id in productos or por_categoria.get(categoria.pk, 0) >= POR_CATEGORIA:
            continue
        cantidad = CANTIDADES[len(lineas) % len(CANTIDADES)]
        lineas.append(
            (
                categoria,
                {
                    "articulo": pres.producto.nombre_producto,
                    "pres": pres.nombre_presentacion,
                    "unidad": pres.unidad_venta.abreviatura_unidad,
                    "cant": cantidad,
                    "subtotal": (cantidad * pres.precio_unitario).quantize(Decimal("1")),
                },
            )
        )
        productos.add(pres.producto_id)
        por_categoria[categoria.pk] = por_categoria.get(categoria.pk, 0) + 1
        if len(lineas) >= LINEAS_DE_PRUEBA:
            break

    if not lineas:
        categorias = {}
        for cat, articulo, pres, unidad, cant, precio in LINEAS_GENERICAS:
            categoria = categorias.setdefault(cat, _CategoriaDePrueba(cat))
            lineas.append(
                (categoria, {"articulo": articulo, "pres": pres, "unidad": unidad, "cant": cant, "subtotal": cant * precio})
            )

    total = sum((item["subtotal"] for _, item in lineas), Decimal("0"))
    pedido = SimpleNamespace(
        id=1,
        fecha_pedido=timezone.now(),
        total_pedido=total,
        cliente=SimpleNamespace(nombre_cliente="Cliente de prueba", direccion_cliente="Dirección de entrega del cliente"),
    )
    return pedido, lineas


def _verdadero(valor) -> bool:
    return str(valor).strip().lower() in ("1", "true", "on", "si", "sí")


class VistaPreviaFacturaView(ExigeNegocioMixin, APIView):
    """
    POST /api/orders/factura/vista-previa/ — la factura en PDF de un pedido de
    prueba, con los datos del formulario de Facturación TAL COMO ESTÁN, aunque
    aún no se hayan guardado. Es el mismo HTML y el mismo WeasyPrint que la
    factura real: lo que se ve aquí es lo que saldrá impreso.

    Acepta (multipart o JSON) los mismos nombres de campo que `site-config`;
    lo que no llegue se toma de lo guardado. `factura_logo` puede ser un
    archivo recién elegido.
    """

    permission_classes = [EsStaff]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    TEXTOS = {
        "nombre_empresa": "nombre_empresa",
        "factura_eslogan": "factura_eslogan",
        "factura_nit": "factura_nit",
        "factura_proveedor": "factura_proveedor",
        "factura_telefono": "factura_telefono",
        "factura_direccion": "factura_direccion",
        "factura_chip_secundario": "chip_secundario",
    }

    def post(self, request):
        datos = request.data
        emisor = _datos_emisor(request.tenant)

        for campo, clave in self.TEXTOS.items():
            if campo in datos:
                emisor[clave] = str(datos.get(campo) or "").strip()[:255]
        nombre = emisor["nombre_empresa"] or "Mi Empresa"
        emisor["nombre_empresa"] = nombre
        if "factura_nota_pie" in datos:
            emisor["nota_pie"] = str(datos.get("factura_nota_pie") or "").strip()[:255] or (
                f"¡Gracias por preferir la calidad de {nombre}!"
            )
        if "factura_marca_agua_activa" in datos:
            emisor["marca_agua_activa"] = _verdadero(datos.get("factura_marca_agua_activa"))
        if "factura_marca_agua_texto" in datos:
            emisor["marca_agua_texto"] = str(datos.get("factura_marca_agua_texto") or "").strip()[:60] or nombre
        if "factura_marca_agua_opacidad" in datos:
            try:
                opacidad = min(40, max(1, int(datos.get("factura_marca_agua_opacidad"))))
                emisor["marca_agua_opacidad"] = f"{opacidad / 100:.2f}"
            except (TypeError, ValueError):
                pass

        tinte = (
            _verdadero(datos.get("factura_aplicar_tinte_logo"))
            if "factura_aplicar_tinte_logo" in datos
            else None
        )
        archivo = request.FILES.get("factura_logo")
        logo_bytes = archivo.read() if archivo and archivo.size <= 5 * 1024 * 1024 else None

        pedido, lineas = _pedido_de_prueba(request.tenant)
        context = _contexto_de_lineas(pedido, lineas)
        context["logo_data"] = _obtener_logo_base64(request.tenant, datos=logo_bytes, tinte=tinte)
        context["fecha_impresion"] = pedido.fecha_pedido
        context.update(emisor)

        html_string = render_to_string("orders/pdf/factura.html", context)
        response = HttpResponse(content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="Vista_previa_factura.pdf"'
        response["Cache-Control"] = "no-store"
        _html(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
        return response
