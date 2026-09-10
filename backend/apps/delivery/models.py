"""
Domicilios: llevar algo a una dirección.

Es el SEGUNDO módulo con panel en la caja, y por eso el que de verdad decide
algo. Reservas demostró que el mecanismo de `pos/paneles.py` funciona con uno;
con uno funciona cualquier cosa, incluido un `if` bien disimulado. La pregunta
que contesta esta fase es otra:

    ¿el mecanismo aguanta DOS a la vez, y por lo tanto el tercero?

La respuesta corta es que casi. El registro de paneles aguantó sin tocarse, y
`apps.pos` sigue sin mencionar un domicilio. Lo que NO aguantó fue
`perfil_pos.panel_lateral`, que era una cadena: un restaurante que atiende
mesas Y reparte a domicilio tenía que elegir cuál de sus dos módulos ver. Ese
límite no se veía con un módulo —no había con qué chocar— y aquí se arregla
convirtiéndolo en lista. Es exactamente el hallazgo que esta fase existía para
provocar, y conviene dejarlo escrito: la primera implementación de un mecanismo
extensible casi siempre supone «uno» en algún sitio, y el segundo caso es quien
lo encuentra.

# Por qué no hay ninguna «Moto» ni ningún «Pedido a domicilio»

Misma disciplina que con `Recurso` en reservas. Un restaurante manda comida en
moto, una farmacia manda medicamentos a pie, una floristería manda ramos en
carro y una ferretería manda bultos en camioneta. Las cuatro cosas son:

    algo que sale de aquí, va a una dirección y vuelve o no vuelve.

Eso es `Envio`. Quién lo lleva es `Repartidor` —«domiciliario», «mensajero»,
«técnico»: lo dice `ConfiguracionEnvios.nombre_repartidor`— y cuánto cuesta
llegar lo dice `Zona`. Ni el modelo ni el código saben qué se transporta.

# Por qué las zonas son una lista y no un mapa

Un polígono sobre un mapa sería más exacto, y necesita tres cosas que este
sistema no tiene: PostGIS en la base, un proveedor de mapas con su factura, y
una dirección normalizada que en Colombia casi nunca llega bien escrita. Quien
toma el pedido —por teléfono, por WhatsApp o en el mostrador— sabe perfectamente
si «Modelia» es zona 2, y lo elige de una lista en un segundo. La
geocodificación se puede añadir después SOBRE esto: sería rellenar la zona sola
en vez de a mano, no un modelo distinto.

# Por qué el dinero del domicilio no está aquí

`Envio.tarifa` es lo que se cobró por llevarlo, y se guarda copiado. Pero el
domicilio NO se suma solo a la venta, y no es un olvido: el dinero de este
sistema lo lleva la caja, igual que se dijo de las señales de reserva. Un
negocio que quiera cobrar el envío da de alta un producto «Domicilio» en su
catálogo y lo timbra como cualquier otra cosa —con su IVA, su medio de pago y
su turno—. Que este módulo insertara una línea en la venta obligaría al POS a
aceptar renglones que no vienen del catálogo, y eso sí que sería una rama.

Lo que sí está aquí es `cobro_contra_entrega`: el repartidor recibe la plata en
la puerta. Eso no es una venta distinta, es la MISMA venta cobrada en otro
sitio y a otra hora, y el negocio necesita saber cuánto lleva encima cada
repartidor para cuadrarle al volver.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# 1. CONFIGURACIÓN
# ==========================================================================
class ConfiguracionEnvios(ModeloConTenant):
    """
    Cómo reparte este negocio.

    Cinco ajustes y cada uno con su consumidor nombrado — misma disciplina que
    `ConfiguracionReservas`, que `capacidades.py` y que `TokenTema`. Un ajuste
    que nadie lee promete una configurabilidad que no se cumple.
    """

    #: Cómo llama este negocio a quien reparte: «Domiciliario», «Mensajero»,
    #: «Técnico». Lo lee el panel de la caja para titularse y la pantalla de la
    #: operación para toda su rotulación.
    nombre_repartidor = models.CharField(max_length=40, default="Repartidor")
    nombre_repartidor_plural = models.CharField(max_length=40, default="Repartidores")

    #: Lo que se cobra cuando la dirección no cae en ninguna zona con tarifa
    #: propia. Lo lee `operaciones.tarifa_de()`.
    tarifa_base = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    #: Cuánto se promete tardar cuando la zona no dice otra cosa. Lo lee
    #: `operaciones.crear()` para calcular `prometido_para`.
    minutos_de_promesa = models.PositiveIntegerField(default=45)

    #: Si está encendido, una dirección sin zona se RECHAZA en vez de cobrarse
    #: a tarifa base. Lo lee `operaciones.tarifa_de()`. Es una decisión de
    #: negocio real y no un detalle: hay quien reparte a donde le digan y quien
    #: solo reparte en su barrio, y el segundo necesita que el sistema le diga
    #: que no en vez de aceptar un envío que no va a poder hacer.
    exige_zona = models.BooleanField(default=False)

    class Meta:
        db_table = "delivery_configuracion"
        verbose_name = "Configuración de domicilios"
        verbose_name_plural = "Configuración de domicilios"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant"], name="delivery_una_config_por_negocio"
            )
        ]

    def __str__(self):
        return f"Domicilios del negocio {self.tenant_id}"


# ==========================================================================
# 2. ZONA
# ==========================================================================
class Zona(ModeloConTenant):
    """
    Un trozo de ciudad con su precio y su promesa.

    `minutos_de_promesa` en 0 significa «lo que diga el negocio», no «cero
    minutos». Se resuelve así y no con `null` porque el campo se edita en un
    formulario y un vacío que significa «heredado» es más fácil de explicar que
    un nulo: la pantalla puede poner el valor del negocio como marca de agua.
    """

    codigo = models.SlugField(max_length=40)
    nombre = models.CharField(max_length=80)
    tarifa = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    minutos_de_promesa = models.PositiveIntegerField(default=0)

    activa = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "delivery_zona"
        verbose_name = "Zona de reparto"
        verbose_name_plural = "Zonas de reparto"
        ordering = ["orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "codigo"], name="delivery_zona_unica"
            )
        ]

    def __str__(self):
        return self.nombre


# ==========================================================================
# 3. REPARTIDOR
# ==========================================================================
class Repartidor(ModeloConTenant):
    """
    Quien lo lleva.

    El vínculo con `User` es OPCIONAL y esa es la decisión importante. La
    mayoría de los repartidores de un negocio pequeño no tienen cuenta en el
    sistema: son contratistas, rotan, y a veces es el hijo del dueño. Exigir un
    usuario obligaría a inventar cuentas que nadie usa, con su contraseña y su
    permiso, solo para poder anotar quién salió con el pedido. El día que un
    repartidor sí necesite entrar —para marcar su propia entrega desde el
    móvil— el campo ya está.

    `carga_maxima` es a este módulo lo que `reservas_simultaneas` a las mesas,
    y no por simetría: una moto lleva tres o cuatro pedidos y a partir de ahí
    la comida llega fría. Es lo que hace que asignar sea una operación que
    puede fallar, y por eso pasa por el mismo bloqueo de fila que reparte las
    mesas.
    """

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="repartos",
    )

    nombre = models.CharField(max_length=120)
    telefono = models.CharField(max_length=40, blank=True)
    #: «Moto», «Bicicleta», «A pie», «Camioneta AAA123». Texto libre a
    #: propósito: es información para quien despacha, no un dato del que
    #: dependa ninguna regla.
    vehiculo = models.CharField(max_length=60, blank=True)

    #: Cuántos envíos puede llevar a la vez. Lo lee `operaciones.asignar()`.
    carga_maxima = models.PositiveSmallIntegerField(default=3)

    activo = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "delivery_repartidor"
        verbose_name = "Repartidor"
        verbose_name_plural = "Repartidores"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre

    def clean(self):
        super().clean()
        if self.carga_maxima is not None and self.carga_maxima < 1:
            raise ValidationError(
                {"carga_maxima": "Un repartidor que no puede llevar nada no reparte."}
            )


# ==========================================================================
# 4. ENVÍO
# ==========================================================================
class Envio(ModeloConTenant):
    """
    Algo que tiene que llegar a una dirección.

    Todo lo que identifica al destino —nombre, teléfono, dirección, referencia—
    es COPIA y no lectura por clave foránea, por la misma razón que
    `Reserva.nombre_contacto` y que `LineaVenta.nombre_congelado`: la mitad de
    los domicilios son para alguien que no está registrado, y los que sí lo
    están tienen que seguir diciendo a dónde se llevó aunque el cliente se mude
    o se borre. Una dirección leída por referencia reescribe el pasado cada vez
    que alguien actualiza su ficha.

    `tarifa` también se copia, y por lo mismo: la zona 3 puede pasar de 4.000 a
    6.000 mañana, y el envío de ayer se cobró a 4.000. Un informe que
    multiplique envíos por la tarifa ACTUAL de su zona da un número que nunca
    ocurrió.

    # DEVUELTO no es CANCELADO

    Es la misma distinción que `NO_ASISTIO` frente a `CANCELADA` en reservas, y
    aquí cuesta dinero de forma más evidente: cancelar antes de que salga no
    cuesta nada, y devolver significa que el repartidor manejó hasta allá, no
    encontró a nadie y volvió con el paquete y —si era contra entrega— sin la
    plata. Un negocio que no puede separar las dos cosas no puede decidir si le
    hace falta cobrar por anticipado en esa zona.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Por asignar"
        ASIGNADO = "ASIGNADO", "Asignado"
        EN_RUTA = "EN_RUTA", "En ruta"
        ENTREGADO = "ENTREGADO", "Entregado"
        DEVUELTO = "DEVUELTO", "Devuelto"
        CANCELADO = "CANCELADO", "Cancelado"

    #: Los estados en que el envío está EN MANOS de un repartidor. Es la lista
    #: que mira el control de carga, y por eso vive aquí y no repartida por el
    #: código: un entregado ya no pesa, y un devuelto tampoco — ya volvió.
    ESTADOS_EN_CALLE = (Estado.ASIGNADO, Estado.EN_RUTA)

    #: Los que ya no se mueven. Los mira `operaciones` para negarse a
    #: reasignar, y la pantalla para decidir qué se puede tocar.
    ESTADOS_CERRADOS = (Estado.ENTREGADO, Estado.DEVUELTO, Estado.CANCELADO)

    class Origen(models.TextChoices):
        PANEL = "PANEL", "Panel del negocio"
        CAJA = "CAJA", "Mostrador"
        TIENDA = "TIENDA", "Tienda online"

    zona = models.ForeignKey(
        Zona, on_delete=models.PROTECT, null=True, blank=True, related_name="envios"
    )
    repartidor = models.ForeignKey(
        Repartidor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios",
    )

    cliente = models.ForeignKey(
        "orders.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios",
    )
    nombre_contacto = models.CharField(max_length=120)
    telefono_contacto = models.CharField(max_length=40, blank=True)
    direccion = models.TextField()
    #: «Casa blanca, portón verde», «Timbre 302, preguntar por Ana». Es lo que
    #: de verdad hace que el pedido llegue, y no cabe en la dirección.
    referencia = models.CharField(max_length=200, blank=True)

    #: Copiada de la zona al crear. Ver el docstring de la clase.
    tarifa = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    #: El repartidor recibe la plata en la puerta. `monto_a_cobrar` es lo que
    #: tiene que traer de vuelta, y el negocio lo necesita para cuadrarle.
    cobro_contra_entrega = models.BooleanField(default=False)
    monto_a_cobrar = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    origen = models.CharField(
        max_length=20, choices=Origen.choices, default=Origen.PANEL
    )
    nota = models.CharField(max_length=255, blank=True)

    #: Cuándo se prometió que llegaría. Se calcula al crear, con la promesa de
    #: la zona o la del negocio. No es una fecha de entrega: es el compromiso, y
    #: compararlo con `entrega` es toda la métrica de puntualidad que este
    #: módulo necesita.
    prometido_para = models.DateTimeField(null=True, blank=True)
    #: Cuándo salió y cuándo llegó de verdad. Los estampa `cambiar_estado()`.
    salida = models.DateTimeField(null=True, blank=True)
    entrega = models.DateTimeField(null=True, blank=True)

    #: Las dos puertas de entrada, y las dos apuntan DESDE aquí. Esa asimetría
    #: es la que sostiene la fase entera: ni `apps.pos` ni `apps.orders` saben
    #: que existen los domicilios. Lo que la caja guardó fue un diccionario
    #: opaco en `Venta.contexto`; quien lo interpreta es este módulo.
    venta = models.ForeignKey(
        "pos.Venta",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios",
    )
    pedido = models.ForeignKey(
        "orders.Pedido",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios",
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envios_creados",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "delivery_envio"
        verbose_name = "Envío"
        verbose_name_plural = "Envíos"
        ordering = ["-fecha_creacion", "-id"]
        indexes = [
            models.Index(fields=["tenant", "estado"], name="delivery_tablero_idx"),
            models.Index(
                fields=["tenant", "repartidor", "estado"], name="delivery_carga_idx"
            ),
            models.Index(
                fields=["tenant", "fecha_creacion"], name="delivery_historico_idx"
            ),
        ]

    def __str__(self):
        return f"{self.nombre_contacto} · {self.direccion[:40]}"

    @property
    def en_calle(self) -> bool:
        return self.estado in self.ESTADOS_EN_CALLE

    @property
    def cerrado(self) -> bool:
        return self.estado in self.ESTADOS_CERRADOS
