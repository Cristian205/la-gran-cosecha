"""
Qué necesita cada negocio, y cómo se decide.

Tres modelos en dos niveles, la misma separación que ya usan el motor de
tiendas y el comercial:

    Nivel plataforma — lo administra Crynex
      Preset        una propuesta inicial por tipo de negocio

    Nivel negocio — lo edita cada cliente
      PerfilNegocio  lo que este negocio necesita de verdad
      TenantModulo   qué módulos tiene encendidos

# Preset y perfil no son lo mismo, y la diferencia es el diseño entero

El preset es una PROPUESTA; el perfil es la VERDAD OPERATIVA. Adoptar un preset
COPIA sus valores al perfil y ahí se acaba la relación: `preset_origen` queda
para saber de dónde vino, no para leer nada de él.

Copiar y no referenciar es la misma regla que `Plantilla` y `Tema` ya siguen, y
aquí importa igual: si el perfil apuntara al preset, que Crynex retocara
«Ferretería» cambiaría el comportamiento de cuarenta negocios en producción sin
avisar a ninguno. Un negocio que funciona no cambia solo.

# Lo que NO está aquí

Nada de `tipo_de_negocio` con ramas de código detrás. El sector es una etiqueta
para mostrar y para puntuar en el alta; lo que gobierna la interfaz son las
capacidades. Ver `capacidades.py`, que explica por qué la lista es corta.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.tenancy.models import Tenant

from .capacidades import CLAVES_DE_CAPACIDAD


# ==========================================================================
# NIVEL PLATAFORMA
# ==========================================================================
class Preset(models.Model):
    """
    Un punto de partida para un tipo de negocio.

    Se administra desde el panel de Crynex, y añadir «floristería» es un alta
    aquí: ni una línea de código, ni una migración. Esa es la prueba de que la
    arquitectura cumple lo que promete.

    `version` sube cuando se edita. No propaga nada —los negocios ya creados
    conservan lo que copiaron—, sirve para saber con qué versión nació cada uno
    cuando haya que entender por qué dos clientes del mismo sector se comportan
    distinto.
    """

    slug = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)
    #: Lo que se muestra y lo que puntúa el alta. NUNCA se ramifica sobre esto.
    sector = models.CharField(max_length=60, blank=True)
    icono = models.CharField(max_length=40, blank=True)

    version = models.PositiveIntegerField(default=1)

    #: Slugs de `billing.Producto`. Recomendados, no impuestos: se activan solo
    #: los que el plan del negocio permita. Ver `aplicar.activar_modulos`.
    modulos = models.JSONField(default=list, blank=True)

    capacidades = models.JSONField(default=dict, blank=True)
    #: Los ejes que distinguen una presentación de otra: talla, color, empaque.
    esquema_atributos = models.JSONField(default=list, blank=True)
    perfil_pos = models.JSONField(default=dict, blank=True)
    politica_stock = models.JSONField(default=dict, blank=True)
    dashboard = models.JSONField(default=list, blank=True)

    plantilla = models.ForeignKey(
        "storefront.Plantilla",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="presets",
    )
    tema = models.ForeignKey(
        "storefront.Tema",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="presets",
    )

    #: Lo que este preset espera de las respuestas del alta, con su peso:
    #: {"vende_por_peso": 1, "usa_codigo_barras": 2}. Es donde vive la
    #: inteligencia del selector, y se edita sin tocar código.
    senales = models.JSONField(default=dict, blank=True)

    activo = models.BooleanField(default=True)
    es_predeterminado = models.BooleanField(default=False)
    orden = models.PositiveIntegerField(default=0)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "business_preset"
        verbose_name = "Preset de negocio"
        verbose_name_plural = "Presets de negocio"
        ordering = ["orden", "nombre"]
        constraints = [
            # Sin esto, el preset al que cae un alta sin puntuación suficiente
            # dependería del orden de la consulta. Mismo criterio que
            # `Plantilla.es_predeterminada` y `Plan.es_predeterminado`.
            models.UniqueConstraint(
                fields=["es_predeterminado"],
                condition=models.Q(es_predeterminado=True),
                name="business_un_solo_preset_por_defecto",
            )
        ]

    def __str__(self):
        return self.nombre

    def clean(self):
        super().clean()
        desconocidas = set(self.capacidades or {}) - CLAVES_DE_CAPACIDAD
        if desconocidas:
            # Se rechaza aquí y se tolera al leer (ver `capacidades.normalizar`).
            # La asimetría es deliberada: al ESCRIBIR, una capacidad inventada
            # es casi siempre un nombre mal escrito, y aceptarla en silencio
            # dejaría un preset que no hace lo que su autor cree.
            raise ValidationError(
                {"capacidades": f"No existen: {', '.join(sorted(desconocidas))}."}
            )


# ==========================================================================
# NIVEL NEGOCIO
# ==========================================================================
class PerfilNegocio(models.Model):
    """
    Lo que este negocio necesita. La verdad operativa.

    Es `OneToOne` con `Tenant` y no hereda `ModeloConTenant`, igual que
    `Subscription` y `StoreSettings`: no es un dato DEL negocio sino la
    configuración del negocio mismo, y tanto el panel del cliente como el de
    Crynex tienen que poder leerlo. El aislamiento lo garantiza la vista, que
    solo entrega el perfil del negocio de la petición.
    """

    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name="perfil")

    preset_origen = models.ForeignKey(
        Preset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="negocios",
        help_text="De dónde se copió. No es fuente de verdad: solo trazabilidad.",
    )
    preset_version_origen = models.PositiveIntegerField(default=0)

    sector = models.CharField(max_length=60, blank=True)

    capacidades = models.JSONField(default=dict, blank=True)
    esquema_atributos = models.JSONField(default=list, blank=True)
    perfil_pos = models.JSONField(default=dict, blank=True)
    politica_stock = models.JSONField(default=dict, blank=True)
    dashboard = models.JSONField(default=list, blank=True)

    #: Lo que se contestó en el alta. Se guarda para poder volver a puntuar si
    #: mañana aparece un preset mejor, y para que la IA de más adelante tenga
    #: contra qué compararse. Sin esto, el alta se pierde en cuanto termina.
    respuestas_alta = models.JSONField(default=dict, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "business_perfilnegocio"
        verbose_name = "Perfil de negocio"
        verbose_name_plural = "Perfiles de negocio"
        ordering = ["tenant__nombre"]

    def __str__(self):
        return f"Perfil de {self.tenant}"

    @property
    def esta_configurado(self) -> bool:
        """
        Si ya pasó por el alta. Lo usa el panel para ofrecer el asistente.

        Mira la VERSIÓN y no solo la clave foránea, y la diferencia importa:
        `preset_origen` es `SET_NULL`, así que si alguien borrara el preset
        desde el admin, un negocio configurado hace meses volvería a contar
        como nuevo y el panel le pediría repetir el alta. La versión copiada
        sobrevive a ese borrado porque es un número, no una referencia.
        """
        return self.preset_origen_id is not None or self.preset_version_origen > 0

    def puede(self, capacidad: str) -> bool:
        """
        La única forma legítima de preguntar «¿este negocio hace X?».

        Se lee así y no con `perfil.capacidades["x"]` para que un código mal
        escrito o una capacidad retirada devuelvan False en vez de reventar con
        un `KeyError` en mitad de una petición.
        """
        from .capacidades import normalizar  # noqa: PLC0415

        return bool(normalizar(self.capacidades).get(capacidad, False))


class TenantModulo(models.Model):
    """
    Qué módulos tiene encendidos este negocio.

    Responde una pregunta DISTINTA de la que responde el plan, y por eso es una
    tabla aparte:

        ¿Puede?          lo decide la suscripción. Es comercial.
        ¿Lo quiere?      lo decide esto. Es del cliente.

    Un módulo está operativo solo si las dos dicen que sí. Colapsarlas en una
    obligaría a vender cosas para poder apagarlas, o haría que apagar algo
    pareciera una bajada de plan.
    """

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="modulos")
    modulo = models.ForeignKey(
        "billing.Producto", on_delete=models.CASCADE, related_name="activaciones"
    )

    activo = models.BooleanField(default=True)
    fecha_activacion = models.DateTimeField(auto_now_add=True)
    activado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="modulos_activados",
    )

    class Meta:
        db_table = "business_tenantmodulo"
        verbose_name = "Módulo del negocio"
        verbose_name_plural = "Módulos del negocio"
        ordering = ["modulo__orden", "modulo__nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "modulo"],
                name="business_un_modulo_por_negocio",
            )
        ]

    def __str__(self):
        estado = "activo" if self.activo else "apagado"
        return f"{self.tenant} · {self.modulo} ({estado})"
