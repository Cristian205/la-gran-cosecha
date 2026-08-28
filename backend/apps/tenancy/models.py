"""
Los tres modelos que sostienen la plataforma multiempresa.

Ninguno de los modelos de negocio los usa todavía: eso es la fase 2. Aquí solo
se define el vocabulario — Tenant, Domain, Membership — y la clase abstracta
que las demás apps heredarán.
"""
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .context import SinTenantEnContexto
from .managers import ManagerSinAmbito, TenantManager


# ==========================================================================
# 1. TENANT — el negocio
# ==========================================================================
class Tenant(models.Model):
    """
    Un negocio dentro de la plataforma. La Gran Cosecha es el primero, no un
    caso especial: no existe ni existirá ninguna rama de código que lo
    distinga de una perfumería.
    """

    ESTADOS = [
        ("PRUEBA", "En prueba"),
        ("ACTIVO", "Activo"),
        ("SUSPENDIDO", "Suspendido"),
        ("ARCHIVADO", "Archivado"),
    ]

    # Identificador estable de por vida. Es el que se usa en las rutas de
    # Cloudflare R2: el slug puede renombrarse y dejaría los archivos
    # huérfanos, el uuid no cambia nunca.
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    slug = models.SlugField(
        max_length=63,  # el máximo de una etiqueta DNS: el slug es el subdominio
        unique=True,
        help_text="Identificador en la URL: <slug>.plataforma.com",
    )
    nombre = models.CharField(max_length=150)

    estado = models.CharField(max_length=20, choices=ESTADOS, default="PRUEBA")

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenancy_tenant"
        verbose_name = "Negocio"
        verbose_name_plural = "Negocios"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    @property
    def esta_operativo(self) -> bool:
        """Un tenant suspendido o archivado no atiende peticiones."""
        return self.estado in ("PRUEBA", "ACTIVO")


# ==========================================================================
# 2. DOMAIN — por dónde se llega al negocio
# ==========================================================================
class Domain(models.Model):
    """
    Cada hostname que resuelve a un tenant: primero el subdominio de la
    plataforma, después el dominio propio del negocio.

    Existe desde la fase 1, aunque solo haya subdominios, porque resolver el
    tenant por host desde el principio es lo que hace que añadir dominios
    propios más adelante sea aditivo en vez de una reescritura del enrutado.
    """

    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="dominios"
    )
    hostname = models.CharField(max_length=253, unique=True)

    # Decide la URL canónica del SEO: los demás hostnames redirigen a este.
    es_primario = models.BooleanField(default=False)
    # Los dominios propios se verifican con un registro TXT antes de servirlos.
    verificado = models.BooleanField(default=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenancy_domain"
        verbose_name = "Dominio"
        verbose_name_plural = "Dominios"
        ordering = ["-es_primario", "hostname"]
        constraints = [
            # Sin esto, dos dominios primarios dejarían el canonical ambiguo
            # y el SEO del negocio partido entre dos URLs.
            models.UniqueConstraint(
                fields=["tenant"],
                condition=models.Q(es_primario=True),
                name="tenancy_un_solo_dominio_primario_por_tenant",
            )
        ]

    def __str__(self):
        return self.hostname

    def save(self, *args, **kwargs):
        # Los hostnames no distinguen mayúsculas, pero una columna de texto sí:
        # sin normalizar, "Negocio.com" y "negocio.com" serían dos filas y la
        # resolución fallaría según cómo escribiera el navegador la cabecera.
        self.hostname = self.hostname.strip().lower()
        super().save(*args, **kwargs)


# ==========================================================================
# 3. MEMBERSHIP — quién trabaja en qué negocio
# ==========================================================================
class Membership(models.Model):
    """
    La pertenencia de una persona a un negocio, con su rol y sus permisos.

    Es la pieza que sustituye a `Usuario.rol_usuario` y a `user_permissions` de
    Django. Ese `user_permissions` es global y no puede expresar "edita
    productos en La Gran Cosecha pero no en la perfumería" — hoy el staff de
    cualquier negocio pasa toda verificación de permiso de cualquier otro.

    El `Usuario` sigue siendo identidad de plataforma, con email único global,
    para que una misma persona pueda llevar varios negocios con una sola cuenta.
    """

    ROLES = [
        ("OWNER", "Dueño"),
        ("ADMIN", "Administrador"),
        ("MANAGER", "Gerente"),
        ("SALES", "Ventas"),
        ("STAFF", "Personal"),
    ]

    # Roles que no necesitan permisos explícitos: el dueño de la cuenta no se
    # restringe a sí mismo. Conserva la semántica de `es_owner()` actual.
    ROLES_CON_ACCESO_TOTAL = ("OWNER", "ADMIN")

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="memberships"
    )
    rol = models.CharField(max_length=20, choices=ROLES, default="STAFF")

    # Permisos puntuales para los roles que no tienen acceso total. Se guardan
    # como lista de codenames ("catalog.change_producto") reutilizando el
    # catálogo curado que ya existe en accounts/permisos.py. Es una lista JSON
    # y no una tabla a propósito: normalizar solo se justifica cuando "crear
    # roles a medida" sea una función que se vende.
    permisos = models.JSONField(default=list, blank=True)

    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenancy_membership"
        verbose_name = "Pertenencia"
        verbose_name_plural = "Pertenencias"
        ordering = ["tenant__nombre", "usuario__nombre_usuario"]
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "tenant"], name="tenancy_una_pertenencia_por_negocio"
            )
        ]

    def __str__(self):
        return f"{self.usuario} · {self.tenant} ({self.get_rol_display()})"

    def clean(self):
        super().clean()
        if not isinstance(self.permisos, list):
            raise ValidationError({"permisos": "Debe ser una lista de codenames."})

    @property
    def tiene_acceso_total(self) -> bool:
        return self.rol in self.ROLES_CON_ACCESO_TOTAL

    def tiene_permiso(self, codename: str) -> bool:
        """
        Sustituye a `usuario.has_perm()` dentro del ámbito de un negocio.

        La diferencia con el de Django es justamente la que hacía falta: aquí
        el permiso está atado al tenant, no a la persona en abstracto.
        """
        if not self.activo:
            return False
        if self.tiene_acceso_total:
            return True
        return codename in (self.permisos or [])


# ==========================================================================
# BASES ABSTRACTAS PARA LOS MODELOS DE NEGOCIO
# ==========================================================================
class CampoTenantMixin(models.Model):
    """
    Solo la columna y su índice. Nada más.

    Es lo que heredan los modelos de negocio en la fase 2. Deliberadamente NO
    cambia el manager por defecto: hacerlo en la misma fase que la migración de
    datos dejaría la aplicación sin servicio, porque los managers relacionados
    de Django (`pedido.detalles.all()`) se derivan del manager por defecto del
    modelo y empezarían a exigir un contexto que casi ningún camino de código
    declara todavía. Ese cambio es la fase 3, y consiste en pasar de heredar
    esta clase a heredar `ModeloConTenant`.

    La columna se guarda incluso donde es derivable por join —`DetallePedido`
    podría sacarla de su pedido— porque la RLS de PostgreSQL evalúa su política
    sobre la fila que está leyendo, sin recorrer la jerarquía, y porque un
    índice compuesto `(tenant_id, …)` responde mejor que subir por ella.
    """

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s",
        editable=False,  # nunca se elige desde un formulario ni un serializer
    )

    class Meta:
        abstract = True

    # Nombre del FK del que esta fila hereda su negocio cuando es hija de otra
    # (una línea hereda de su pedido, una presentación de su producto). Es la
    # vía preferente: no depende del contexto de la petición, así que acierta
    # también dentro de una señal, un comando o una tarea de fondo.
    tenant_heredado_de = None

    def asegurar_tenant(self):
        """
        Rellena `tenant` si nadie lo puso, en tres intentos y por ese orden.

        1. Del padre declarado en `tenant_heredado_de`. Es el más fiable:
           una línea de pedido es del negocio de su pedido, siempre.
        2. Del contexto de la petición, que resuelve el middleware.
        No hay un tercer intento. El puente de la fase 2 —«si solo hay un
        negocio, asígnalo a ese»— se retira aquí: adivinar es precisamente el
        fallo abierto contra el que se diseñó todo esto, y mantenerlo
        convertiría la suite de aislamiento en una promesa falsa.
        """
        if self.tenant_id is not None:
            return

        if self.tenant_heredado_de:
            padre = getattr(self, self.tenant_heredado_de, None)
            if padre is not None and padre.tenant_id is not None:
                self.tenant_id = padre.tenant_id
                return

        from .context import hay_ambito_declarado, obtener_tenant_actual  # noqa: PLC0415

        tenant = obtener_tenant_actual() if hay_ambito_declarado() else None
        if tenant is None:
            raise SinTenantEnContexto(
                f"Se intentó guardar un {type(self).__name__} sin saber de qué "
                f"negocio es. Declara el ámbito con `with usar_tenant(t):` o "
                f"asigna `tenant=` explícitamente."
            )
        self.tenant = tenant

    def save(self, *args, **kwargs):
        self.asegurar_tenant()
        super().save(*args, **kwargs)


class ModeloConTenant(CampoTenantMixin):
    """
    La columna más el ámbito automático. Es el destino de la fase 3.

    La combinación de managers es deliberada y frágil de reproducir a mano:

    * `objects` va primera, así que es `_default_manager` — lo que usan los
      formularios, el admin y los ViewSets. Va con ámbito.
    * `base_manager_name = "all_tenants"` hace que `_base_manager` sea el SIN
      ámbito. Es el que Django usa internamente para recorrer claves foráneas
      y para los borrados en cascada; si dependiera del contexto de la
      petición, `pedido.cliente` reventaría dentro de una tarea de fondo.
    """

    objects = TenantManager()
    all_tenants = ManagerSinAmbito()

    class Meta:
        abstract = True
        base_manager_name = "all_tenants"
