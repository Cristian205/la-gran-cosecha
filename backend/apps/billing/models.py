"""
El motor comercial de Crynex.

Aquí vive todo lo que la plataforma vende y todo lo que decide qué puede hacer
cada empresa. NO pertenece a ningún negocio: es la única parte del sistema
deliberadamente global.

La regla que ordena este módulo es que **ninguna decisión comercial se escribe
en código**. Ni los nombres de los planes, ni los precios, ni los límites, ni
qué recursos existen. Todo eso son filas que el Control Center administra. Lo
que sí vive en código son las reglas estructurales —qué es un plan, cómo se
resuelve un límite, quién puede tocarlo— porque cambiar eso no es una decisión
comercial sino una de arquitectura.

El reparto de responsabilidades:

* `Producto` es lo que Crynex comercializa: E-commerce, Inventario, CRM. Un
  cliente puede contratar unos y no otros.
* `PermisoDisponible` es la aplicación técnica: los codenames que el panel de
  cada negocio reparte entre su gente. Cada uno pertenece a un producto.
* `Caracteristica` es la aplicación comercial: lo que se promete en la tabla de
  precios y no es un permiso ("soporte prioritario", "acceso a la API").
* `TipoLimite` es el catálogo de recursos medibles. Existe para que añadir
  "vehículos" o "documentos" sea una fila y no una migración.
* `Plan` ata todo eso y `PrecioPlan` le pone precio: uno por moneda,
  periodicidad y periodo de vigencia, para que subir una tarifa no reescriba lo
  que se cobró el mes pasado.
* `Subscription` ata un negocio a un plan, y puede pactar excepciones por
  encima de él sin necesidad de inventar un plan para un solo cliente.
* `Membership.permisos` (en tenancy) sigue diciendo qué le toca a cada persona
  DENTRO de su negocio. El plan acota el techo; la pertenencia reparte por
  debajo de él.
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


# ==========================================================================
# Vocabulario comercial
# ==========================================================================
# Estas listas sí viven en código, y a propósito: una periodicidad nueva no es
# un dato, es un cálculo de prorrateo y de fecha de renovación que hay que
# escribir. Lo que el panel configura es cuál se usa, no cuáles existen.

class Periodicidad(models.TextChoices):
    UNICO = "UNICO", "Pago único"
    MENSUAL = "MENSUAL", "Mensual"
    BIMESTRAL = "BIMESTRAL", "Bimestral"
    TRIMESTRAL = "TRIMESTRAL", "Trimestral"
    SEMESTRAL = "SEMESTRAL", "Semestral"
    ANUAL = "ANUAL", "Anual"


#: Cuántos meses cubre cada periodicidad. Es lo que permite comparar un plan
#: anual con uno mensual —y calcular el MRR— sin repetir la tabla en el panel.
MESES_POR_PERIODO = {
    Periodicidad.UNICO: 0,
    Periodicidad.MENSUAL: 1,
    Periodicidad.BIMESTRAL: 2,
    Periodicidad.TRIMESTRAL: 3,
    Periodicidad.SEMESTRAL: 6,
    Periodicidad.ANUAL: 12,
}


class Moneda(models.TextChoices):
    COP = "COP", "Peso colombiano"
    USD = "USD", "Dólar estadounidense"
    EUR = "EUR", "Euro"


class EstadoComercial(models.TextChoices):
    """
    El ciclo de vida de cualquier cosa que se vende.

    `ARCHIVADO` no es `BORRADO`: un plan archivado deja de poder contratarse
    pero los clientes que lo tienen siguen exactamente igual. Borrarlo les
    quitaría los permisos de golpe, y además dejaría facturas apuntando a algo
    que ya no existe.
    """

    BORRADOR = "BORRADOR", "Borrador"
    ACTIVO = "ACTIVO", "Activo"
    ARCHIVADO = "ARCHIVADO", "Archivado"


# ==========================================================================
# 1. CATÁLOGO — qué vende Crynex
# ==========================================================================
class Producto(models.Model):
    """
    Una solución que Crynex comercializa.

    Es la entidad que faltaba: hasta ahora "Catálogo" o "Pedidos" eran una
    cadena de texto repetida en cada permiso, lo que hacía imposible decir que
    un producto tiene descripción, categoría o estado propios. Ahora es una
    fila, y añadir "CRM" al catálogo comercial no toca código.

    Un producto NO pertenece a ninguna empresa. Qué empresa lo tiene contratado
    se deduce de su plan, que es lo único que concede acceso.
    """

    slug = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)
    categoria = models.CharField(
        max_length=60,
        blank=True,
        help_text="Agrupa productos en el catálogo: Ventas, Operación, Datos…",
    )
    # Un nombre de icono, no un archivo: el panel resuelve el dibujo. Guardar
    # el SVG aquí ataría el catálogo comercial a una librería de iconos.
    icono = models.CharField(max_length=40, blank=True)

    estado = models.CharField(
        max_length=20, choices=EstadoComercial.choices, default=EstadoComercial.ACTIVO
    )
    orden = models.PositiveIntegerField(default=0)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_producto"
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre

    @property
    def activo(self) -> bool:
        return self.estado == EstadoComercial.ACTIVO


class PermisoDisponible(models.Model):
    """
    Un permiso que la plataforma puede ofrecer a las empresas.

    El `codename` mantiene el formato de Django ('catalog.change_producto')
    porque es el que ya usan `requiere_permiso()` y el panel de cada negocio.

    `modulo` sobrevive como etiqueta legible y se mantiene sincronizado con el
    nombre del producto: hay código y pantallas que agrupan por esa cadena, y
    quitarla de golpe rompería más de lo que ordenaría.
    """

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="permisos",
        null=True,
        blank=True,
        help_text="A qué solución de Crynex pertenece este permiso.",
    )
    modulo = models.CharField(
        max_length=60, help_text="Etiqueta del producto; se sincroniza con él."
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

    def save(self, *args, **kwargs):
        if self.producto_id and not self.modulo:
            self.modulo = self.producto.nombre
        super().save(*args, **kwargs)


class Caracteristica(models.Model):
    """
    Lo que un plan promete y no es un permiso.

    "Soporte prioritario" o "acceso a la API" son argumentos de venta que se
    marcan en la tabla de precios pero que ningún `requiere_permiso()` va a
    consultar. Mezclarlos con `PermisoDisponible` obligaría a inventar
    codenames falsos que no protegen nada, y a la larga alguien intentaría
    protegerlo con ellos.

    Se asocia a un producto cuando le pertenece; una característica
    transversal (soporte, SLA) lo deja vacío.
    """

    producto = models.ForeignKey(
        Producto,
        on_delete=models.SET_NULL,
        related_name="caracteristicas",
        null=True,
        blank=True,
    )
    codigo = models.SlugField(max_length=60, unique=True)
    nombre = models.CharField(max_length=120)
    descripcion = models.CharField(max_length=255, blank=True)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "billing_caracteristica"
        verbose_name = "Característica"
        verbose_name_plural = "Características"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre


class TipoLimite(models.Model):
    """
    Un recurso medible: usuarios, almacenamiento, pedidos, vehículos…

    Existe para que el catálogo de límites deje de ser un diccionario en
    Python. Antes, ofrecer "máximo de automatizaciones" exigía tocar
    `Plan.LIMITES_POR_DEFECTO` y desplegar; ahora es una fila, y todos los
    planes la heredan con su valor por defecto hasta que alguien la fije.

    `codigo` conserva el formato `max_*` que ya usan `Plan.limites` y
    `Subscription.limites_extra`, para no migrar los JSON existentes.
    """

    class Unidad(models.TextChoices):
        UNIDAD = "UNIDAD", "Unidades"
        MB = "MB", "Megabytes"
        PETICIONES = "PETICIONES", "Peticiones"

    codigo = models.SlugField(
        max_length=60, unique=True, help_text="La clave dentro de `Plan.limites`."
    )
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)
    unidad = models.CharField(
        max_length=20, choices=Unidad.choices, default=Unidad.UNIDAD
    )
    # Si el recurso se consume por periodo (pedidos al mes) o es un tope
    # absoluto (usuarios). Cambia cómo se lee, no cómo se guarda.
    por_periodo = models.BooleanField(
        default=False, help_text="Marca los que se reinician cada ciclo de facturación."
    )

    valor_por_defecto = models.IntegerField(
        null=True,
        blank=True,
        help_text="Lo que se aplica si un plan no lo fija. Vacío = sin límite.",
    )
    # Que el backend sepa medirlo. Un límite sin medición se puede configurar,
    # pero el panel lo dice en vez de dibujar una barra falsa.
    medido = models.BooleanField(
        default=False, help_text="Si la plataforma sabe cuánto se está consumiendo."
    )

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "billing_tipolimite"
        verbose_name = "Tipo de límite"
        verbose_name_plural = "Tipos de límite"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre


# ==========================================================================
# 2. PLANES Y PRECIOS
# ==========================================================================
class Plan(models.Model):
    """
    Lo que una empresa contrata: qué puede hacer y hasta dónde.

    Los límites van en un JSON y no en columnas porque cambian con el producto:
    añadir «máximo de campañas» cuando exista el motor de marketing no debería
    costar una migración sobre una tabla que consulta cada petición. Las claves
    de ese JSON son los `TipoLimite.codigo`, que sí son filas.

    El precio NO está aquí. Un plan tiene tantos precios como monedas y
    periodicidades se le pongan, y cada uno con sus fechas de vigencia: subir
    la tarifa en octubre no puede reescribir lo que se facturó en septiembre.

    Un plan no se edita para cambiarle el precio a los clientes que ya lo
    tienen: se duplica con `duplicar()`, que crea la versión siguiente y deja
    la anterior archivada pero intacta.
    """

    slug = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)

    # Los codenames que este plan incluye. La verdad de qué existe la tiene
    # `PermisoDisponible`; aquí solo se marca cuáles entran.
    permisos = models.JSONField(default=list, blank=True)
    caracteristicas = models.ManyToManyField(
        Caracteristica, related_name="planes", blank=True
    )
    limites = models.JSONField(default=dict, blank=True)

    estado = models.CharField(
        max_length=20, choices=EstadoComercial.choices, default=EstadoComercial.ACTIVO
    )
    orden = models.PositiveIntegerField(default=0)
    # El plan en el que aterriza un negocio recién creado.
    es_predeterminado = models.BooleanField(default=False)

    # --- versionado ---------------------------------------------------
    version = models.PositiveIntegerField(default=1)
    origen = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="versiones",
        null=True,
        blank=True,
        help_text="La versión anterior de la que salió este plan.",
    )

    # --- prueba gratuita ----------------------------------------------
    trial_dias = models.PositiveIntegerField(
        default=0, help_text="0 desactiva la prueba gratuita en este plan."
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_plan"
        ordering = ["orden", "nombre"]
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
        return self.nombre if self.version == 1 else f"{self.nombre} v{self.version}"

    @property
    def activo(self) -> bool:
        """Se conserva porque media docena de sitios preguntan justo esto."""
        return self.estado == EstadoComercial.ACTIVO

    # --- límites -------------------------------------------------------
    def limite(self, clave: str):
        """
        El límite efectivo, con el valor por defecto del catálogo si el plan no
        lo fija.

        `None` significa «sin límite» y es un valor legítimo: el plan más alto
        no tiene tope de productos. Por eso se comprueba la presencia de la
        clave y no su verdad.
        """
        if clave in (self.limites or {}):
            return self.limites[clave]
        tipo = TipoLimite.objects.filter(codigo=clave).first()
        return tipo.valor_por_defecto if tipo else None

    def incluye(self, codename: str) -> bool:
        return codename in (self.permisos or [])

    # --- productos -----------------------------------------------------
    def productos(self):
        """
        Las soluciones que este plan concede.

        Se deduce de los permisos y no se declara aparte a propósito: una lista
        editable de productos podría decir que el plan incluye CRM mientras
        ningún permiso de CRM está marcado, y el cliente vería un módulo que no
        puede abrir. Aquí solo hay una verdad.
        """
        if not self.permisos:
            return Producto.objects.none()
        return (
            Producto.objects.filter(
                permisos__codename__in=self.permisos, permisos__activo=True
            )
            .distinct()
            .order_by("orden", "nombre")
        )

    # --- precios -------------------------------------------------------
    def precio_vigente(
        self, moneda: str = Moneda.COP, periodicidad: str = Periodicidad.MENSUAL
    ):
        """El `PrecioPlan` que rige hoy para esa moneda y periodicidad."""
        return (
            self.precios.filter(moneda=moneda, periodicidad=periodicidad)
            .vigentes()
            .first()
        )

    def importe_mensual(self, moneda: str = Moneda.COP) -> Decimal:
        """
        Lo que este plan supone al mes, sea cual sea su periodicidad.

        Un plan que solo se vende anual también aporta MRR: se normaliza
        dividiendo por los meses que cubre. Sin esto, el MRR de la plataforma
        dependería de cómo prefiere pagar cada cliente.
        """
        mensual = self.precio_vigente(moneda, Periodicidad.MENSUAL)
        if mensual:
            return mensual.importe

        for precio in self.precios.filter(moneda=moneda).vigentes():
            meses = MESES_POR_PERIODO.get(precio.periodicidad, 0)
            if meses:
                return (precio.importe / meses).quantize(Decimal("0.01"))
        return Decimal("0")

    # --- versionado ----------------------------------------------------
    def duplicar(self, *, slug: str, nombre: str = "", nueva_version: bool = False):
        """
        Copia el plan con sus precios, límites y características.

        Es la operación que hace posible cambiar de tarifa sin tocar a quien ya
        compró: `nueva_version=True` deja el original archivado y numera la
        copia como la siguiente versión, de modo que los clientes antiguos
        siguen en la suya y los nuevos entran en la nueva.
        """
        copia = Plan.objects.create(
            slug=slug,
            nombre=nombre or self.nombre,
            descripcion=self.descripcion,
            permisos=list(self.permisos or []),
            limites=dict(self.limites or {}),
            estado=EstadoComercial.BORRADOR,
            orden=self.orden,
            es_predeterminado=False,
            version=self.version + 1 if nueva_version else 1,
            origen=self if nueva_version else None,
            trial_dias=self.trial_dias,
        )
        copia.caracteristicas.set(self.caracteristicas.all())
        for precio in self.precios.all():
            PrecioPlan.objects.create(
                plan=copia,
                moneda=precio.moneda,
                periodicidad=precio.periodicidad,
                importe=precio.importe,
                vigente_desde=precio.vigente_desde,
                vigente_hasta=precio.vigente_hasta,
            )
        if nueva_version:
            self.estado = EstadoComercial.ARCHIVADO
            self.save(update_fields=["estado"])
        return copia


class ConsultaPrecios(models.QuerySet):
    def vigentes(self, cuando=None):
        """Los precios que rigen en una fecha; por defecto, hoy."""
        dia = cuando or timezone.localdate()
        return self.filter(
            models.Q(vigente_desde__lte=dia),
            models.Q(vigente_hasta__isnull=True) | models.Q(vigente_hasta__gte=dia),
        ).order_by("-vigente_desde")


class PrecioPlan(models.Model):
    """
    Cuánto cuesta un plan, en una moneda, con una periodicidad y desde cuándo.

    Es una tabla y no cuatro columnas en `Plan` porque las tres cosas se
    combinan: Business mensual en pesos, Business anual en pesos y Business
    mensual en dólares son tres precios del mismo plan. Y porque un precio
    tiene historia: cuando sube, la fila vieja se cierra con `vigente_hasta` en
    vez de sobrescribirse, que es lo que permite que una factura de septiembre
    siga diciendo lo que se cobró en septiembre.
    """

    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="precios")

    moneda = models.CharField(max_length=3, choices=Moneda.choices, default=Moneda.COP)
    periodicidad = models.CharField(
        max_length=20, choices=Periodicidad.choices, default=Periodicidad.MENSUAL
    )
    importe = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )

    vigente_desde = models.DateField(default=timezone.localdate)
    vigente_hasta = models.DateField(
        null=True, blank=True, help_text="Vacío = sigue vigente."
    )

    notas = models.CharField(max_length=255, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    objects = ConsultaPrecios.as_manager()

    class Meta:
        db_table = "billing_precioplan"
        verbose_name = "Precio de plan"
        verbose_name_plural = "Precios de plan"
        ordering = ["plan", "moneda", "periodicidad", "-vigente_desde"]
        constraints = [
            # Dos precios abiertos para la misma combinación dejarían la tarifa
            # a suerte del orden de la consulta, que es exactamente el tipo de
            # error que solo se descubre en una factura.
            models.UniqueConstraint(
                fields=["plan", "moneda", "periodicidad", "vigente_desde"],
                name="billing_un_precio_por_combinacion_y_fecha",
            )
        ]

    def __str__(self):
        return f"{self.plan} · {self.importe} {self.moneda}/{self.periodicidad}"

    def clean(self):
        super().clean()
        if self.vigente_hasta and self.vigente_hasta < self.vigente_desde:
            raise ValidationError(
                {"vigente_hasta": "No puede terminar antes de empezar."}
            )

    @property
    def esta_vigente(self) -> bool:
        hoy = timezone.localdate()
        return self.vigente_desde <= hoy and (
            self.vigente_hasta is None or self.vigente_hasta >= hoy
        )


# ==========================================================================
# 3. SUSCRIPCIÓN — qué tiene contratado cada empresa
# ==========================================================================
class Subscription(models.Model):
    """
    Qué plan tiene contratado un negocio, y desde cuándo.

    Es 1:1 con el negocio: un negocio tiene un plan a la vez. El histórico de
    cambios no se guarda aquí; cuando haga falta facturar de verdad será una
    tabla aparte, porque son preguntas distintas («qué puede hacer hoy» y «qué
    se le cobró en marzo»).

    La moneda y la periodicidad se guardan en la suscripción y no se leen del
    plan: un cliente puede pagar Business anual en dólares y otro mensual en
    pesos, y eso es una condición del contrato, no del catálogo.
    """

    ESTADOS = [
        ("PRUEBA", "En prueba"),
        ("ACTIVA", "Activa"),
        ("PAUSADA", "Pausada"),
        ("VENCIDA", "Vencida"),
        ("CANCELADA", "Cancelada"),
    ]

    #: Los estados en que la empresa conserva lo que su plan concede.
    ESTADOS_VIGENTES = ("PRUEBA", "ACTIVA")

    tenant = models.OneToOneField(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="suscripcion"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="suscripciones")

    estado = models.CharField(max_length=20, choices=ESTADOS, default="PRUEBA")
    fecha_inicio = models.DateField(auto_now_add=True)
    fecha_fin = models.DateField(
        null=True, blank=True, help_text="Vacío = sin fecha de término."
    )

    # --- condiciones comerciales del contrato --------------------------
    moneda = models.CharField(max_length=3, choices=Moneda.choices, default=Moneda.COP)
    periodicidad = models.CharField(
        max_length=20, choices=Periodicidad.choices, default=Periodicidad.MENSUAL
    )
    #: Precio pactado con este cliente. Vacío = el de su plan. Es lo que
    #: permite cerrar un acuerdo especial sin inventar un plan de un solo uso.
    importe_pactado = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    fecha_fin_prueba = models.DateField(null=True, blank=True)

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
        return self.estado in self.ESTADOS_VIGENTES

    def limite(self, clave: str):
        """Lo pactado con este negocio en concreto; si no, lo de su plan."""
        if clave in (self.limites_extra or {}):
            return self.limites_extra[clave]
        return self.plan.limite(clave)

    def importe_mensual(self) -> Decimal:
        """
        Lo que este contrato aporta al MRR.

        Una suscripción que no está activa no aporta nada, aunque su plan tenga
        precio: un cliente en prueba o cancelado todavía no paga, y contarlo
        inflaría la única cifra que este panel no se puede permitir inflar.
        """
        if self.estado != "ACTIVA":
            return Decimal("0")
        if self.importe_pactado is not None:
            meses = MESES_POR_PERIODO.get(self.periodicidad, 1) or 1
            return (self.importe_pactado / meses).quantize(Decimal("0.01"))
        return self.plan.importe_mensual(self.moneda)

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
