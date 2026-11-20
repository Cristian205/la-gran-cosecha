"""
Serializadores de la programación semanal: plantillas, rutas con sus paradas,
ajustes por fecha y reglas de carga por presentación.

Las paradas referencian `orders.Cliente`: no se copian clientes. Todo lo que
llega por id se comprueba contra el negocio de la petición.
"""
from django.db import transaction
from rest_framework import serializers

from apps.orders.models import Cliente

from .models import AjusteRuta, ParadaRuta, ProgramacionSemanal, Ruta
from .serializers import COLOR_HEX

MAX_PARADAS = 150


def limpiar_paradas(paradas, tenant) -> list[dict]:
    """[{cliente, nota}] en orden de visita: clientes del negocio y sin repetir."""
    if not isinstance(paradas, list):
        raise serializers.ValidationError("Las paradas deben ser una lista.")
    if len(paradas) > MAX_PARADAS:
        raise serializers.ValidationError(f"Máximo {MAX_PARADAS} paradas por ruta.")
    limpias, vistos = [], set()
    for p in paradas:
        cliente = p.get("cliente") if isinstance(p, dict) else None
        if not isinstance(cliente, int) or isinstance(cliente, bool):
            raise serializers.ValidationError("Cada parada necesita un cliente.")
        if cliente in vistos:
            raise serializers.ValidationError("Un cliente aparece dos veces en la misma ruta.")
        vistos.add(cliente)
        limpias.append({"cliente": cliente, "nota": str(p.get("nota", "") or "").strip()[:200]})
    existentes = set(Cliente.objects.filter(tenant=tenant, id__in=vistos).values_list("id", flat=True))
    if existentes != vistos:
        raise serializers.ValidationError("Hay clientes que no existen.")
    return limpias


def paradas_lectura(ids_notas: list[dict]) -> list[dict]:
    clientes = Cliente.objects.in_bulk([p["cliente"] for p in ids_notas])
    return [
        {
            "cliente": p["cliente"],
            "cliente_nombre": clientes[p["cliente"]].nombre_cliente,
            "direccion": clientes[p["cliente"]].direccion_cliente or "",
            "nota": p.get("nota", ""),
            "orden": i + 1,
        }
        for i, p in enumerate(ids_notas)
        if p["cliente"] in clientes
    ]


class DelNegocioMixin:
    def del_negocio(self, obj, campo):
        tenant = self.context.get("tenant")
        if obj is not None and tenant is not None and obj.tenant_id != tenant.id:
            raise serializers.ValidationError({campo: "No existe."})
        return obj

    def validate_color(self, valor):
        if not COLOR_HEX.match(valor or ""):
            raise serializers.ValidationError("Color inválido.")
        return valor

    def validate_paradas(self, valor):
        return limpiar_paradas(valor, self.context.get("tenant"))


class ProgramacionSemanalSerializer(serializers.ModelSerializer):
    total_rutas = serializers.SerializerMethodField()

    class Meta:
        model = ProgramacionSemanal
        fields = ["id", "nombre", "activa", "notas", "total_rutas", "creado", "actualizado"]
        read_only_fields = ["activa", "creado", "actualizado"]

    def get_total_rutas(self, obj):
        return obj.rutas.count()


class RutaSerializer(DelNegocioMixin, serializers.ModelSerializer):
    furgon_nombre = serializers.CharField(source="furgon.nombre", read_only=True)
    furgon_placa = serializers.CharField(source="furgon.placa", read_only=True)
    paradas = serializers.JSONField(required=False)

    class Meta:
        model = Ruta
        fields = [
            "id", "programacion", "dia_semana", "nombre", "furgon", "furgon_nombre", "furgon_placa",
            "color", "notas", "paradas",
        ]
        # La unicidad (un vehículo por día) se valida en `validate` con un
        # mensaje que nombra el vehículo, no con el genérico de DRF.
        validators = []

    def to_representation(self, obj):
        datos = super().to_representation(obj)
        datos["paradas"] = [
            {
                "cliente": p.cliente_id,
                "cliente_nombre": p.cliente.nombre_cliente,
                "direccion": p.cliente.direccion_cliente or "",
                "nota": p.nota,
                "orden": p.orden,
            }
            for p in obj.paradas.select_related("cliente").order_by("orden")
        ]
        return datos

    def validate_programacion(self, valor):
        return self.del_negocio(valor, "programacion")

    def validate_furgon(self, valor):
        return self.del_negocio(valor, "furgon")

    def validate(self, attrs):
        inst = self.instance
        prog = attrs.get("programacion", getattr(inst, "programacion", None))
        dia = attrs.get("dia_semana", getattr(inst, "dia_semana", None))
        furgon = attrs.get("furgon", getattr(inst, "furgon", None))
        otra = Ruta.objects.filter(programacion=prog, dia_semana=dia, furgon=furgon)
        if inst:
            otra = otra.exclude(pk=inst.pk)
        if otra.exists():
            raise serializers.ValidationError(f"«{furgon.nombre}» ya tiene una ruta ese día en esta programación.")
        return attrs

    def _guardar_paradas(self, ruta, paradas):
        if paradas is None:
            return
        ruta.paradas.all().delete()
        ParadaRuta.objects.bulk_create(
            [
                ParadaRuta(tenant_id=ruta.tenant_id, ruta=ruta, cliente_id=p["cliente"], orden=i + 1, nota=p["nota"])
                for i, p in enumerate(paradas)
            ]
        )

    @transaction.atomic
    def create(self, validated_data):
        paradas = validated_data.pop("paradas", None)
        ruta = super().create(validated_data)
        self._guardar_paradas(ruta, paradas)
        return ruta

    @transaction.atomic
    def update(self, instance, validated_data):
        paradas = validated_data.pop("paradas", None)
        ruta = super().update(instance, validated_data)
        self._guardar_paradas(ruta, paradas)
        return ruta


class AjusteRutaSerializer(DelNegocioMixin, serializers.ModelSerializer):
    furgon_nombre = serializers.CharField(source="furgon.nombre", read_only=True, default="")
    paradas = serializers.JSONField(required=False)

    class Meta:
        model = AjusteRuta
        fields = ["id", "fecha", "ruta", "cancelada", "nombre", "furgon", "furgon_nombre", "color", "paradas", "motivo"]
        validators = []

    def to_representation(self, obj):
        datos = super().to_representation(obj)
        datos["paradas"] = paradas_lectura(obj.paradas or [])
        return datos

    def validate_ruta(self, valor):
        return self.del_negocio(valor, "ruta")

    def validate_furgon(self, valor):
        return self.del_negocio(valor, "furgon")

    def validate(self, attrs):
        inst = self.instance
        ruta = attrs.get("ruta", getattr(inst, "ruta", None))
        fecha = attrs.get("fecha", getattr(inst, "fecha", None))
        cancelada = attrs.get("cancelada", getattr(inst, "cancelada", False))
        if ruta and fecha and ruta.dia_semana != fecha.weekday():
            raise serializers.ValidationError("La ruta no sale ese día de la semana.")
        if not ruta and cancelada:
            raise serializers.ValidationError("Solo se cancela una ruta de la programación.")
        if not cancelada and not attrs.get("furgon", getattr(inst, "furgon", None)):
            raise serializers.ValidationError({"furgon": "Elige el vehículo."})
        if not attrs.get("nombre", getattr(inst, "nombre", "")):
            attrs["nombre"] = ruta.nombre if ruta else "Ruta extra"
        if ruta:
            otro = AjusteRuta.objects.filter(ruta=ruta, fecha=fecha)
            if inst:
                otro = otro.exclude(pk=inst.pk)
            if otro.exists():
                raise serializers.ValidationError("Esa ruta ya tiene un ajuste para esa fecha: edítalo.")
        return attrs
