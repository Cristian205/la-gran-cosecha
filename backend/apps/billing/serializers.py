from rest_framework import serializers

from apps.tenancy.models import Tenant

from .models import Plan, PermisoDisponible, Subscription


class PermisoDisponibleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermisoDisponible
        fields = ["id", "modulo", "codename", "etiqueta", "descripcion", "orden", "activo"]


class PlanSerializer(serializers.ModelSerializer):
    negocios = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = [
            "id", "slug", "nombre", "descripcion", "precio_mensual", "moneda",
            "permisos", "limites", "orden", "activo", "es_predeterminado",
            "negocios",
        ]

    def get_negocios(self, obj):
        """Cuántas empresas lo tienen contratado: el dato que decide si un plan se puede retirar."""
        return obj.suscripciones.count()

    def validate_permisos(self, valor):
        if not isinstance(valor, list):
            raise serializers.ValidationError("Debe ser una lista de codenames.")
        conocidos = set(
            PermisoDisponible.objects.values_list("codename", flat=True)
        )
        desconocidos = sorted(set(valor) - conocidos)
        if desconocidos:
            # Un codename que no existe no concedería nada y sería invisible
            # hasta que alguien se preguntara por qué un plan no funciona.
            raise serializers.ValidationError(
                f"Estos permisos no existen en el catálogo: {', '.join(desconocidos)}"
            )
        return sorted(set(valor))


class NegocioSerializer(serializers.ModelSerializer):
    """Un negocio visto desde la plataforma, con su plan y su tamaño."""

    plan = serializers.SerializerMethodField()
    estado_suscripcion = serializers.SerializerMethodField()
    dominios = serializers.SerializerMethodField()
    usuarios = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id", "uuid", "slug", "nombre", "estado", "fecha_creacion",
            "plan", "estado_suscripcion", "dominios", "usuarios",
        ]

    def get_plan(self, obj):
        sus = getattr(obj, "suscripcion", None)
        return {"slug": sus.plan.slug, "nombre": sus.plan.nombre} if sus else None

    def get_estado_suscripcion(self, obj):
        sus = getattr(obj, "suscripcion", None)
        return sus.estado if sus else None

    def get_dominios(self, obj):
        return [d.hostname for d in obj.dominios.all()]

    def get_usuarios(self, obj):
        return obj.memberships.filter(activo=True).count()


class SubscriptionSerializer(serializers.ModelSerializer):
    negocio = serializers.CharField(source="tenant.nombre", read_only=True)
    plan_nombre = serializers.CharField(source="plan.nombre", read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id", "tenant", "negocio", "plan", "plan_nombre", "estado",
            "fecha_inicio", "fecha_fin", "limites_extra", "notas",
        ]
        read_only_fields = ["fecha_inicio"]
