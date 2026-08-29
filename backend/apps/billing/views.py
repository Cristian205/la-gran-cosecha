"""
La API del panel de Crynex.

Es la única parte del sistema que atraviesa negocios a propósito, y por eso
todo lo de aquí declara `ambito_de_plataforma()` de forma explícita: en el
resto del código un queryset sin ámbito es un error, y quería que la excepción
se leyera en cada vista en vez de esconderse en la configuración.
"""
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.context import ambito_de_plataforma
from apps.tenancy.models import Tenant

from .models import PermisoDisponible, Plan, Subscription
from .permisos import EsStaffDePlataforma
from .serializers import (
    NegocioSerializer,
    PermisoDisponibleSerializer,
    PlanSerializer,
    SubscriptionSerializer,
)


class BaseDePlataforma(viewsets.ModelViewSet):
    """Todo el panel de Crynex exige ser staff de plataforma."""

    permission_classes = [EsStaffDePlataforma]
    pagination_class = None  # son catálogos cortos que la UI consume enteros


class PermisoDisponibleViewSet(BaseDePlataforma):
    """
    El catálogo de lo que Crynex puede conceder a las empresas.

    Antes era una constante de Python. Como filas, añadir un módulo o retirar
    uno deja de exigir un despliegue — y desactivar uno lo oculta en todos los
    negocios a la vez, sin tocar ningún plan.
    """

    serializer_class = PermisoDisponibleSerializer
    queryset = PermisoDisponible.objects.all()


class PlanViewSet(BaseDePlataforma):
    serializer_class = PlanSerializer
    queryset = Plan.objects.annotate(total=Count("suscripciones"))

    def perform_destroy(self, instance):
        """
        Un plan con empresas dentro no se borra: se desactiva.

        Borrarlo dejaría a esos negocios sin plan y sin permisos de un golpe.
        `Subscription.plan` es PROTECT, así que la base lo impediría igualmente;
        esto convierte ese error en una acción con sentido.
        """
        if instance.suscripciones.exists():
            instance.activo = False
            instance.save(update_fields=["activo"])
            return
        instance.delete()


class NegocioViewSet(BaseDePlataforma):
    """Las empresas que usan Crynex."""

    serializer_class = NegocioSerializer
    # Sin "post" la acción `cambiar-plan` daría 405: `http_method_names` filtra
    # antes de que el router mire las acciones. No hay `create` ni `delete`
    # porque dar de alta y borrar empresas es un flujo aparte, no un CRUD.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        with ambito_de_plataforma():
            return list(
                Tenant.objects.select_related("suscripcion__plan").prefetch_related(
                    "dominios", "memberships"
                )
            )

    @action(detail=True, methods=["post"], url_path="cambiar-plan")
    def cambiar_plan(self, request, pk=None):
        """Mueve una empresa de plan, creando su suscripción si aún no tenía."""
        negocio = Tenant.objects.filter(pk=pk).first()
        if negocio is None:
            return Response({"detail": "No existe ese negocio."}, status=404)

        plan = Plan.objects.filter(slug=request.data.get("plan")).first()
        if plan is None:
            return Response({"detail": "No existe ese plan."}, status=400)

        suscripcion, _ = Subscription.objects.get_or_create(
            tenant=negocio, defaults={"plan": plan}
        )
        suscripcion.plan = plan
        suscripcion.save(update_fields=["plan"])
        return Response(SubscriptionSerializer(suscripcion).data)


class SubscriptionViewSet(BaseDePlataforma):
    serializer_class = SubscriptionSerializer
    queryset = Subscription.objects.select_related("tenant", "plan")


class ResumenPlataformaView(APIView):
    """Las cifras de la plataforma entera, no las de ningún negocio."""

    permission_classes = [EsStaffDePlataforma]

    def get(self, request):
        with ambito_de_plataforma():
            por_estado = dict(
                Tenant.objects.values_list("estado")
                .annotate(n=Count("id"))
                .values_list("estado", "n")
            )
            planes = [
                {"plan": p.nombre, "negocios": p.suscripciones.count()}
                for p in Plan.objects.all()
            ]
            return Response(
                {
                    "negocios_total": sum(por_estado.values()),
                    "negocios_por_estado": por_estado,
                    "planes": planes,
                    "permisos_activos": PermisoDisponible.objects.filter(
                        activo=True
                    ).count(),
                }
            )
