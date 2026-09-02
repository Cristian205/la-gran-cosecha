"""
La API del perfil, en dos públicos.

El negocio lee y ajusta el SUYO; Crynex administra los presets de todos. Son
serializers distintos y no uno con permisos, porque lo que cada uno puede tocar
es distinto: un negocio no elige de qué preset viene ni con qué versión nació,
y dejar esos campos escribibles «porque el permiso ya lo protege» es cómo se
cuela una asignación masiva.
"""
from rest_framework import serializers

from apps.billing.models import Producto

from .capacidades import CAPACIDADES, normalizar, normalizar_politica
from .perfil_pos import catalogo as catalogo_pos
from .perfil_pos import normalizar as normalizar_pos
from .models import PerfilNegocio, Preset


class CapacidadSerializer(serializers.Serializer):
    """El catálogo de capacidades, para que el panel pinte los interruptores."""

    codigo = serializers.CharField()
    nombre = serializers.CharField()
    descripcion = serializers.CharField()
    defecto = serializers.BooleanField()


def catalogo_de_capacidades() -> list:
    return [{"codigo": codigo, **datos} for codigo, datos in CAPACIDADES.items()]


def catalogo_de_perfil_pos() -> list:
    return catalogo_pos()


# ==========================================================================
# EL NEGOCIO Y SU PERFIL
# ==========================================================================
class EjeAtributoSerializer(serializers.Serializer):
    """
    Un eje que distingue una presentación de otra: talla, color, empaque.

    `codigo` es la clave que se guardará en `PresentacionProducto.atributos`, así
    que se valida como slug: un eje llamado «Talla / Color» daría una clave
    imposible de consultar después.
    """

    codigo = serializers.SlugField(max_length=40)
    nombre = serializers.CharField(max_length=80)
    tipo = serializers.ChoiceField(
        choices=["TEXTO", "OPCION", "NUMERO"], default="TEXTO"
    )
    opciones = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    obligatorio = serializers.BooleanField(default=False)
    usar_en_pos = serializers.BooleanField(default=True)
    usar_en_filtros = serializers.BooleanField(default=False)


class PerfilNegocioSerializer(serializers.ModelSerializer):
    """Lo que el negocio ve y puede ajustar de su propio perfil."""

    preset_nombre = serializers.CharField(source="preset_origen.nombre", read_only=True, default=None)
    esta_configurado = serializers.BooleanField(read_only=True)
    esquema_atributos = EjeAtributoSerializer(many=True, required=False)

    class Meta:
        model = PerfilNegocio
        fields = [
            "sector",
            "capacidades",
            "esquema_atributos",
            "perfil_pos",
            "politica_stock",
            "dashboard",
            "preset_nombre",
            "esta_configurado",
            "fecha_actualizacion",
        ]
        # De dónde vino y con qué versión no lo decide el cliente. `sector` sí
        # es suyo: es la etiqueta con la que quiere que se le describa.
        read_only_fields = ["preset_nombre", "esta_configurado", "fecha_actualizacion"]

    def validate_capacidades(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Debe ser un objeto de banderas.")
        desconocidas = set(value) - set(CAPACIDADES)
        if desconocidas:
            raise serializers.ValidationError(
                f"No existen: {', '.join(sorted(desconocidas))}."
            )
        # Se normaliza al validar y no al leer: así lo guardado siempre está
        # completo, y un consumidor puede confiar en que la clave existe.
        return normalizar(value)

    def validate_politica_stock(self, value):
        return normalizar_politica(value)

    def validate_perfil_pos(self, value):
        # Se normaliza al validar, no al leer: asi lo guardado siempre
        # esta completo y la caja puede confiar en que la clave existe.
        return normalizar_pos(value)

    def validate_esquema_atributos(self, value):
        codigos = [eje["codigo"] for eje in value]
        if len(codigos) != len(set(codigos)):
            # Dos ejes con el mismo código harían que uno pisara al otro dentro
            # del JSON de la presentación, en silencio.
            raise serializers.ValidationError("Hay dos ejes con el mismo código.")
        return value


# ==========================================================================
# MÓDULOS
# ==========================================================================
class ModuloSerializer(serializers.Serializer):
    """
    Un módulo, con las dos respuestas que deciden si funciona.

    `disponible` lo dice el plan; `activo`, el cliente. Se exponen por separado
    a propósito: el panel tiene que poder decir «esto no lo tienes contratado»
    en vez de simplemente no mostrarlo, que es lo que convierte una limitación
    en una venta.
    """

    slug = serializers.CharField()
    nombre = serializers.CharField()
    descripcion = serializers.CharField()
    categoria = serializers.CharField()
    icono = serializers.CharField()
    disponible = serializers.BooleanField()
    activo = serializers.BooleanField()


class CambiarModuloSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    activo = serializers.BooleanField()

    def validate_slug(self, value):
        if not Producto.objects.filter(slug=value, estado="ACTIVO").exists():
            raise serializers.ValidationError("Ese módulo no existe.")
        return value


# ==========================================================================
# EL ALTA GUIADA
# ==========================================================================
class RespuestasAltaSerializer(serializers.Serializer):
    """
    Lo que se contesta en el alta.

    `sector` es texto libre acotado a los slugs de preset; el resto son las
    señales, todas booleanas. Son pocas y concretas a propósito: son las mismas
    que la IA rellenará más adelante a partir de una descripción, y una lista
    corta de preguntas contestables es lo que hace ese paso verificable.
    """

    sector = serializers.CharField(required=False, allow_blank=True, default="")
    senales = serializers.DictField(
        child=serializers.BooleanField(), required=False, default=dict
    )

    def to_respuestas(self) -> dict:
        datos = self.validated_data
        return {"sector": datos.get("sector", ""), **(datos.get("senales") or {})}


class AplicarPresetSerializer(RespuestasAltaSerializer):
    preset = serializers.SlugField()

    def validate_preset(self, value):
        if not Preset.objects.filter(slug=value, activo=True).exists():
            raise serializers.ValidationError("Ese preset no existe o está retirado.")
        return value


class PresetSerializer(serializers.ModelSerializer):
    """Lectura de un preset. La escritura vive en el panel de Crynex."""

    class Meta:
        model = Preset
        fields = [
            "slug",
            "nombre",
            "descripcion",
            "sector",
            "icono",
            "version",
            "modulos",
            "capacidades",
            "esquema_atributos",
            "perfil_pos",
            "politica_stock",
            "dashboard",
            "plantilla",
            "tema",
            "senales",
            "activo",
            "es_predeterminado",
            "orden",
        ]


class SugerenciaSerializer(serializers.Serializer):
    """Un candidato con su porqué. El porqué es la mitad del valor."""

    preset = PresetSerializer()
    puntos = serializers.IntegerField()
    penalizacion = serializers.IntegerField()
    motivos = serializers.ListField(child=serializers.CharField())
    modulos_no_cubiertos = serializers.ListField(child=serializers.CharField())
