"""
Reservas: apartar un recurso durante un rato.

Es el primer módulo que llega DESPUÉS del POS, y por eso el que de verdad pone
a prueba la arquitectura. Todo lo anterior —inventario, caja, tienda— se diseñó
sabiendo que existiría; esto comprueba si aquello era cierto o solo estaba bien
escrito. La medida es concreta y se puede verificar:

    añadir reservas no cambia ni una línea dentro de `apps.pos`.

# Por qué no hay ninguna «Mesa» aquí

La tentación era llamar `Mesa` al modelo, porque el caso que lo motiva es un
restaurante. Sería el mismo error que un `if sector == "restaurante"`, solo que
escrito en el esquema, que es de donde peor se sale. Una peluquería reserva
sillas, un consultorio reserva horas de un profesional, una cancha se reserva
entera y un hotel reserva habitaciones. Las cuatro cosas son:

    algo que se ocupa durante un intervalo y que no admite dos a la vez.

Eso es `Recurso`. Cómo se LLAMA —«Mesa», «Silla», «Cancha»— lo dice
`ConfiguracionReservas.nombre_recurso`, que es un dato del negocio. Es la misma
regla de siempre, aplicada al nombre en vez de al aspecto: los datos NOMBRAN,
el código PINTA.

# Solapamiento: por qué la comprobación está en el código

PostgreSQL sabe impedir dos reservas encimadas con una `ExclusionConstraint`
sobre un rango, que sería la garantía más fuerte posible. No se usa, y conviene
decir por qué en vez de que parezca un olvido:

1. Necesita la extensión `btree_gist`, que en Supabase hay que habilitar a mano
   y que un despliegue nuevo no tiene.
2. No existe en SQLite, que es la base de la suite. La restricción quedaría sin
   probar justo donde se prueba todo lo demás.

Así que la garantía la da `operaciones.crear()`, bloqueando la fila del recurso
—`select_for_update`— antes de mirar si el hueco está libre. Es exactamente lo
que ya hace la caja para numerar sus ventas dentro de un turno, y hay un test
marcado `postgres` que lanza dos reservas a la vez sobre el mismo hueco.

# Lo que NO está aquí

Pagos por anticipado y política de cancelación. Los dos son reglas de dinero, y
el dinero de este sistema lo lleva la caja: una señal cobrada es una venta con
su medio de pago y su turno, no un campo `deposito` en esta tabla. Cuando haga
falta, la reserva se enlaza a la venta que ya existe — el campo `venta` está
puesto justo para eso.
"""
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# 1. CONFIGURACIÓN
# ==========================================================================
class ConfiguracionReservas(ModeloConTenant):
    """
    Cómo se comporta la agenda de este negocio.

    Cuatro ajustes, y cada uno con un consumidor nombrado — la misma disciplina
    que `capacidades.py` y que `TokenTema`. Un ajuste que nadie lee promete una
    configurabilidad que no se cumple, y quien lo mueva y no vea nada dejará de
    fiarse del resto de la pantalla.
    """

    #: Cómo llama este negocio a lo que reserva. Lo lee el panel de la caja
    #: para titularse, y el panel del negocio para toda su pantalla.
    nombre_recurso = models.CharField(max_length=40, default="Mesa")
    nombre_recurso_plural = models.CharField(max_length=40, default="Mesas")

    #: Cuánto dura una reserva cuando nadie dice lo contrario. Lo lee
    #: `operaciones.crear()` para calcular `fin`.
    duracion_minutos = models.PositiveIntegerField(default=90)

    #: Con cuánta antelación se puede reservar. Lo lee `operaciones.crear()`
    #: para rechazar la reserva de dentro de dos años que nadie va a cumplir.
    antelacion_maxima_dias = models.PositiveIntegerField(default=60)

    class Meta:
        db_table = "reservations_configuracion"
        verbose_name = "Configuración de reservas"
        verbose_name_plural = "Configuración de reservas"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant"], name="reservations_una_config_por_negocio"
            )
        ]

    def __str__(self):
        return f"Reservas del negocio {self.tenant_id}"

    @property
    def duracion(self) -> timedelta:
        return timedelta(minutes=self.duracion_minutos)


# ==========================================================================
# 2. RECURSO
# ==========================================================================
class Recurso(ModeloConTenant):
    """
    Algo que se ocupa durante un rato: una mesa, una silla, una cancha.

    `reservas_simultaneas` es lo que evita tener un interruptor «permite
    solapar» a nivel de negocio. La pregunta real no es del negocio sino del
    recurso: una mesa admite una reserva a la vez, una sala de yoga admite
    veinte, y el mismo local puede tener las dos cosas. Poner el número aquí
    hace que el caso mixto sea un alta y no una rama.
    """

    ubicacion = models.ForeignKey(
        "inventory.Ubicacion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="recursos",
    )

    codigo = models.SlugField(max_length=40)
    nombre = models.CharField(max_length=80)
    #: «Terraza», «Salón», «Piso 2». Texto libre a propósito: agrupar la agenda
    #: es una necesidad visual, y una tabla de zonas sería una pantalla más que
    #: mantener para guardar una palabra.
    zona = models.CharField(max_length=60, blank=True)

    #: Cuántas personas caben. 0 cuando no aplica —una hora de peluquería no
    #: tiene aforo—, y entonces no se valida contra `Reserva.personas`.
    capacidad = models.PositiveSmallIntegerField(default=0)
    reservas_simultaneas = models.PositiveSmallIntegerField(default=1)

    activo = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "reservations_recurso"
        verbose_name = "Recurso reservable"
        verbose_name_plural = "Recursos reservables"
        ordering = ["orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "codigo"], name="reservations_recurso_unico"
            )
        ]

    def __str__(self):
        return self.nombre

    def clean(self):
        super().clean()
        if self.reservas_simultaneas is not None and self.reservas_simultaneas < 1:
            raise ValidationError(
                {
                    "reservas_simultaneas": (
                        "Un recurso que no admite ninguna reserva no es reservable."
                    )
                }
            )


# ==========================================================================
# 3. RESERVA
# ==========================================================================
class Reserva(ModeloConTenant):
    """
    Un hueco apartado.

    `nombre_contacto` y `telefono_contacto` son COPIAS y no lecturas por clave
    foránea, igual que `LineaVenta.nombre_congelado`. Hay dos razones y las dos
    importan: la mitad de las reservas de mostrador son de alguien que no está
    registrado —«apúntame a nombre de Ana»— y las que sí lo están tienen que
    seguir diciendo a quién se esperaba aunque el cliente se borre después.

    `NO_ASISTIO` es un estado y no lo mismo que `CANCELADA` porque no lo es:
    quien avisa libera el hueco a tiempo y quien no aparece deja la mesa vacía
    toda la noche. Un negocio que no puede distinguir las dos cosas no puede
    decidir si le hace falta pedir señal.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente de confirmar"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        EN_CURSO = "EN_CURSO", "En curso"
        CUMPLIDA = "CUMPLIDA", "Cumplida"
        CANCELADA = "CANCELADA", "Cancelada"
        NO_ASISTIO = "NO_ASISTIO", "No asistió"

    #: Los estados que OCUPAN el recurso. Es la lista que mira la comprobación
    #: de solapamiento, y por eso vive aquí y no repartida por el código: una
    #: cancelada no estorba, y una cumplida tampoco — ya se fueron.
    ESTADOS_QUE_OCUPAN = (Estado.PENDIENTE, Estado.CONFIRMADA, Estado.EN_CURSO)

    class Origen(models.TextChoices):
        PANEL = "PANEL", "Panel del negocio"
        CAJA = "CAJA", "Mostrador"
        TIENDA = "TIENDA", "Tienda online"

    recurso = models.ForeignKey(
        Recurso, on_delete=models.PROTECT, related_name="reservas"
    )

    cliente = models.ForeignKey(
        "orders.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reservas",
    )
    nombre_contacto = models.CharField(max_length=120)
    telefono_contacto = models.CharField(max_length=40, blank=True)

    personas = models.PositiveSmallIntegerField(default=1)
    inicio = models.DateTimeField()
    fin = models.DateTimeField()

    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    origen = models.CharField(
        max_length=20, choices=Origen.choices, default=Origen.PANEL
    )
    nota = models.CharField(max_length=255, blank=True)

    #: La venta que la atendió, si acabó consumiendo en caja. Es el enganche
    #: entre los dos módulos y va en esta dirección —de reserva a venta— para
    #: que el POS siga sin saber que las reservas existen.
    venta = models.ForeignKey(
        "pos.Venta",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reservas",
    )

    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reservas_creadas",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reservations_reserva"
        verbose_name = "Reserva"
        verbose_name_plural = "Reservas"
        ordering = ["inicio", "id"]
        indexes = [
            models.Index(fields=["tenant", "inicio"], name="reservations_agenda_idx"),
            models.Index(
                fields=["tenant", "recurso", "inicio"], name="reservations_recurso_idx"
            ),
        ]

    def __str__(self):
        return f"{self.nombre_contacto} · {self.recurso} · {self.inicio:%d/%m %H:%M}"

    @property
    def ocupa(self) -> bool:
        return self.estado in self.ESTADOS_QUE_OCUPAN

    def clean(self):
        super().clean()
        if self.inicio and self.fin and self.fin <= self.inicio:
            raise ValidationError(
                {"fin": "Una reserva tiene que terminar después de empezar."}
            )
