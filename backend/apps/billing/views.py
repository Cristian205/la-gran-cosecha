"""
La API del panel de Crynex.

Es la única parte del sistema que atraviesa negocios a propósito, y por eso
todo lo de aquí declara `ambito_de_plataforma()` de forma explícita: en el
resto del código un queryset sin ámbito es un error, y quería que la excepción
se leyera en cada vista en vez de esconderse en la configuración.

Nada de este módulo decide reglas comerciales: las lee del catálogo. Si mañana
Business cuesta otra cosa o incluye treinta usuarios, aquí no se toca nada.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Prefetch
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.context import ambito_de_plataforma, usar_tenant
from apps.tenancy.models import Domain, Tenant

from .models import (
    Caracteristica,
    EstadoComercial,
    PermisoDisponible,
    Plan,
    PrecioPlan,
    Producto,
    Subscription,
    TipoLimite,
)
from .permisos import EsStaffDePlataforma
from .serializers import (
    AplicarPlantillaSerializer,
    AltaNegocioSerializer,
    CambiarPlanSerializer,
    CaracteristicaSerializer,
    DuplicarPlanSerializer,
    NegocioSerializer,
    PermisoDisponibleSerializer,
    PlanSerializer,
    PrecioPlanSerializer,
    ProductoSerializer,
    SubscriptionSerializer,
    TipoLimiteSerializer,
)


def aplicar_plantilla(negocio, slug, *, aplicar_tema=True, publicar=False, autor=None):
    """
    Le pone a un negocio la plantilla de tienda que se le indique.

    Vive aquí y no en `apps.storefront` para no invertir la dependencia: el
    motor de tiendas no tiene por qué saber que existe un Control Center. Lo que
    hace es llamar al servicio de allí dentro del ámbito del negocio, que es lo
    que sus modelos exigen.

    El import va dentro de la función a propósito: `billing` se carga antes que
    `storefront`, y arriba sería un ciclo en el arranque de Django.
    """
    from apps.storefront.composicion import adoptar_plantilla  # noqa: PLC0415
    from apps.storefront.models import Plantilla  # noqa: PLC0415

    plantilla = Plantilla.objects.filter(slug=slug, activa=True).first()
    if plantilla is None:
        from rest_framework import serializers as drf  # noqa: PLC0415

        raise drf.ValidationError({"plantilla": "No existe esa plantilla."})

    with usar_tenant(negocio):
        # `adoptar_plantilla` ya copia el aspecto: las paginas Y la identidad.
        # Antes se copiaba aqui otra vez, y esa segunda copia solo miraba
        # `tema_valores` — asi que una plantilla con color de marca propio se
        # asignaba desde el Control Center con su maqueta y el color anterior.
        # El sintoma era una boutique en verde y nadie diria que es un fallo de
        # esta funcion.
        paginas = adoptar_plantilla(
            negocio,
            plantilla,
            autor=autor,
            publicar_ya=publicar,
            con_aspecto=aplicar_tema,
        )

    return [p.ruta for p in paginas]


class BaseDePlataforma(viewsets.ModelViewSet):
    """Todo el panel de Crynex exige ser staff de plataforma."""

    permission_classes = [EsStaffDePlataforma]
    pagination_class = None  # son catálogos cortos que la UI consume enteros


# ==========================================================================
# Catálogo comercial
# ==========================================================================
class ProductoViewSet(BaseDePlataforma):
    """
    Las soluciones que Crynex comercializa.

    Antes eran una cadena repetida en cada permiso (`modulo`), lo que hacía
    imposible darle a un producto descripción, categoría o estado propios.
    """

    serializer_class = ProductoSerializer
    queryset = Producto.objects.prefetch_related("permisos")

    def get_serializer_context(self):
        # Los planes se pasan una vez y no por producto: contar cuántos planes
        # conceden cada uno son N consultas si se resuelve dentro del campo.
        return {**super().get_serializer_context(), "planes": list(Plan.objects.all())}

    def perform_destroy(self, instance):
        """Un producto con permisos vivos se archiva; borrarlo los arrastraría."""
        if instance.permisos.exists():
            instance.estado = EstadoComercial.ARCHIVADO
            instance.save(update_fields=["estado"])
            return
        instance.delete()


class CaracteristicaViewSet(BaseDePlataforma):
    """Lo que un plan promete y no es un permiso: soporte, API, SLA."""

    serializer_class = CaracteristicaSerializer
    queryset = Caracteristica.objects.select_related("producto")


class TipoLimiteViewSet(BaseDePlataforma):
    """
    El catálogo de recursos medibles.

    Es la pieza que convierte «cambiar el tope de usuarios» en una edición y no
    en un despliegue. Crear uno nuevo lo pone disponible en todos los planes de
    inmediato, con su valor por defecto.
    """

    serializer_class = TipoLimiteSerializer
    queryset = TipoLimite.objects.all()

    def perform_destroy(self, instance):
        """
        Un límite que algún plan configura no se borra: se desactiva.

        Borrarlo dejaría números huérfanos dentro de los JSON de los planes,
        que seguirían ahí sin que ninguna pantalla los explicara.
        """
        en_uso = Plan.objects.filter(limites__has_key=instance.codigo).exists()
        if en_uso:
            instance.activo = False
            instance.save(update_fields=["activo"])
            return
        instance.delete()


class PermisoDisponibleViewSet(BaseDePlataforma):
    """
    El catálogo de lo que Crynex puede conceder a las empresas.

    Antes era una constante de Python. Como filas, añadir un módulo o retirar
    uno deja de exigir un despliegue — y desactivar uno lo oculta en todos los
    negocios a la vez, sin tocar ningún plan.
    """

    serializer_class = PermisoDisponibleSerializer
    queryset = PermisoDisponible.objects.select_related("producto")


class PlanViewSet(BaseDePlataforma):
    serializer_class = PlanSerializer
    queryset = Plan.objects.prefetch_related(
        "caracteristicas", Prefetch("precios", queryset=PrecioPlan.objects.all())
    ).annotate(total=Count("suscripciones"))

    def perform_destroy(self, instance):
        """
        Un plan con empresas dentro no se borra: se archiva.

        Borrarlo dejaría a esos negocios sin plan y sin permisos de un golpe.
        `Subscription.plan` es PROTECT, así que la base lo impediría igualmente;
        esto convierte ese error en una acción con sentido.
        """
        if instance.suscripciones.exists():
            instance.estado = EstadoComercial.ARCHIVADO
            instance.save(update_fields=["estado"])
            return
        instance.delete()

    @action(detail=True, methods=["post"])
    def duplicar(self, request, pk=None):
        """
        Copia un plan, opcionalmente como la versión siguiente.

        Es la operación que hace posible cambiar de tarifa sin tocar a quien ya
        compró: con `nueva_version`, el original queda archivado —nadie más lo
        contrata— pero intacto para los clientes que lo tienen.
        """
        plan = self.get_object()
        entrada = DuplicarPlanSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        copia = plan.duplicar(**entrada.validated_data)
        return Response(self.get_serializer(copia).data, status=201)

    @action(detail=True, methods=["post"], url_path="predeterminado")
    def marcar_predeterminado(self, request, pk=None):
        """
        El plan en el que aterrizan las empresas nuevas.

        Se hace en una acción y no en un PATCH porque hay que apagar el
        anterior en la misma operación: la base solo admite uno, y un PATCH
        suelto fallaría contra la restricción en vez de hacer lo evidente.
        """
        plan = self.get_object()
        if plan.estado != EstadoComercial.ACTIVO:
            return Response(
                {"detail": "Solo un plan activo puede ser el predeterminado."},
                status=400,
            )
        Plan.objects.filter(es_predeterminado=True).exclude(pk=plan.pk).update(
            es_predeterminado=False
        )
        plan.es_predeterminado = True
        plan.save(update_fields=["es_predeterminado"])
        return Response(self.get_serializer(plan).data)

    @action(detail=True, methods=["get", "post"])
    def precios(self, request, pk=None):
        """Los precios de un plan: se listan y se añaden aquí."""
        plan = self.get_object()
        if request.method == "GET":
            return Response(PrecioPlanSerializer(plan.precios.all(), many=True).data)

        entrada = PrecioPlanSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        # Un precio nuevo cierra el anterior de la misma combinación en vez de
        # convivir con él: dos tarifas abiertas a la vez dejarían el importe a
        # suerte del orden de la consulta, y eso se descubre en una factura.
        anteriores = plan.precios.filter(
            moneda=datos["moneda"],
            periodicidad=datos["periodicidad"],
            vigente_hasta__isnull=True,
        ).exclude(vigente_desde__gte=datos["vigente_desde"])
        for anterior in anteriores:
            anterior.vigente_hasta = datos["vigente_desde"] - timedelta(days=1)
            anterior.save(update_fields=["vigente_hasta"])

        precio = PrecioPlan.objects.create(plan=plan, **datos)
        return Response(PrecioPlanSerializer(precio).data, status=201)


class PrecioPlanViewSet(BaseDePlataforma):
    """Edición puntual de un precio ya creado; el alta va por el plan."""

    serializer_class = PrecioPlanSerializer
    queryset = PrecioPlan.objects.select_related("plan")


# ==========================================================================
# Clientes y contratos
# ==========================================================================
class NegocioViewSet(BaseDePlataforma):
    """Las empresas que usan Crynex."""

    serializer_class = NegocioSerializer
    # Sin "post" la acción `cambiar-plan` daría 405: `http_method_names` filtra
    # antes de que el router mire las acciones. Sigue sin haber `delete`:
    # borrar una empresa se lleva por delante sus pedidos, sus archivos y sus
    # facturas, y eso no puede ser un botón de una tabla.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def create(self, request, *args, **kwargs):
        """
        Dar de alta un cliente.

        Es un flujo y no un `create` de ModelViewSet porque un negocio nuevo no
        es una fila: nace con su configuración de tienda, su suscripción y su
        página de inicio, y de eso se encargan tres señales distintas de
        `Tenant`. Aquí se recogen las decisiones que no tienen un valor por
        defecto razonable y se deja que las señales hagan el resto.

        Todo va en una transacción: un negocio con dominio pero sin plan, o al
        revés, sería peor que no haberlo creado.
        """
        entrada = AltaNegocioSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        with ambito_de_plataforma(), transaction.atomic():
            negocio = Tenant.objects.create(
                slug=datos["slug"],
                nombre=datos["nombre"],
                estado=datos["estado"],
            )

            if datos.get("dominio"):
                Domain.objects.create(
                    tenant=negocio, hostname=datos["dominio"], es_primario=True
                )

            # El plan por defecto ya lo puso la señal; esto solo lo corrige si
            # se pidió otro, para no depender del orden de las señales.
            if datos.get("plan"):
                plan = Plan.objects.get(slug=datos["plan"])
                suscripcion, _ = Subscription.objects.get_or_create(
                    tenant=negocio, defaults={"plan": plan}
                )
                suscripcion.plan = plan
                suscripcion.save(update_fields=["plan"])

            if datos.get("plantilla"):
                aplicar_plantilla(
                    negocio,
                    datos["plantilla"],
                    aplicar_tema=datos["aplicar_tema"],
                    publicar=True,
                    autor=request.user,
                )

        return Response(self.get_serializer(negocio).data, status=201)

    @action(detail=True, methods=["post"], url_path="aplicar-plantilla")
    def aplicar_plantilla_a_negocio(self, request, pk=None):
        """
        Asigna una plantilla de tienda a un cliente, desde la plataforma.

        Existe además de la acción del panel del negocio porque quien lo hace es
        otro: allí un cliente elige el molde de SU tienda, y aquí Crynex lo hace
        por él —al darlo de alta, o al rediseñarle la tienda—. La operación es
        la misma; lo que cambia es quién puede.

        Por defecto NO publica: deja el borrador para que alguien lo revise.
        """
        negocio = Tenant.objects.filter(pk=pk).first()
        if negocio is None:
            return Response({"detail": "No existe ese negocio."}, status=404)

        entrada = AplicarPlantillaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        with ambito_de_plataforma():
            rutas = aplicar_plantilla(
                negocio,
                datos["plantilla"],
                aplicar_tema=datos["aplicar_tema"],
                publicar=datos["publicar"],
                autor=request.user,
            )
        return Response({"paginas": rutas, "publicadas": datos["publicar"]})

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

        entrada = CambiarPlanSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        plan = Plan.objects.get(slug=datos["plan"])

        suscripcion, _ = Subscription.objects.get_or_create(
            tenant=negocio, defaults={"plan": plan}
        )
        suscripcion.plan = plan
        campos = ["plan"]
        for campo in ("moneda", "periodicidad"):
            if campo in datos:
                setattr(suscripcion, campo, datos[campo])
                campos.append(campo)

        # El precio pactado era del plan anterior: mantenerlo dejaría al
        # cliente pagando una tarifa que ya no corresponde a nada.
        if suscripcion.importe_pactado is not None:
            suscripcion.importe_pactado = None
            campos.append("importe_pactado")

        suscripcion.save(update_fields=campos)
        return Response(SubscriptionSerializer(suscripcion).data)


class SubscriptionViewSet(BaseDePlataforma):
    serializer_class = SubscriptionSerializer
    queryset = Subscription.objects.select_related("tenant", "plan")


# ==========================================================================
# Resumen de la plataforma
# ==========================================================================
class ResumenPlataformaView(APIView):
    """
    Las cifras de la plataforma entera, no las de ningún negocio.

    El MRR se calcula sumando lo que aporta cada contrato activo, normalizado a
    meses: un cliente anual también factura, solo que repartido. Se hace en el
    servidor porque es la única cifra del panel que no puede depender de que el
    frontend repita bien la regla.
    """

    permission_classes = [EsStaffDePlataforma]

    def get(self, request):
        with ambito_de_plataforma():
            por_estado = dict(
                Tenant.objects.values_list("estado")
                .annotate(n=Count("id"))
                .values_list("estado", "n")
            )

            suscripciones = list(
                Subscription.objects.select_related("plan").prefetch_related(
                    "plan__precios"
                )
            )
            mrr = sum((s.importe_mensual() for s in suscripciones), Decimal("0"))
            facturando = sum(1 for s in suscripciones if s.importe_mensual() > 0)

            hoy = timezone.localdate()
            renuevan = sum(
                1
                for s in suscripciones
                if s.fecha_fin and hoy <= s.fecha_fin <= hoy + timedelta(days=30)
            )

            return Response(
                {
                    "negocios_total": sum(por_estado.values()),
                    "negocios_por_estado": por_estado,
                    "planes": [
                        {"plan": p.nombre, "negocios": p.suscripciones.count()}
                        for p in Plan.objects.all()
                    ],
                    "permisos_activos": PermisoDisponible.objects.filter(
                        activo=True
                    ).count(),
                    "productos_activos": Producto.objects.filter(
                        estado=EstadoComercial.ACTIVO
                    ).count(),
                    "mrr": str(mrr),
                    "arr": str(mrr * 12),
                    "arpu": str(
                        (mrr / facturando).quantize(Decimal("0.01"))
                        if facturando
                        else Decimal("0")
                    ),
                    "suscripciones_facturando": facturando,
                    "renuevan_en_30_dias": renuevan,
                }
            )
