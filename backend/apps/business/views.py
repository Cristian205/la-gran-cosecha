"""
Las rutas del perfil, en dos públicos separados por prefijo.

    /api/business/…    el negocio: su perfil, sus módulos, su alta guiada
    /api/platform/…    Crynex: los presets de todos

La separación se lee en la URL a propósito. Un preset lo administra la
plataforma y lo consumen todos los negocios; mezclarlos bajo el mismo prefijo
haría que un permiso mal puesto expusiera la configuración comercial entera.
"""
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Producto
from apps.billing.permisos import EsStaffDePlataforma
from apps.common.permissions import EsAdministrador, EsStaff
from apps.tenancy.viewsets import ExigeNegocioMixin

from . import aplicar as servicio
from . import seleccion
from .models import PerfilNegocio, Preset, TenantModulo
from .serializers import (
    AplicarPresetSerializer,
    CambiarModuloSerializer,
    ModuloSerializer,
    PerfilNegocioSerializer,
    PresetSerializer,
    RespuestasAltaSerializer,
    SugerenciaSerializer,
    catalogo_de_capacidades,
    catalogo_de_perfil_pos,
)


def _perfil_de(tenant) -> PerfilNegocio:
    """
    El perfil del negocio, creándolo si la señal no llegó a hacerlo.

    El `get_or_create` cubre a los negocios dados de alta ANTES de que esta app
    existiera: para ellos la señal nunca corrió, y sin esto el panel les daría
    un 404 en la pantalla de configuración.
    """
    perfil, _ = PerfilNegocio.objects.get_or_create(tenant=tenant)
    return perfil


class PerfilNegocioView(ExigeNegocioMixin, APIView):
    """El perfil del negocio de la petición. Nunca el de otro."""

    permission_classes = [EsStaff]

    def get(self, request):
        perfil = _perfil_de(self.obtener_tenant())
        return Response(
            {
                **PerfilNegocioSerializer(perfil).data,
                # El catálogo viaja con el perfil para que el panel pueda pintar
                # los interruptores con su nombre y su explicación sin una
                # segunda petición ni una copia de las etiquetas en el frontend.
                "catalogo_capacidades": catalogo_de_capacidades(),
                "catalogo_perfil_pos": catalogo_de_perfil_pos(),
            }
        )

    def patch(self, request):
        # Ajustar el perfil cambia cómo se comporta el negocio entero, así que
        # es cosa del dueño o de un administrador, no de cualquiera con acceso
        # al panel.
        if not EsAdministrador().has_permission(request, self):
            return Response(
                {"detail": "Solo el dueño o un administrador puede cambiar el perfil."},
                status=status.HTTP_403_FORBIDDEN,
            )

        perfil = _perfil_de(self.obtener_tenant())
        serializer = PerfilNegocioSerializer(perfil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ModulosView(ExigeNegocioMixin, APIView):
    """
    Qué módulos tiene el negocio, y cuáles quiere encendidos.

    Devuelve TODOS los del catálogo, incluidos los que su plan no cubre, con
    `disponible: false`. Ocultarlos sería más limpio y peor: el cliente no
    puede pedir lo que no sabe que existe.
    """

    permission_classes = [EsStaff]

    def get(self, request):
        tenant = self.obtener_tenant()
        del_plan = servicio.modulos_del_plan(tenant)
        encendidos = dict(
            TenantModulo.objects.filter(tenant=tenant).values_list("modulo__slug", "activo")
        )

        filas = [
            {
                "slug": m.slug,
                "nombre": m.nombre,
                "descripcion": m.descripcion,
                "categoria": m.categoria,
                "icono": m.icono,
                "disponible": m.slug in del_plan,
                # Sin fila propia, un módulo cubierto por el plan cuenta como
                # encendido: es lo que el cliente espera de algo que ya paga.
                "activo": encendidos.get(m.slug, m.slug in del_plan),
            }
            for m in Producto.objects.filter(estado="ACTIVO")
        ]
        return Response(ModuloSerializer(filas, many=True).data)

    def post(self, request):
        if not EsAdministrador().has_permission(request, self):
            return Response(
                {"detail": "Solo el dueño o un administrador puede cambiar los módulos."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entrada = CambiarModuloSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        tenant = self.obtener_tenant()
        slug = entrada.validated_data["slug"]

        if entrada.validated_data["activo"] and slug not in servicio.modulos_del_plan(tenant):
            # Encender lo que el plan no cubre daría una activación que no
            # sirve de nada: `modulos_activos` la descartaría igual. Mejor
            # decirlo, que además es la conversación comercial.
            return Response(
                {"detail": "Tu plan no incluye este módulo todavía."},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        modulo = Producto.objects.get(slug=slug)
        activacion, _ = TenantModulo.objects.get_or_create(
            tenant=tenant, modulo=modulo, defaults={"activado_por": request.user}
        )
        activacion.activo = entrada.validated_data["activo"]
        activacion.save(update_fields=["activo"])
        return self.get(request)


class AltaGuiadaView(ExigeNegocioMixin, APIView):
    """
    Las preguntas del alta y los presets que encajan con las respuestas.

    `GET` devuelve las preguntas; `POST` puntúa. Puntuar NO configura nada: la
    elección es de una persona, siempre. Un asistente que decide solo es
    imposible de corregir cuando se equivoca.
    """

    permission_classes = [EsStaff]

    def get(self, request):
        return Response(
            {
                "preguntas": seleccion.PREGUNTAS_DEL_ALTA,
                "sectores": [
                    {"slug": p.slug, "nombre": p.nombre, "icono": p.icono}
                    for p in Preset.objects.filter(activo=True)
                ],
            }
        )

    def post(self, request):
        entrada = RespuestasAltaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        tenant = self.obtener_tenant()

        candidatos = seleccion.sugerir(
            entrada.to_respuestas(),
            modulos_disponibles=servicio.modulos_del_plan(tenant),
        )
        return Response(SugerenciaSerializer(candidatos, many=True).data)


class AdoptarPresetView(ExigeNegocioMixin, APIView):
    """Adopta un preset: copia su configuración al negocio."""

    permission_classes = [EsStaff]

    def post(self, request):
        if not EsAdministrador().has_permission(request, self):
            return Response(
                {"detail": "Solo el dueño o un administrador puede configurar el negocio."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entrada = AplicarPresetSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        tenant = self.obtener_tenant()
        preset = Preset.objects.get(slug=entrada.validated_data["preset"])

        try:
            perfil = servicio.aplicar_preset(
                tenant,
                preset,
                usuario=request.user,
                respuestas=entrada.to_respuestas(),
                # Nunca desde aquí: reaplicar borra los ajustes del cliente, y
                # esa decisión es de plataforma, no un botón del panel.
                sobrescribir=False,
            )
        except servicio.YaTienePerfil as error:
            return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)

        return Response(PerfilNegocioSerializer(perfil).data)


# ==========================================================================
# NIVEL PLATAFORMA
# ==========================================================================
class PresetViewSet(viewsets.ModelViewSet):
    """
    El catálogo de presets, administrado desde el panel de Crynex.

    No lleva ámbito de negocio porque no es de ningún negocio: es de la
    plataforma, igual que `Plantilla` y `Plan`. Su permiso es el de staff de
    plataforma, que resuelve el router en `config/urls.py`.
    """

    serializer_class = PresetSerializer
    permission_classes = [EsStaffDePlataforma]
    # Sin paginar, como el resto del catálogo de plataforma: son una docena
    # de filas que el panel consume enteras, y paginarlas solo haría
    # desaparecer el preset número veintiuno.
    pagination_class = None
    queryset = Preset.objects.all()
    lookup_field = "slug"

    def perform_update(self, serializer):
        # La versión sube sola al editar. Que la manejara quien llama
        # garantizaría que alguien la olvidara, y entonces `preset_version_origen`
        # dejaría de decir nada.
        serializer.save(version=serializer.instance.version + 1)

    def destroy(self, request, *args, **kwargs):
        """
        Retirar un preset lo ARCHIVA. No lo borra.

        Es el mismo criterio que `Plan` y `Producto`: un preset que alguien
        adoptó ya no es solo un molde, es la procedencia de la configuración de
        un negocio real. Borrarlo pondría su `preset_origen` a NULL, el perfil
        pasaría a contar como «sin configurar» y el panel volvería a pedirle el
        alta guiada a un cliente que lleva meses trabajando.

        Archivado deja de ofrecerse a los negocios nuevos y no le cambia nada a
        nadie, que es exactamente lo que la pantalla promete al pulsar.
        """
        preset = self.get_object()
        preset.activo = False
        preset.save(update_fields=["activo"])
        return Response(PresetSerializer(preset).data, status=status.HTTP_200_OK)
