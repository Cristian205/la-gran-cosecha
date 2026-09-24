from django.db import models

from apps.tenancy.models import ModeloConTenant


class MensajeContacto(ModeloConTenant):
    """
    Una solicitud que llega desde /contacto.

    # Por qué `motivo`

    La página ya no es un formulario único: el visitante elige primero qué
    necesita (un pedido, una cotización, un producto que no está en el
    catálogo o hablar con alguien). Guardarlo aparte deja filtrar la bandeja
    por lo que vale más —una cotización grande no espera igual que una
    pregunta— sin tener que leer cada mensaje.

    Los detalles de cada caso (tipo de negocio, cantidad, fecha…) van
    redactados dentro de `mensaje`: son texto para una persona que va a
    responder, no datos que el sistema procese. Si algún día se procesan
    (cotizaciones con estado, por ejemplo), eso es un modelo propio.

    # Por qué el correo es opcional

    Los negocios que compran por mayor se comunican por teléfono y WhatsApp.
    Exigirles un correo para pedir una cotización es fricción que no aporta:
    basta con UNA forma de responderles (ver el serializer).
    """

    class Motivo(models.TextChoices):
        PEDIDO = "PEDIDO", "Hacer un pedido"
        COTIZACION = "COTIZACION", "Cotización"
        PRODUCTO_ESPECIAL = "PRODUCTO_ESPECIAL", "Producto fuera del catálogo"
        CONSULTA = "CONSULTA", "Consulta"

    nombre = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    telefono = models.CharField(max_length=25, blank=True)
    mensaje = models.TextField()
    motivo = models.CharField(
        max_length=20, choices=Motivo.choices, default=Motivo.CONSULTA
    )

    atendido = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_mensajecontacto"
        ordering = ["-fecha_creacion"]
        verbose_name = "Mensaje de contacto"
        verbose_name_plural = "Mensajes de contacto"

    def __str__(self):
        return f"{self.nombre} - {self.fecha_creacion:%Y-%m-%d}"


class Suscriptor(ModeloConTenant):
    """
    Alguien que dejó su correo para que le escriban.

    Existe porque el bloque de boletín lo necesita, y esa dirección importa: el
    bloque se podía haber escrito mandando un `MensajeContacto` con el texto
    «suscripción», y habría funcionado. Sería mentir en dos sitios a la vez —la
    bandeja de mensajes se llenaría de no-mensajes, y una lista de correo no se
    podría consultar ni exportar— para ahorrarse esta tabla.

    Un formulario que recoge correos y no los guarda en ninguna parte es peor
    que no tener el formulario: el visitante cree que se apuntó.

    # Por qué el correo es único por negocio

    Porque la gente pulsa dos veces. Sin la restricción, la lista tendría
    duplicados y quien la exportara mandaría el mismo boletín dos veces a la
    misma persona. Es único POR NEGOCIO y no global: la misma persona puede
    seguir a dos tiendas de la plataforma y son dos suscripciones distintas.

    # Lo que NO está aquí

    El envío. Mandar un boletín es una campaña —con su plantilla, su cola y su
    registro de rebotes— y no cabe en el motor de tiendas. Esto guarda a quién
    habría que escribirle; con qué se le escribe es otro módulo. `activo` está
    puesto para que la baja sea archivar y no borrar, que es la regla de la
    casa y además lo que la ley pide poder demostrar.
    """

    email = models.EmailField()
    #: Opcional a propósito: pedir el nombre en un boletín reduce a la mitad
    #: quién se apunta, y para escribir solo hace falta el correo.
    nombre = models.CharField(max_length=200, blank=True)

    #: De dónde salió. Un negocio que apunta gente desde el mostrador y desde
    #: la web necesita saber cuál de los dos le funciona.
    origen = models.CharField(max_length=40, default="tienda", blank=True)

    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_suscriptor"
        ordering = ["-fecha_creacion"]
        verbose_name = "Suscriptor"
        verbose_name_plural = "Suscriptores"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "email"], name="contact_un_correo_por_negocio"
            )
        ]

    def __str__(self):
        return self.email
