"""
La API del motor de tiendas.

Tres públicos bien separados, y la separación es la que sostiene el aislamiento:

* El VISITANTE lee la composición publicada de la tienda del host por el que
  entró. Sin sesión, sin poder pedir otra cosa que lo publicado.
* El NEGOCIO edita sus páginas: borrador, publicar, restaurar. Solo las suyas,
  porque el mixin de tenancy acota el queryset.
* CRYNEX administra el catálogo —bloques, temas, plantillas—, que es global y
  no pertenece a ningún negocio.
"""
from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.permisos import EsStaffDePlataforma
from apps.common.permissions import EsStaff
from apps.content.models import StoreSettings
from apps.tenancy.viewsets import ExigeNegocioMixin, TenantScopedMixin

from . import composicion as servicio
from .models import Bloque, Pagina, Plantilla, Tema, TokenTema, VersionPagina
from .serializers import (
    AdoptarPlantillaSerializer,
    BloqueSerializer,
    PaginaPublicaSerializer,
    PaginaSerializer,
    PlantillaSerializer,
    TemaSerializer,
    TokenTemaSerializer,
    VersionPaginaSerializer,
)


# ==========================================================================
# 1. EL VISITANTE
# ==========================================================================
class PaginaPublicaView(ExigeNegocioMixin, APIView):
    """
    La composición de una ruta de la tienda.

    Es la petición que hace el servidor de Next en cada visita, así que decide
    el HTML que ve el rastreador: se responde lo PUBLICADO y nada más.

    `?borrador=1` devuelve el borrador, pero solo a quien puede editarlo. Sin
    esa comprobación, cualquiera podría leer los cambios sin publicar de
    cualquier tienda cambiando un parámetro.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        ruta = request.query_params.get("ruta") or "/"
        pagina = Pagina.objects.filter(ruta=ruta, activa=True).first()
        if pagina is None:
            raise NotFound("Esta tienda no tiene esa página.")

        quiere_borrador = request.query_params.get("borrador") in ("1", "true")
        puede_editar = bool(
            request.user
            and request.user.is_authenticated
            and EsStaff().has_permission(request, self)
        )

        return Response(
            PaginaPublicaSerializer(
                pagina, context={"borrador": quiere_borrador and puede_editar}
            ).data
        )


class RutasPublicasView(ExigeNegocioMixin, APIView):
    """
    Las rutas publicadas de esta tienda.

    Next las necesita para generar estáticamente las páginas libres; sin este
    listado tendría que adivinarlas o renderizarlas todas bajo demanda.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        rutas = (
            Pagina.objects.filter(
                activa=True, versiones__estado=VersionPagina.Estado.PUBLICADA
            )
            .values_list("ruta", flat=True)
            .distinct()
        )
        return Response({"rutas": sorted(rutas)})


# ==========================================================================
# 2. EL NEGOCIO — edición de su propia tienda
# ==========================================================================
class PaginaViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """Las páginas del negocio de esta petición, y solo las suyas."""

    serializer_class = PaginaSerializer
    permission_classes = [EsStaff]
    # `modelo` y no `queryset`: el atributo de clase se evalúa al importar, y
    # el manager con ámbito lanzaría `SinTenantEnContexto` en el arranque.
    modelo = Pagina

    def get_queryset(self):
        # El prefetch va aquí por lo mismo, y usa `all_tenants` porque ya viene
        # acotado por la clave foránea a una página que sí lo está.
        return super().get_queryset().prefetch_related(
            Prefetch(
                "versiones",
                queryset=VersionPagina.all_tenants.filter(
                    estado__in=[
                        VersionPagina.Estado.BORRADOR,
                        VersionPagina.Estado.PUBLICADA,
                    ]
                ),
            )
        )

    @action(detail=True, methods=["get", "patch"])
    def borrador(self, request, pk=None):
        """
        El borrador de una página: se lee y se guarda aquí.

        Si no existe se crea sembrado con lo publicado, no en blanco: quien
        entra a editar quiere retocar su tienda, no empezarla de cero.
        """
        pagina = self.get_object()
        borrador = servicio.obtener_borrador(pagina, autor=request.user)

        if request.method == "GET":
            return Response(VersionPaginaSerializer(borrador).data)

        entrada = VersionPaginaSerializer(borrador, data=request.data, partial=True)
        entrada.is_valid(raise_exception=True)
        entrada.save(autor=request.user)
        return Response(entrada.data)

    @action(detail=True, methods=["post"])
    def publicar(self, request, pk=None):
        pagina = self.get_object()
        version = servicio.publicar(pagina, autor=request.user)
        return Response(VersionPaginaSerializer(version).data)

    @action(detail=True, methods=["get"])
    def versiones(self, request, pk=None):
        """
        El historial completo, archivadas incluidas.

        Se consulta el modelo y NO `pagina.versiones`: el `get_queryset` de
        arriba prefetchea las versiones limitadas a borrador y publicada, y el
        gestor relacionado sirve de esa caché — así que `pagina.versiones`
        heredaría ese filtro y este endpoint no enseñaría nunca una versión
        archivada, que es justo para lo que existe.
        """
        pagina = self.get_object()
        return Response(
            VersionPaginaSerializer(
                VersionPagina.objects.filter(pagina=pagina), many=True
            ).data
        )

    @action(detail=True, methods=["post"], url_path="restaurar/(?P<numero>[0-9]+)")
    def restaurar(self, request, pk=None, numero=None):
        """
        Trae una versión vieja al borrador.

        No publica: deshacer no puede cambiar lo que los visitantes ven sin que
        alguien lo confirme mirando la vista previa.
        """
        pagina = self.get_object()
        # Por el mismo motivo que en `versiones`: la versión que se restaura
        # está archivada, y el gestor relacionado viene prefiltrado.
        version = VersionPagina.objects.filter(pagina=pagina, numero=numero).first()
        if version is None:
            raise NotFound("No existe esa versión.")
        borrador = servicio.restaurar(pagina, version, autor=request.user)
        return Response(VersionPaginaSerializer(borrador).data)


class AdoptarPlantillaView(ExigeNegocioMixin, APIView):
    """Arranca la tienda de un negocio desde una plantilla de Crynex."""

    permission_classes = [EsStaff]

    def post(self, request):
        entrada = AdoptarPlantillaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        plantilla = Plantilla.objects.get(slug=datos["plantilla"])
        paginas = servicio.adoptar_plantilla(
            request.tenant,
            plantilla,
            autor=request.user,
            publicar_ya=datos["publicar"],
        )

        # El tema se copia a la configuración del negocio en vez de quedar
        # referenciado: si el negocio apuntara al tema, que Crynex lo retocara
        # le cambiaría los colores de la tienda sin avisar.
        if datos["aplicar_tema"] and plantilla.tema:
            config = StoreSettings.get_para(request.tenant)
            campos = []
            for campo, valor in (plantilla.tema.valores or {}).items():
                # Una clave que el modelo no tiene se ignora en silencio: un
                # tema puede proponer un token que esta versión todavía no
                # entiende, y eso no es motivo para no aplicar los demás.
                if hasattr(config, campo):
                    setattr(config, campo, valor)
                    campos.append(campo)
            if campos:
                config.save(update_fields=campos)

        return Response(
            {
                "plantilla": plantilla.nombre,
                "paginas": [p.ruta for p in paginas],
                "publicadas": datos["publicar"],
            },
            status=201,
        )


# ==========================================================================
# 3. CRYNEX — el catálogo global
# ==========================================================================
class BaseDeCatalogo(viewsets.ModelViewSet):
    """
    El catálogo del motor no pertenece a ningún negocio.

    Es global como los planes, y por la misma razón lleva el mismo guardia:
    administrar una tienda no puede dar acceso a los bloques y plantillas que
    usan todas las demás.
    """

    permission_classes = [EsStaffDePlataforma]
    pagination_class = None


class BloqueViewSet(BaseDeCatalogo):
    serializer_class = BloqueSerializer
    queryset = Bloque.objects.all()


class TokenTemaViewSet(BaseDeCatalogo):
    """
    Las perillas del aspecto: qué se puede ajustar de una tienda.

    Es al tema lo que el catálogo de bloques es a la composición. Crear un token
    aquí obliga a que la hoja de estilos de la tienda consuma su variable: uno
    que nadie lee se configura y no cambia nada.
    """

    serializer_class = TokenTemaSerializer
    queryset = TokenTema.objects.all()


class TemaViewSet(BaseDeCatalogo):
    serializer_class = TemaSerializer
    queryset = Tema.objects.all()


class PlantillaViewSet(BaseDeCatalogo):
    serializer_class = PlantillaSerializer
    queryset = Plantilla.objects.select_related("tema")


class CatalogoDeBloquesView(ExigeNegocioMixin, APIView):
    """
    Los bloques disponibles, para el constructor del negocio.

    Es de solo lectura y separado del ViewSet de Crynex a propósito: el negocio
    necesita saber qué puede colocar, pero crear bloques es cambiar lo que la
    plataforma ofrece y eso no le toca.
    """

    permission_classes = [EsStaff]

    def get(self, request):
        bloques = Bloque.objects.filter(activo=True)
        return Response(
            {
                "bloques": BloqueSerializer(bloques, many=True).data,
                "plantillas": PlantillaSerializer(
                    Plantilla.objects.filter(activa=True).select_related("tema"),
                    many=True,
                ).data,
                "temas": TemaSerializer(
                    Tema.objects.filter(activo=True), many=True
                ).data,
                "tokens": TokenTemaSerializer(
                    TokenTema.objects.filter(activo=True), many=True
                ).data,
            }
        )
