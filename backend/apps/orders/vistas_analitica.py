"""
Endpoints del dashboard ejecutivo: uno por módulo.

Cada módulo del panel pide lo suyo, así que una consulta lenta (el ranking de
productos de un año) no retiene los KPI. Todos aceptan los mismos parámetros,
que el panel saca de UN filtro global:

- `desde`, `hasta` — AAAA-MM-DD, ambos incluidos (por defecto, los 30 días
  hasta hoy). Máximo 366 días.
- `comparar` — `1` (por defecto) o `0`. Con `0` no se calcula el período
  anterior y sus campos llegan en `null`.

Y todos responden `{"periodo": {...}, "generado_en": ..., ...}`. Los cálculos
y sus definiciones viven en `analitica.py`; aquí solo se leen parámetros y se
aplican permisos.

`PanelEstadisticasView` (`/admin/stats/panel/`) sigue en pie para quien lo use;
el dashboard ya no depende de él.
"""
from datetime import date, timedelta

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import EsStaff, requiere_permiso
from apps.tenancy.viewsets import ExigeNegocioMixin

from . import analitica

VALORES_FALSOS = {"0", "false", "no", "off"}


class ParametroInvalido(Exception):
    pass


def _fecha(request, clave: str, defecto: date) -> date:
    valor = request.query_params.get(clave)
    if not valor:
        return defecto
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ParametroInvalido(f"El parámetro '{clave}' debe tener formato AAAA-MM-DD.")


def _entero(request, clave: str, defecto: int, minimo: int, maximo: int) -> int:
    valor = request.query_params.get(clave)
    if valor in (None, ""):
        return defecto
    try:
        return max(minimo, min(maximo, int(valor)))
    except ValueError:
        raise ParametroInvalido(f"El parámetro '{clave}' debe ser un número entero.")


def periodo_de(request) -> analitica.Periodo:
    hoy = timezone.localdate()
    desde = _fecha(request, "desde", hoy - timedelta(days=29))
    hasta = _fecha(request, "hasta", hoy)
    if desde > hasta:
        raise ParametroInvalido("'desde' no puede ser posterior a 'hasta'.")
    if (hasta - desde).days + 1 > analitica.DIAS_MAX:
        raise ParametroInvalido(f"El rango no puede superar {analitica.DIAS_MAX} días.")
    comparar = request.query_params.get("comparar", "1").lower() not in VALORES_FALSOS
    return analitica.construir_periodo(desde, hasta, comparar=comparar)


class _VistaAnalitica(ExigeNegocioMixin, APIView):
    permission_classes = [EsStaff]

    def calcular(self, request, periodo: analitica.Periodo) -> dict:  # pragma: no cover - abstracto
        raise NotImplementedError

    def get(self, request):
        try:
            periodo = periodo_de(request)
            datos = self.calcular(request, periodo)
        except ParametroInvalido as error:
            return Response({"detail": str(error)}, status=400)
        return Response({"periodo": periodo.como_dict(), "generado_en": timezone.now(), **datos})


class ResumenEjecutivoView(_VistaAnalitica):
    def calcular(self, request, periodo):
        return analitica.resumen(periodo)


class EvolucionVentasView(_VistaAnalitica):
    def calcular(self, request, periodo):
        return analitica.analisis_ventas(periodo)


class AnaliticaClientesView(_VistaAnalitica):
    def calcular(self, request, periodo):
        return analitica.analitica_clientes(periodo)


class RankingProductosView(_VistaAnalitica):
    """`orden` = ingresos | cantidad | frecuencia; `categoria` = id; `limite` = 1–20."""

    def calcular(self, request, periodo):
        orden = request.query_params.get("orden", "ingresos")
        if orden not in analitica.ORDENES_PRODUCTO:
            raise ParametroInvalido(f"'orden' debe ser uno de: {', '.join(analitica.ORDENES_PRODUCTO)}.")
        categoria = request.query_params.get("categoria")
        try:
            categoria = int(categoria) if categoria else None
        except ValueError:
            raise ParametroInvalido("El parámetro 'categoria' debe ser un número entero.")
        limite = _entero(request, "limite", 10, 1, analitica.LIMITE_PRODUCTOS)
        return analitica.ranking_productos(periodo, orden, categoria, limite, request=request)


class VentasPorCategoriaView(_VistaAnalitica):
    def calcular(self, request, periodo):
        return analitica.ventas_por_categoria(periodo)


class ResumenOperativoView(_VistaAnalitica):
    def calcular(self, request, periodo):
        return analitica.resumen_operativo(periodo)


class ClientesDestacadosView(_VistaAnalitica):
    """Nombres y montos de clientes: exige poder ver clientes."""

    permission_classes = [EsStaff, requiere_permiso("orders.view_cliente")]

    def calcular(self, request, periodo):
        return analitica.clientes_destacados(periodo, _entero(request, "limite", 5, 1, 20))


class ActividadRecienteView(_VistaAnalitica):
    """
    Los últimos pedidos registrados, paginados con `limite` y `desde_fila`.
    No depende del período: es «qué acaba de entrar». Exige ver pedidos.
    """

    permission_classes = [EsStaff, requiere_permiso("orders.view_pedido")]

    def calcular(self, request, periodo):
        return analitica.pedidos_recientes(
            _entero(request, "limite", 8, 1, analitica.LIMITE_RECIENTES),
            _entero(request, "desde_fila", 0, 0, 10_000),
        )
