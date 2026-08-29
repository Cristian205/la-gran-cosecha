"""
Los planes de Crynex y lo que cada uno concede.

Aquí vive la matriz que administra la plataforma: qué permisos existen, qué
plan los incluye y qué límites impone. Es lo que decide qué ve y qué puede
hacer cada empresa, y por eso NO pertenece a ningún negocio: es la única parte
del sistema deliberadamente global.

El reparto de responsabilidades importa:

* `PermisoDisponible` es el catálogo de lo que se puede conceder. Antes era una
  constante de Python (`accounts/permisos.py`); como fila se puede añadir un
  módulo nuevo sin desplegar.
* `Plan` dice qué permisos incluye y qué límites pone.
* `Subscription` ata un negocio a un plan.
* `Membership.permisos` (en tenancy) sigue diciendo qué le toca a cada persona
  DENTRO de su negocio. El plan acota el techo; la pertenencia reparte por
  debajo de él.
"""
from django.core.validators import MinValueValidator
from django.db import models


class PermisoDisponible(models.Model):
    """
    Un permiso que la plataforma puede ofrecer a las empresas.

    El `codename` mantiene el formato de Django ('catalog.change_producto')
    porque es el que ya usan `requiere_permiso()` y el panel de cada negocio.
    """

    modulo = models.CharField(
        max_length=60, help_text="Agrupa los permisos en el panel: Catálogo, Pedidos…"
    )
    codename = models.CharField(max_length=100, unique=True)
    etiqueta = models.CharField(
        max_length=150, help_text="Lo que lee el dueño del negocio, no el codename."
    )
    descripcion = models.CharField(max_length=255, blank=True)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(
        default=True,
        help_text="Desactivarlo lo oculta en todos los negocios, sin borrar nada.",
    )

    class Meta:
        db_table = "billing_permisodisponible"
        verbose_name = "Permiso disponible"
        verbose_name_plural = "Permisos disponibles"
        ordering = ["modulo", "orden", "etiqueta"]

    def __str__(self):
        return f"{self.modulo} · {self.etiqueta}"


class Plan(models.Model):
    """
    Lo que una empresa contrata: qué puede hacer y hasta dónde.

    Los límites van en un JSON y no en columnas porque cambian con el producto:
    añadir «máximo de campañas» cuando exista el motor de marketing no debería
    costar una migración sobre una tabla que consulta cada petición.
    """

    LIMITES_POR_DEFECTO = {
        "max_productos": 100,
        "max_usuarios": 3,
        "max_dominios": 1,
        "max_almacenamiento_mb": 512,
    }

    slug = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)

    precio_mensual = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    moneda = models.CharField(max_length=3, default="COP")

    # Los codenames que este plan incluye. La verdad de qué existe la tiene
    # `PermisoDisponible`; aquí solo se marca cuáles entran.
    permisos = models.JSONField(default=list, blank=True)
    limites = models.JSONField(default=dict, blank=True)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    # El plan en el que aterriza un negocio recién creado.
    es_predeterminado = models.BooleanField(default=False)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_plan"
        ordering = ["orden", "precio_mensual"]
        constraints = [
            # Dos planes por defecto dejarían el alta de un negocio a suerte
            # del orden de la consulta.
            models.UniqueConstraint(
                fields=["es_predeterminado"],
                condition=models.Q(es_predeterminado=True),
                name="billing_un_solo_plan_por_defecto",
            )
        ]

    def __str__(self):
        return self.nombre

    def limite(self, clave: str):
        """
        El límite efectivo, con el valor por defecto si el plan no lo fija.

        `None` significa «sin límite» y es un valor legítimo: el plan más alto
        no tiene tope de productos.
        """
        if clave in (self.limites or {}):
            return self.limites[clave]
        return self.LIMITES_POR_DEFECTO.get(clave)

    def incluye(self, codename: str) -> bool:
        return codename in (self.permisos or [])


class Subscription(models.Model):
    """
    Qué plan tiene contratado un negocio, y desde cuándo.

    Es 1:1 con el negocio: un negocio tiene un plan a la vez. El histórico de
    cambios no se guarda aquí; cuando haga falta facturar de verdad será una
    tabla aparte, porque son preguntas distintas («qué puede hacer hoy» y «qué
    se le cobró en marzo»).
    """

    ESTADOS = [
        ("PRUEBA", "En prueba"),
        ("ACTIVA", "Activa"),
        ("VENCIDA", "Vencida"),
        ("CANCELADA", "Cancelada"),
    ]

    tenant = models.OneToOneField(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="suscripcion"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="suscripciones")

    estado = models.CharField(max_length=20, choices=ESTADOS, default="PRUEBA")
    fecha_inicio = models.DateField(auto_now_add=True)
    fecha_fin = models.DateField(
        null=True, blank=True, help_text="Vacío = sin fecha de término."
    )

    # Concesiones puntuales a un negocio, por encima de su plan. Evita tener
    # que inventar un plan nuevo para un solo cliente que negoció algo.
    limites_extra = models.JSONField(default=dict, blank=True)

    notas = models.TextField(blank=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_subscription"
        verbose_name = "Suscripción"
        verbose_name_plural = "Suscripciones"
        ordering = ["tenant__nombre"]

    def __str__(self):
        return f"{self.tenant} · {self.plan}"

    @property
    def vigente(self) -> bool:
        return self.estado in ("PRUEBA", "ACTIVA")

    def limite(self, clave: str):
        """Lo pactado con este negocio en concreto; si no, lo de su plan."""
        if clave in (self.limites_extra or {}):
            return self.limites_extra[clave]
        return self.plan.limite(clave)

    def permisos_disponibles(self) -> list[str]:
        """
        Los permisos que este negocio puede repartir entre su gente.

        Es la intersección de dos cosas: lo que su plan incluye y lo que la
        plataforma tiene activo. Si Crynex retira un módulo, desaparece de
        todos los negocios sin tocar ningún plan.
        """
        if not self.vigente:
            return []
        activos = set(
            PermisoDisponible.objects.filter(activo=True).values_list(
                "codename", flat=True
            )
        )
        return sorted(activos.intersection(self.plan.permisos or []))
