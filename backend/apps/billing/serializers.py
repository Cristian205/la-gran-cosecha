"""
Lo que el Control Center ve del motor comercial.

Un criterio recorre todo el archivo: el panel recibe siempre el dato calculado
además del crudo. `precio_mensual` viaja junto a la lista de precios, y
`limites_efectivos` junto a `limites`, porque la alternativa es que el frontend
reimplemente `Plan.importe_mensual()` y las dos versiones se separen el día que
alguien añada una periodicidad.
"""
from decimal import Decimal

from rest_framework import serializers

from apps.tenancy.models import Tenant

from .models import (
    Caracteristica,
    EstadoComercial,
    Moneda,
    Periodicidad,
    PermisoDisponible,
    Plan,
    PrecioPlan,
    Producto,
    Subscription,
    TipoLimite,
)


# ==========================================================================
# Catálogo
# ==========================================================================
class ProductoSerializer(serializers.ModelSerializer):
    permisos = serializers.SerializerMethodField()
    planes = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            "id", "slug", "nombre", "descripcion", "categoria", "icono",
            "estado", "orden", "permisos", "planes",
        ]

    def get_permisos(self, obj):
        return obj.permisos.count()

    def get_planes(self, obj):
        """Cuántos planes lo conceden: es lo que dice si se puede archivar."""
        codenames = set(obj.permisos.values_list("codename", flat=True))
        if not codenames:
            return 0
        return sum(
            1 for plan in self.context.get("planes", []) if codenames & set(plan.permisos or [])
        )


class CaracteristicaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = Caracteristica
        fields = [
            "id", "codigo", "nombre", "descripcion", "producto",
            "producto_nombre", "orden", "activo",
        ]


class TipoLimiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoLimite
        fields = [
            "id", "codigo", "nombre", "descripcion", "unidad", "por_periodo",
            "valor_por_defecto", "medido", "orden", "activo",
        ]


class PermisoDisponibleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermisoDisponible
        fields = [
            "id", "producto", "modulo", "codename", "etiqueta", "descripcion",
            "orden", "activo",
        ]


# ==========================================================================
# Planes y precios
# ==========================================================================
class PrecioPlanSerializer(serializers.ModelSerializer):
    esta_vigente = serializers.BooleanField(read_only=True)

    class Meta:
        model = PrecioPlan
        fields = [
            "id", "plan", "moneda", "periodicidad", "importe",
            "vigente_desde", "vigente_hasta", "notas", "esta_vigente",
        ]
        read_only_fields = ["plan"]

    def validate(self, datos):
        desde = datos.get("vigente_desde", getattr(self.instance, "vigente_desde", None))
        hasta = datos.get("vigente_hasta", getattr(self.instance, "vigente_hasta", None))
        if desde and hasta and hasta < desde:
            raise serializers.ValidationError(
                {"vigente_hasta": "No puede terminar antes de empezar."}
            )
        return datos


class PlanSerializer(serializers.ModelSerializer):
    negocios = serializers.SerializerMethodField()
    precios = PrecioPlanSerializer(many=True, read_only=True)
    # El panel heredado y las tarjetas del resumen leen estos dos; se calculan
    # del precio vigente en vez de guardarse, para que no puedan quedar viejos.
    precio_mensual = serializers.SerializerMethodField()
    moneda = serializers.SerializerMethodField()
    productos = serializers.SerializerMethodField()
    limites_efectivos = serializers.SerializerMethodField()
    activo = serializers.BooleanField(read_only=True)

    class Meta:
        model = Plan
        fields = [
            "id", "slug", "nombre", "descripcion", "permisos", "caracteristicas",
            "limites", "limites_efectivos", "estado", "activo", "orden",
            "es_predeterminado", "version", "origen", "trial_dias",
            "precios", "precio_mensual", "moneda", "productos", "negocios",
        ]
        read_only_fields = ["version", "origen"]

    def get_negocios(self, obj):
        """Cuántas empresas lo tienen contratado: el dato que decide si un plan se puede retirar."""
        return obj.suscripciones.count()

    def get_precio_mensual(self, obj):
        return str(obj.importe_mensual())

    def get_moneda(self, obj):
        vigente = obj.precios.vigentes().first()
        return vigente.moneda if vigente else Moneda.COP

    def get_productos(self, obj):
        return [
            {"id": p.id, "slug": p.slug, "nombre": p.nombre}
            for p in obj.productos()
        ]

    def get_limites_efectivos(self, obj):
        """
        Lo que este plan concede de cada recurso, ya resuelto.

        Incluye los que el plan no fija, con el valor por defecto del catálogo:
        de otro modo el panel tendría que repetir la regla de herencia y
        acabaría mostrando "sin configurar" donde hay un límite real.
        """
        propios = obj.limites or {}
        salida = {}
        for tipo in TipoLimite.objects.filter(activo=True):
            salida[tipo.codigo] = {
                "valor": propios[tipo.codigo]
                if tipo.codigo in propios
                else tipo.valor_por_defecto,
                "propio": tipo.codigo in propios,
            }
        return salida

    def validate_permisos(self, valor):
        if not isinstance(valor, list):
            raise serializers.ValidationError("Debe ser una lista de codenames.")
        conocidos = set(PermisoDisponible.objects.values_list("codename", flat=True))
        desconocidos = sorted(set(valor) - conocidos)
        if desconocidos:
            # Un codename que no existe no concedería nada y sería invisible
            # hasta que alguien se preguntara por qué un plan no funciona.
            raise serializers.ValidationError(
                f"Estos permisos no existen en el catálogo: {', '.join(desconocidos)}"
            )
        return sorted(set(valor))

    def validate_limites(self, valor):
        if not isinstance(valor, dict):
            raise serializers.ValidationError("Debe ser un objeto de código → valor.")
        conocidos = set(TipoLimite.objects.values_list("codigo", flat=True))
        desconocidos = sorted(set(valor) - conocidos)
        if desconocidos:
            raise serializers.ValidationError(
                f"Estos límites no están en el catálogo: {', '.join(desconocidos)}. "
                "Créalos en Tipos de límite antes de configurarlos."
            )
        for clave, numero in valor.items():
            if numero is not None and (not isinstance(numero, int) or numero < 0):
                raise serializers.ValidationError(
                    f"«{clave}» debe ser un entero no negativo, o vacío para «sin límite»."
                )
        return valor


class PlanBreveSerializer(serializers.ModelSerializer):
    """Lo justo para una lista o un selector, sin arrastrar precios ni límites."""

    precio_mensual = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = ["id", "slug", "nombre", "estado", "version", "precio_mensual"]

    def get_precio_mensual(self, obj):
        return str(obj.importe_mensual())


# ==========================================================================
# Empresas y suscripciones
# ==========================================================================
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
    importe_mensual = serializers.SerializerMethodField()
    limites_efectivos = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = [
            "id", "tenant", "negocio", "plan", "plan_nombre", "estado",
            "fecha_inicio", "fecha_fin", "fecha_fin_prueba", "moneda",
            "periodicidad", "importe_pactado", "importe_mensual",
            "limites_extra", "limites_efectivos", "notas",
        ]
        read_only_fields = ["fecha_inicio"]

    def get_importe_mensual(self, obj):
        return str(obj.importe_mensual())

    def get_limites_efectivos(self, obj):
        """
        Lo que rige para esta empresa, y de dónde sale cada número.

        `origen` es lo que permite que el panel muestre «20 del plan → 35
        pactado» en vez de un 35 sin explicación, que es justo lo que hace
        imposible auditar un acuerdo especial seis meses después.
        """
        extra = obj.limites_extra or {}
        propios = obj.plan.limites or {}
        salida = {}
        for tipo in TipoLimite.objects.filter(activo=True):
            del_plan = (
                propios[tipo.codigo]
                if tipo.codigo in propios
                else tipo.valor_por_defecto
            )
            pactado = tipo.codigo in extra
            salida[tipo.codigo] = {
                "valor": extra[tipo.codigo] if pactado else del_plan,
                "del_plan": del_plan,
                "origen": "SUSCRIPCION" if pactado else "PLAN",
            }
        return salida

    def validate_limites_extra(self, valor):
        if not isinstance(valor, dict):
            raise serializers.ValidationError("Debe ser un objeto de código → valor.")
        conocidos = set(TipoLimite.objects.values_list("codigo", flat=True))
        desconocidos = sorted(set(valor) - conocidos)
        if desconocidos:
            raise serializers.ValidationError(
                f"Estos límites no están en el catálogo: {', '.join(desconocidos)}"
            )
        return valor

    def validate_importe_pactado(self, valor):
        if valor is not None and valor < Decimal("0"):
            raise serializers.ValidationError("No puede ser negativo.")
        return valor


class DuplicarPlanSerializer(serializers.Serializer):
    """La entrada de `POST /plans/<id>/duplicar/`."""

    slug = serializers.SlugField(max_length=50)
    nombre = serializers.CharField(max_length=80, required=False, allow_blank=True)
    nueva_version = serializers.BooleanField(default=False)

    def validate_slug(self, valor):
        if Plan.objects.filter(slug=valor).exists():
            raise serializers.ValidationError("Ya existe un plan con ese identificador.")
        return valor


class AltaNegocioSerializer(serializers.Serializer):
    """
    Dar de alta un cliente desde el Control Center.

    Es un flujo, no un CRUD, y por eso tiene su propio serializador en vez de
    dejar que `NegocioSerializer` cree filas: un negocio nuevo necesita
    configuración de tienda, suscripción y páginas, y todo eso lo montan las
    señales de `Tenant`. Aquí solo se recogen las decisiones que no tienen un
    valor por defecto razonable.
    """

    nombre = serializers.CharField(max_length=150)
    slug = serializers.SlugField(max_length=63)
    #: El subdominio o dominio propio por el que se llegará. Sin él, el negocio
    #: existe pero su tienda no responde en ninguna dirección.
    dominio = serializers.CharField(max_length=253, required=False, allow_blank=True)
    plan = serializers.SlugField(required=False, allow_blank=True)
    plantilla = serializers.SlugField(required=False, allow_blank=True)
    #: Aplicar también el aspecto de la plantilla, no solo sus secciones.
    aplicar_tema = serializers.BooleanField(default=True)
    estado = serializers.ChoiceField(
        choices=Tenant.ESTADOS, default="PRUEBA"
    )

    def validate_slug(self, valor):
        from apps.tenancy.context import ambito_de_plataforma  # noqa: PLC0415

        with ambito_de_plataforma():
            if Tenant.objects.filter(slug=valor).exists():
                raise serializers.ValidationError("Ya existe una empresa con ese identificador.")
        return valor

    def validate_dominio(self, valor):
        from apps.tenancy.context import ambito_de_plataforma  # noqa: PLC0415
        from apps.tenancy.models import Domain  # noqa: PLC0415

        limpio = (valor or "").strip().lower()
        if not limpio:
            return ""
        with ambito_de_plataforma():
            if Domain.objects.filter(hostname=limpio).exists():
                # Dos negocios en el mismo host haría imposible resolver cuál
                # atiende la petición; la base lo impide y esto lo explica.
                raise serializers.ValidationError(
                    "Ese dominio ya está conectado a otra empresa."
                )
        return limpio

    def validate_plan(self, valor):
        if valor and not Plan.objects.filter(slug=valor).exists():
            raise serializers.ValidationError("No existe ese plan.")
        return valor


class AplicarPlantillaSerializer(serializers.Serializer):
    """Asignar una plantilla de tienda a un negocio, desde la plataforma."""

    plantilla = serializers.SlugField()
    aplicar_tema = serializers.BooleanField(default=True)
    #: Publicar deja la tienda cambiada de inmediato. Sin esto queda en
    #: borrador y el negocio decide cuándo enseñarla.
    publicar = serializers.BooleanField(default=False)


class CambiarPlanSerializer(serializers.Serializer):
    """La entrada de `POST /tenants/<id>/cambiar-plan/`."""

    plan = serializers.SlugField()
    moneda = serializers.ChoiceField(choices=Moneda.choices, required=False)
    periodicidad = serializers.ChoiceField(choices=Periodicidad.choices, required=False)

    def validate_plan(self, valor):
        plan = Plan.objects.filter(slug=valor).first()
        if plan is None:
            raise serializers.ValidationError("No existe ese plan.")
        if plan.estado == EstadoComercial.BORRADOR:
            # Un borrador es un plan a medio configurar; contratarlo dejaría a
            # la empresa con los permisos y los precios a medias.
            raise serializers.ValidationError(
                "Ese plan todavía es un borrador. Publícalo antes de asignarlo."
            )
        return valor
