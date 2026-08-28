"""
Capa 2 de las tres del aislamiento: la vista.

Duplica a propósito lo que ya hace el manager. No es redundancia inútil: el
manager se elude con `.raw()`, con un `get_queryset()` sobrescrito o con un
`Manager` distinto declarado en el modelo, y esta capa sigue en pie. La tercera
—la RLS de PostgreSQL— cubre lo que se le escape a las dos.

Lo que aporta aquí que el manager no puede:

* traducir «no hay negocio en esta dirección» a un 404 limpio, en vez de dejar
  que el `SinTenantEnContexto` del manager salga como un 500;
* comprobar que quien llama pertenece al negocio que dice — el agujero central
  del código anterior a esta fase, donde `is_staff` bastaba para pasar
  cualquier verificación de cualquier negocio;
* asignar el tenant al crear, sin aceptarlo nunca del cuerpo de la petición.
"""
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission


class ExigePertenencia(BasePermission):
    """
    Un usuario autenticado solo opera dentro de los negocios a los que
    pertenece.

    Las peticiones anónimas pasan: son la tienda pública, y a esas ya las
    limitan los permisos de lectura de cada vista. Lo que esta clase impide es
    que alguien con sesión iniciada en un negocio alcance los datos de otro
    cambiando el slug de la cabecera o apuntando a otro dominio.
    """

    message = "No tienes acceso a este negocio."

    def has_permission(self, request, view):
        usuario = request.user
        if not (usuario and usuario.is_authenticated):
            return True

        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return True  # sin negocio no hay nada que proteger; la vista dará 404

        if usuario.is_superuser:
            return True

        from .models import Membership  # noqa: PLC0415 — evita el import circular

        return Membership.objects.filter(
            usuario=usuario, tenant=tenant, activo=True
        ).exists()


class TenantScopedMixin:
    """
    Para mezclar con cualquier `ViewSet` de DRF que exponga datos de negocio.

    Basta con anteponerlo en la lista de bases. Declarar `modelo = X` sustituye
    al atributo `queryset` de clase que DRF espera: ese se evalúa al importar el
    módulo, fuera de toda petición, y con el manager acotado eso sería un
    `SinTenantEnContexto` durante el arranque de Django.
    """

    modelo = None

    def initial(self, request, *args, **kwargs):
        """
        Resuelve el negocio al principio de CADA petición.

        Va aquí y no solo en `get_queryset()` porque varias vistas sobrescriben
        ese método entero —para anotar, ordenar o filtrar— y perderían la
        comprobación sin que se note. `initial()` lo llama DRF una vez por
        petición, antes de despachar, y ninguna vista lo pisa. El resultado es
        un 404 uniforme cuando la dirección no corresponde a ningún negocio, en
        vez de un 500 con el `SinTenantEnContexto` del manager asomando.
        """
        super().initial(request, *args, **kwargs)
        self.obtener_tenant()

    def check_permissions(self, request):
        """
        La pertenencia se exige SIEMPRE, además de lo que pida cada vista.

        Va aquí y no en `get_permissions()` porque varias vistas sobrescriben
        ese método entero para elegir permiso según la acción, y una lista
        devuelta ahí se saltaría la comprobación de negocio sin que se note.
        `check_permissions` lo llama DRF una vez por petición y nadie lo pisa.
        """
        super().check_permissions(request)
        if not ExigePertenencia().has_permission(request, self):
            self.permission_denied(request, message=ExigePertenencia.message)

    def obtener_tenant(self):
        """
        El negocio de esta petición, o 404 si el host no resuelve a ninguno.

        404 y no 400: si la dirección no corresponde a ningún negocio, el
        recurso sencillamente no existe. Y 404 y no 403 para un objeto ajeno,
        porque un 403 confirmaría que existe.
        """
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            raise NotFound("No hay ningún negocio asociado a esta dirección.")
        return tenant

    def get_queryset(self):
        """
        Vuelve a acotar lo que el manager ya acotó.

        El orden importa: se resuelve el tenant ANTES de llamar a `super()`,
        porque construir el queryset ya dispara el manager con ámbito y sin
        contexto lanzaría `SinTenantEnContexto` — un 500 en vez del 404 que
        corresponde.
        """
        tenant = self.obtener_tenant()
        if self.modelo is not None and getattr(self, "queryset", None) is None:
            qs = self.modelo._default_manager.all()
        else:
            qs = super().get_queryset()
        if not _tiene_tenant(qs.model):
            return qs
        return qs.filter(tenant=tenant)

    def perform_create(self, serializer):
        """
        El tenant lo pone el servidor, siempre.

        Nunca `serializer.validated_data["tenant"]`: aceptar el tenant del
        cuerpo es asignación masiva, y es el primer sitio donde alguien
        intentaría escribir en el negocio del vecino.
        """
        tenant = self.obtener_tenant()
        if _tiene_tenant(serializer.Meta.model):
            serializer.save(tenant=tenant)
        else:
            serializer.save()

    def get_serializer_context(self):
        contexto = super().get_serializer_context()
        contexto["tenant"] = getattr(self.request, "tenant", None)
        return contexto


def _tiene_tenant(modelo) -> bool:
    return any(campo.name == "tenant" for campo in modelo._meta.fields)
