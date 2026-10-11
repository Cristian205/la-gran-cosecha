"""
WhatsApp por negocio: cómo envía, con qué plantillas y qué se envió.

Las CREDENCIALES no están aquí. El token de Meta y el Auth Token de Twilio son
de la plataforma y viven en variables de entorno (ver `settings`): guardarlos
en una tabla dejaría secretos en claro en cada copia de la base. Lo que sí es
de cada negocio —su número remitente, sus plantillas, qué avisos quiere y a
quién alertar— va en estas tablas y se edita desde el panel.
"""
from django.db import models

from apps.tenancy.models import ModeloConTenant

from .eventos import EVENTOS


class ConfiguracionWhatsApp(ModeloConTenant):
    class Proveedor(models.TextChoices):
        META = "META", "Meta (WhatsApp Cloud API)"
        TWILIO = "TWILIO", "Twilio"
        SIMULADO = "SIMULADO", "Simulado (no envía; solo registra)"

    #: Apagado, no se encola nada: ni avisos a clientes ni alertas.
    activo = models.BooleanField(default=False)
    proveedor = models.CharField(max_length=10, choices=Proveedor.choices, default=Proveedor.META)
    #: Si el principal falla, se intenta el otro (Meta ↔ Twilio) antes de
    #: dar el mensaje por fallido o reprogramarlo.
    respaldo_activo = models.BooleanField(default=True)
    #: Los avisos al CLIENTE solo salen si aceptó recibirlos
    #: (`Cliente.acepta_whatsapp`). Es lo que exige Meta. Apagarlo es asumir
    #: que el negocio tiene ese consentimiento por otra vía.
    exige_consentimiento = models.BooleanField(default=True)

    #: Meta: el «Phone number ID» del número del negocio en WhatsApp Business.
    meta_phone_number_id = models.CharField(max_length=40, blank=True)
    #: Twilio: el remitente, con o sin prefijo: "whatsapp:+14155238886".
    twilio_remitente = models.CharField(max_length=40, blank=True)

    #: A quién le llegan las alertas internas (pedido nuevo, envío devuelto…).
    #: Lista de teléfonos; se normalizan a E.164 al enviar.
    telefonos_alertas = models.JSONField(default=list, blank=True)
    #: Códigos de `EVENTOS` apagados. Se guarda lo apagado y no lo encendido
    #: para que un evento nuevo llegue activo sin tocar cada negocio.
    eventos_apagados = models.JSONField(default=list, blank=True)

    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mensajeria_configuracion"
        verbose_name = "Configuración de WhatsApp"
        verbose_name_plural = "Configuración de WhatsApp"
        constraints = [
            models.UniqueConstraint(fields=["tenant"], name="mensajeria_una_config_por_negocio")
        ]

    def __str__(self):
        return f"WhatsApp del negocio {self.tenant_id}"

    def evento_activo(self, evento: str) -> bool:
        return evento in EVENTOS and evento not in (self.eventos_apagados or [])


class PlantillaWhatsApp(ModeloConTenant):
    """
    La plantilla aprobada que corresponde a un evento, en cada proveedor.

    Meta la identifica por nombre e idioma; Twilio por su `ContentSid`. Las
    dos usan las variables en el orden que declara `EVENTOS[evento]`.
    """

    #: Un código de `EVENTOS`. Sin `choices`: añadir un evento no debería costar
    #: una migración; lo valida el serializer.
    evento = models.CharField(max_length=40)
    meta_nombre = models.CharField(max_length=120, blank=True)
    meta_idioma = models.CharField(max_length=10, default="es")
    twilio_content_sid = models.CharField(max_length=40, blank=True)
    #: El texto tal como se registró, con `{{1}}`…: es lo que se guarda en el
    #: historial y lo que «envía» el proveedor simulado.
    cuerpo = models.TextField(blank=True)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "mensajeria_plantilla"
        verbose_name = "Plantilla de WhatsApp"
        verbose_name_plural = "Plantillas de WhatsApp"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "evento"], name="mensajeria_una_plantilla_por_evento")
        ]

    def __str__(self):
        return f"{self.evento} ({self.tenant_id})"


class MensajeWhatsApp(ModeloConTenant):
    """
    Cada mensaje, desde que se decide enviarlo hasta que WhatsApp confirma
    que se leyó. Es a la vez la cola de salida y el historial.

    La cola vive en la base a propósito: el proyecto no tiene Celery ni Redis,
    y un mensaje que se pierde porque el proceso se reinició justo después del
    pedido es un cliente que no se entera. Lo que no se pudo enviar al momento
    lo reintenta `manage.py enviar_whatsapp`.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        ENVIADO = "ENVIADO", "Enviado"
        ENTREGADO = "ENTREGADO", "Entregado"
        LEIDO = "LEIDO", "Leído"
        FALLIDO = "FALLIDO", "Fallido"
        OMITIDO = "OMITIDO", "Omitido"

    evento = models.CharField(max_length=40)
    destino = models.CharField(max_length=20, help_text="Teléfono en formato E.164: +573001234567")
    variables = models.JSONField(default=list, blank=True)
    texto = models.TextField(blank=True, help_text="El mensaje tal como debería leerse.")

    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PENDIENTE)
    proveedor = models.CharField(max_length=10, blank=True, help_text="El que lo envió de verdad.")
    id_externo = models.CharField(max_length=120, blank=True, db_index=True)
    error = models.TextField(blank=True)
    #: Cada intento con su proveedor y su resultado: lo que hace falta para
    #: entender por qué un mensaje acabó en Twilio o no salió.
    intentos = models.JSONField(default=list, blank=True)
    proximo_intento = models.DateTimeField(null=True, blank=True)

    #: Evita el doble envío: "pedido:42:PEDIDO_RECIBIDO" se encola una vez.
    clave = models.CharField(max_length=120, blank=True)
    pedido_id = models.PositiveBigIntegerField(null=True, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "mensajeria_mensaje"
        ordering = ["-fecha_creacion"]
        verbose_name = "Mensaje de WhatsApp"
        verbose_name_plural = "Mensajes de WhatsApp"
        indexes = [models.Index(fields=["estado", "proximo_intento"], name="mensajeria_cola")]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "clave"],
                condition=~models.Q(clave=""),
                name="mensajeria_clave_unica",
            )
        ]

    def __str__(self):
        return f"{self.evento} → {self.destino} ({self.estado})"


class ExclusionWhatsApp(ModeloConTenant):
    """
    Números que pidieron no recibir más mensajes (respondieron «BAJA», o el
    negocio los dio de baja). Se respeta antes de encolar: Meta penaliza el
    número remitente que insiste, y la Ley 1581 obliga a atender la revocatoria.
    """

    telefono = models.CharField(max_length=20)
    motivo = models.CharField(max_length=120, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "mensajeria_exclusion"
        verbose_name = "Número excluido"
        verbose_name_plural = "Números excluidos"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "telefono"], name="mensajeria_exclusion_unica")
        ]

    def __str__(self):
        return self.telefono
