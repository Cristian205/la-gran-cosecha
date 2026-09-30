"""
Lo que la tienda pública consulta de un cliente que se identifica con su cédula.

Son POST y no GET a propósito: la cédula viaja en el cuerpo y no en la URL, así
que no queda en logs de acceso, en el historial del navegador ni en cabeceras
`Referer`.
"""
import secrets

from django.conf import settings
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from apps.tenancy.viewsets import ExigeNegocioMixin

from .clientes_tienda import (
    buscar_por_documento,
    historial_publico,
    normalizar_documento,
    resumen_publico,
    usa_cedula,
)


class ConsultaClienteThrottle(SimpleRateThrottle):
    """
    Cuántas cédulas puede consultar un mismo visitante por minuto.

    La tienda habla con Django a través de su propio servidor (el puente
    `app/api/[...ruta]` de Next), así que aquí la IP de la petición es SIEMPRE
    la de ese servidor: limitar por ella frenaría a todos los clientes a la vez.
    El puente reenvía la IP del visitante en `X-Visitante-IP`, y solo se le
    cree cuando llega con la clave de servidor: sin ella, cualquiera podría
    inventarse una IP distinta en cada intento.
    """

    scope = "consulta_cliente"

    def get_rate(self):
        return getattr(settings, "TASA_CONSULTA_CLIENTE", "10/min")

    def get_cache_key(self, request, view):
        tenant = getattr(request, "tenant", None)
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{getattr(tenant, 'pk', '-')}:{self._visitante(request)}",
        }

    def _visitante(self, request):
        esperada = getattr(settings, "TENANCY_CLAVE_SERVIDOR", "")
        clave = request.META.get("HTTP_X_TENANT_KEY", "")
        reenviada = request.META.get("HTTP_X_VISITANTE_IP", "").strip()
        if esperada and clave and reenviada and secrets.compare_digest(clave, esperada):
            return reenviada
        return self.get_ident(request)


class CedulaSerializer(serializers.Serializer):
    cedula = serializers.CharField(max_length=30)

    def validate_cedula(self, valor):
        return normalizar_documento(valor)


class _VistaClienteTienda(ExigeNegocioMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ConsultaClienteThrottle]

    def _cliente(self, request):
        """El cliente de esa cédula, o la respuesta con la que se corta."""
        if not usa_cedula(request.tenant):
            return None, Response(
                {"detail": "Esta tienda no identifica a sus clientes por cédula."}, status=404
            )
        datos = CedulaSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        return buscar_por_documento(datos.validated_data["cedula"]), None


class ConsultarClienteView(_VistaClienteTienda):
    """
    ¿Esta cédula ya pidió antes? Si sí, lo mínimo para que la persona se
    reconozca y sepa si le falta algo por completar.
    """

    def post(self, request):
        cliente, corte = self._cliente(request)
        if corte:
            return corte
        if cliente is None:
            return Response({"existe": False})
        return Response({"existe": True, **resumen_publico(cliente)})


class HistorialClienteView(_VistaClienteTienda):
    """Los últimos pedidos de esa cédula, con los precios de hoy, para repetirlos."""

    def post(self, request):
        cliente, corte = self._cliente(request)
        if corte:
            return corte
        if cliente is None:
            return Response({"existe": False, "pedidos": []})
        return Response(
            {"existe": True, **resumen_publico(cliente), "pedidos": historial_publico(cliente, request)}
        )
