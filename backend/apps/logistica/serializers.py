import re
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.orders.models import Pedido

from .esquemas import calcular_esquema, validar_config
from .models import Furgon, PedidoDespacho, PlanoCarga, TipoCanastilla

COLOR_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
MAX_GRUPOS = 200


def calcular_rejilla(furgon, tipo) -> dict:
    """El esquema de carga del vehículo (nombre histórico: antes era solo rejilla)."""
    return calcular_esquema(furgon, tipo)


def coordenadas(medidas: dict, pila: int, nivel: int) -> dict:
    """
    Centro de la canastilla en cm, en el sistema del furgón: x a lo largo desde
    la pared frontal (cabina), y a lo ancho desde la pared izquierda, z desde el
    piso. `rotacion` es el giro sobre el eje vertical (0 o 90 grados).
    """
    hueco = medidas["pilas"][pila]
    return {
        "x_cm": hueco["x"],
        "y_cm": hueco["y"],
        "z_cm": round((nivel + 0.5) * medidas["canastilla"]["alto"], 1),
        "rotacion": hueco["rot"],
    }


def revisar(plano_datos: dict, furgon: Furgon, tipo: TipoCanastilla) -> dict:
    """
    Lo que hay que mirar antes de confirmar un despacho.

    `errores` impiden confirmar; `advertencias` se muestran pero no bloquean
    (por ejemplo, un peso que no se puede verificar porque falta el dato).
    """
    grupos = plano_datos.get("grupos") or []
    posiciones = plano_datos.get("posiciones") or []
    medidas = plano_datos.get("medidas") or {}
    errores, advertencias = [], []

    if not grupos:
        errores.append("El despacho no tiene destinos.")
    total = sum(g["cantidad"] for g in grupos)
    ubicadas = len(posiciones)
    if ubicadas < total:
        errores.append(f"Faltan {total - ubicadas} canastillas por ubicar en el furgón.")
    ordenes = [g["orden"] for g in grupos]
    if len(set(ordenes)) != len(ordenes):
        errores.append("Dos destinos tienen el mismo orden de entrega.")

    # Peso: solo se valida si se conocen los dos datos; si falta uno, se avisa.
    peso_total = None
    if tipo.peso_lleno_kg is not None:
        peso_total = Decimal(ubicadas) * tipo.peso_lleno_kg
    if peso_total is not None and furgon.carga_util_kg:
        if peso_total > furgon.carga_util_kg:
            errores.append(
                f"El peso estimado ({peso_total:.0f} kg) supera la carga útil del vehículo ({furgon.carga_util_kg} kg)."
            )
    else:
        falta = "la carga útil del vehículo" if not furgon.carga_util_kg else "el peso de la canastilla llena"
        advertencias.append(f"No se puede validar el peso: falta {falta}.")
    errores += medidas.get("errores") or []
    advertencias += medidas.get("avisos") or []
    if not furgon.medidas_verificadas:
        advertencias.append("Las medidas interiores del furgón no están marcadas como verificadas.")

    # Orden de entrega: una canastilla que se entrega DESPUÉS no debe estorbar
    # a una que se entrega ANTES. Siempre estorba si está ENCIMA en la misma
    # pila. Si a la pila se llega desde la puerta (rejilla), también estorba
    # la que está más cerca de la puerta; si se llega por el pasillo central,
    # no: cada pila lateral se alcanza desde el pasillo.
    orden_de = {g["id"]: g["orden"] for g in grupos}
    nombre_de = {g["id"]: g["nombre"] for g in grupos}
    pilas = medidas.get("pilas") or []
    estorbos = {}
    for b in posiciones:
        for a in posiciones:
            if orden_de.get(b["grupo"], 0) <= orden_de.get(a["grupo"], 0):
                continue
            pa, pb = pilas[a["pila"]], pilas[b["pila"]]
            encima = a["pila"] == b["pila"] and b["nivel"] > a["nivel"]
            delante = pa["acceso"] == "puerta" and pb["x"] > pa["x"]
            if delante or encima:
                clave = (b["grupo"], a["grupo"])
                estorbos[clave] = estorbos.get(clave, 0) + 1
                break
    for (tarde, temprano), n in estorbos.items():
        advertencias.append(
            f"{n} canastilla(s) de «{nombre_de[tarde]}» (entrega {orden_de[tarde]}) quedan delante de "
            f"«{nombre_de[temprano]}» (entrega {orden_de[temprano]}): habría que moverlas para descargar."
        )

    capacidad = medidas.get("capacidad", 0)
    c = medidas.get("canastilla") or {}
    vol_canastilla = (c.get("largo", 0) * c.get("ancho", 0) * c.get("alto", 0)) / 1_000_000
    return {
        "errores": errores,
        "advertencias": advertencias,
        "indicadores": {
            "canastillas_total": total,
            "canastillas_ubicadas": ubicadas,
            "capacidad_canastillas": capacidad,
            "volumen_furgon_m3": round(furgon.largo_cm * furgon.ancho_cm * furgon.alto_cm / 1_000_000, 2),
            "volumen_ocupado_m3": round(ubicadas * vol_canastilla, 2),
            "peso_estimado_kg": float(peso_total) if peso_total is not None else None,
            "carga_util_kg": furgon.carga_util_kg,
        },
    }


class FurgonSerializer(serializers.ModelSerializer):
    volumen_m3 = serializers.SerializerMethodField()

    class Meta:
        model = Furgon
        fields = [
            "id", "nombre", "placa", "referencia", "modelo_3d",
            "largo_cm", "ancho_cm", "alto_cm", "volumen_m3",
            "carga_util_kg", "distancia_entre_ejes_mm", "altura_piso_mm",
            "medidas_verificadas", "esquema_carga", "activo",
        ]

    def validate_esquema_carga(self, valor):
        try:
            return validar_config(valor)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def get_volumen_m3(self, obj):
        return round(obj.largo_cm * obj.ancho_cm * obj.alto_cm / 1_000_000, 2)


class TipoCanastillaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoCanastilla
        fields = ["id", "nombre", "largo_cm", "ancho_cm", "alto_cm", "max_apiladas", "peso_lleno_kg", "activa"]


class PlanoCargaListaSerializer(serializers.ModelSerializer):
    """Lo justo para la lista de despachos, sin el detalle del acomodo."""

    furgon_nombre = serializers.CharField(source="furgon.nombre", read_only=True)
    modelo_3d = serializers.CharField(source="furgon.modelo_3d", read_only=True)
    total_canastillas = serializers.SerializerMethodField()
    total_pedidos = serializers.SerializerMethodField()
    total_destinos = serializers.SerializerMethodField()
    capacidad = serializers.SerializerMethodField()

    class Meta:
        model = PlanoCarga
        fields = [
            "id", "nombre", "fecha", "estado", "furgon", "furgon_nombre", "modelo_3d",
            "total_canastillas", "total_pedidos", "total_destinos", "capacidad", "ruta_clave", "actualizado",
        ]

    def get_total_canastillas(self, obj):
        return len(obj.posiciones or [])

    def get_total_pedidos(self, obj):
        return obj.pedidos.count()

    def get_total_destinos(self, obj):
        return len(obj.grupos or [])

    def get_capacidad(self, obj):
        return (obj.medidas or {}).get("capacidad", 0)


class PedidoAsignadoSerializer(serializers.Serializer):
    """Un pedido dentro del despacho: escritura (pedido, grupo, canastillas)."""

    pedido = serializers.IntegerField()
    grupo = serializers.CharField(max_length=40)
    #: 0 = el pedido va consolidado en las canastillas de otro pedido del mismo destino.
    canastillas = serializers.IntegerField(min_value=0, max_value=500)


def pedido_resumen(pedido: Pedido) -> dict:
    return {
        "id": pedido.id,
        "cliente_id": pedido.cliente_id,
        "cliente_nombre": pedido.cliente.nombre_cliente if pedido.cliente else "",
        "direccion": pedido.direccion_de_entrega,
        "telefono": (pedido.cliente.telefono_cliente if pedido.cliente else "") or "",
        "estado": pedido.estado,
        "total": str(pedido.total_pedido),
        "fecha_programada": pedido.fecha_programada.isoformat() if getattr(pedido, "fecha_programada", None) else None,
    }


class PlanoCargaSerializer(serializers.ModelSerializer):
    furgon_nombre = serializers.CharField(source="furgon.nombre", read_only=True)
    creado_por_nombre = serializers.CharField(source="creado_por.nombre_usuario", read_only=True, default="")
    confirmado_por_nombre = serializers.CharField(source="confirmado_por.nombre_usuario", read_only=True, default="")
    pedidos = PedidoAsignadoSerializer(many=True, required=False, write_only=True)
    pedidos_detalle = serializers.SerializerMethodField()
    entregas = serializers.SerializerMethodField()
    revision = serializers.SerializerMethodField()

    class Meta:
        model = PlanoCarga
        fields = [
            "id", "nombre", "fecha", "estado", "furgon", "furgon_nombre", "tipo_canastilla",
            "medidas", "grupos", "posiciones", "bloqueos", "notas",
            "pedidos", "pedidos_detalle", "entregas", "revision", "ruta_clave",
            "creado_por_nombre", "confirmado_por_nombre", "confirmado_en", "creado", "actualizado",
        ]
        read_only_fields = ["medidas", "estado", "ruta_clave", "confirmado_en", "creado", "actualizado"]

    # ---------- lectura ----------
    def get_pedidos_detalle(self, obj):
        filas = obj.pedidos.select_related("pedido__cliente").all()
        return [{**pedido_resumen(f.pedido), "grupo": f.grupo, "canastillas": f.canastillas} for f in filas]

    def get_entregas(self, obj):
        """
        Por destino, sus pedidos y productos consolidados: lo que el editor 3D
        muestra para acomodar cada pedido. Confirmado = la copia congelada.
        """
        from .planificacion import datos_operativos  # noqa: PLC0415 — import circular

        congelados = obj.datos_operativos if obj.estado == PlanoCarga.CONFIRMADO else None
        datos = congelados if congelados and "paradas" in congelados else datos_operativos(obj)
        return datos["paradas"]

    def get_revision(self, obj):
        return revisar(
            {"grupos": obj.grupos, "posiciones": obj.posiciones, "medidas": obj.medidas}, obj.furgon, obj.tipo_canastilla
        )

    # ---------- validación ----------
    def _del_negocio(self, obj, campo):
        tenant = self.context.get("tenant")
        if obj is not None and tenant is not None and obj.tenant_id != tenant.id:
            raise serializers.ValidationError({campo: "No existe."})
        return obj

    def validate_furgon(self, valor):
        return self._del_negocio(valor, "furgon")

    def validate_tipo_canastilla(self, valor):
        return self._del_negocio(valor, "tipo_canastilla")

    def validate_grupos(self, grupos):
        if not isinstance(grupos, list):
            raise serializers.ValidationError("Debe ser una lista.")
        if len(grupos) > MAX_GRUPOS:
            raise serializers.ValidationError(f"Máximo {MAX_GRUPOS} grupos por despacho.")
        limpios, ids = [], set()
        for g in grupos:
            if not isinstance(g, dict):
                raise serializers.ValidationError("Cada grupo debe ser un objeto.")
            gid = str(g.get("id", "")).strip()[:40]
            nombre = str(g.get("nombre", "")).strip()[:80]
            cantidad, orden = g.get("cantidad"), g.get("orden")
            color = str(g.get("color", ""))
            if not gid or gid in ids:
                raise serializers.ValidationError("Cada grupo necesita un id único.")
            if not nombre:
                raise serializers.ValidationError("Cada grupo necesita un nombre.")
            if not isinstance(cantidad, int) or isinstance(cantidad, bool) or not 1 <= cantidad <= 2000:
                raise serializers.ValidationError(f"«{nombre}»: la cantidad debe estar entre 1 y 2000.")
            if not isinstance(orden, int) or isinstance(orden, bool) or not 1 <= orden <= 999:
                raise serializers.ValidationError(f"«{nombre}»: el orden de entrega debe estar entre 1 y 999.")
            if not COLOR_HEX.match(color):
                raise serializers.ValidationError(f"«{nombre}»: color inválido.")
            ids.add(gid)
            limpio = {"id": gid, "nombre": nombre, "cantidad": cantidad, "orden": orden, "color": color}
            numero = g.get("numero")
            if numero is not None:
                if not isinstance(numero, int) or isinstance(numero, bool) or not 1 <= numero <= 999:
                    raise serializers.ValidationError(f"«{nombre}»: el número debe estar entre 1 y 999.")
                limpio["numero"] = numero
            direccion = str(g.get("direccion", "") or "").strip()[:300]
            if direccion:
                limpio["direccion"] = direccion
            cliente = g.get("cliente")
            if cliente is not None:
                if not isinstance(cliente, int) or isinstance(cliente, bool) or cliente < 1:
                    raise serializers.ValidationError(f"«{nombre}»: cliente inválido.")
                limpio["cliente"] = cliente
            limpios.append(limpio)
        return limpios

    def validate(self, attrs):
        instancia = self.instance
        if instancia and instancia.estado == PlanoCarga.CONFIRMADO:
            raise serializers.ValidationError("El despacho está confirmado: reábrelo para modificarlo.")

        furgon = attrs.get("furgon", getattr(instancia, "furgon", None))
        tipo = attrs.get("tipo_canastilla", getattr(instancia, "tipo_canastilla", None))

        # La rejilla se conserva mientras no cambien el furgón ni la
        # canastilla: así un plano viejo no se deforma si alguien edita las
        # medidas del vehículo después.
        if instancia and furgon == instancia.furgon and tipo == instancia.tipo_canastilla and instancia.medidas:
            medidas = instancia.medidas
        else:
            medidas = calcular_rejilla(furgon, tipo)
        if medidas.get("errores"):
            raise serializers.ValidationError({"esquema": medidas["errores"]})
        if medidas["capacidad"] == 0:
            raise serializers.ValidationError("La canastilla no cabe en este furgón: revisa las medidas.")
        attrs["medidas"] = medidas
        bloqueos = attrs.get("bloqueos", getattr(instancia, "bloqueos", []) or [])
        if not isinstance(bloqueos, list) or any(
            not isinstance(b, int) or isinstance(b, bool) or not 0 <= b < len(medidas["pilas"]) for b in bloqueos
        ):
            raise serializers.ValidationError({"bloqueos": "Hay pilas bloqueadas que no existen."})
        attrs["bloqueos"] = sorted(set(bloqueos))

        grupos = attrs.get("grupos", getattr(instancia, "grupos", []))
        if "pedidos" in attrs:
            attrs["pedidos"] = self._validar_pedidos(attrs["pedidos"], grupos, instancia)
            # Un destino con pedidos lleva exactamente la suma de sus canastillas.
            suma = {}
            for p in attrs["pedidos"]:
                suma[p["grupo"]] = suma.get(p["grupo"], 0) + p["canastillas"]
            vacio = next((g for g in grupos if suma.get(g["id"], 1) < 1), None)
            if vacio:
                raise serializers.ValidationError({"pedidos": f"«{vacio['nombre']}» necesita al menos una canastilla."})
            grupos = [{**g, "cantidad": suma.get(g["id"], g["cantidad"])} for g in grupos]
            attrs["grupos"] = grupos
        elif instancia and "grupos" in attrs:
            # Un destino con pedidos no se puede quitar sin reasignar sus pedidos.
            ids = {g["id"] for g in grupos}
            huerfano = instancia.pedidos.exclude(grupo__in=ids).first()
            if huerfano:
                raise serializers.ValidationError(
                    {"grupos": f"El pedido #{huerfano.pedido_id} está en un destino que quitaste: reasígnalo desde la planificación."}
                )
        posiciones = attrs.get("posiciones", getattr(instancia, "posiciones", []))
        attrs["posiciones"] = self._validar_posiciones(posiciones, grupos, medidas)
        return attrs

    def _validar_pedidos(self, pedidos, grupos, instancia):
        tenant = self.context.get("tenant")
        ids_grupo = {g["id"] for g in grupos}
        vistos = set()
        for p in pedidos:
            if p["pedido"] in vistos:
                raise serializers.ValidationError({"pedidos": f"El pedido #{p['pedido']} está repetido."})
            vistos.add(p["pedido"])
            if p["grupo"] not in ids_grupo:
                raise serializers.ValidationError({"pedidos": f"El pedido #{p['pedido']} apunta a un destino que no existe."})
        existentes = set(Pedido.objects.filter(tenant=tenant, id__in=vistos).values_list("id", flat=True))
        if existentes != vistos:
            raise serializers.ValidationError({"pedidos": "Hay pedidos que no existen."})
        otros = PedidoDespacho.objects.filter(pedido_id__in=vistos).select_related("plano")
        if instancia:
            otros = otros.exclude(plano=instancia)
        ocupado = otros.first()
        if ocupado:
            raise serializers.ValidationError(
                {"pedidos": f"El pedido #{ocupado.pedido_id} ya está en el despacho «{ocupado.plano.nombre}»."}
            )
        # Un pedido reservado en un lote se reparte en ese lote, no a mano.
        from .planificacion import reservados_en_lote  # noqa: PLC0415 — import circular

        propio = getattr(instancia, "lote_id", None) or self.context.get("lote")
        ajenos = reservados_en_lote(tenant, vistos, excepto=propio)
        if ajenos:
            pedido, numero = next(iter(ajenos.items()))
            raise serializers.ValidationError(
                {"pedidos": f"El pedido #{pedido} está reservado en el lote de despacho #{numero}: ármalo desde allí."}
            )
        return pedidos

    def _validar_posiciones(self, posiciones, grupos, medidas):
        if not isinstance(posiciones, list):
            raise serializers.ValidationError({"posiciones": "Debe ser una lista."})
        cantidades = {g["id"]: g["cantidad"] for g in grupos}
        ocupado, por_grupo, limpias = set(), {}, []
        for p in posiciones:
            if not isinstance(p, dict):
                raise serializers.ValidationError({"posiciones": "Cada posición debe ser un objeto."})
            grupo = str(p.get("grupo", ""))
            pila, nivel = p.get("pila"), p.get("nivel")
            if grupo not in cantidades:
                raise serializers.ValidationError({"posiciones": "Hay una canastilla de un grupo que no existe."})
            for valor, tope in ((pila, len(medidas["pilas"])), (nivel, medidas["niveles"])):
                if not isinstance(valor, int) or isinstance(valor, bool) or not 0 <= valor < tope:
                    raise serializers.ValidationError({"posiciones": "Hay una canastilla fuera del furgón."})
            hueco = (pila, nivel)
            if hueco in ocupado:
                raise serializers.ValidationError({"posiciones": "Dos canastillas ocupan el mismo lugar."})
            ocupado.add(hueco)
            por_grupo[grupo] = por_grupo.get(grupo, 0) + 1
            limpias.append({"grupo": grupo, "pila": pila, "nivel": nivel, **coordenadas(medidas, pila, nivel)})

        for pila, nivel in ocupado:
            if nivel > 0 and (pila, nivel - 1) not in ocupado:
                raise serializers.ValidationError({"posiciones": "Hay una canastilla flotando sin otra debajo."})
        for grupo, n in por_grupo.items():
            if n > cantidades[grupo]:
                raise serializers.ValidationError({"posiciones": "Un grupo tiene más canastillas ubicadas que su cantidad."})
        return limpias

    # ---------- guardado ----------
    def _guardar_pedidos(self, plano, pedidos):
        if pedidos is None:
            return
        plano.pedidos.all().delete()
        PedidoDespacho.objects.bulk_create(
            [
                PedidoDespacho(tenant=plano.tenant, plano=plano, pedido_id=p["pedido"], grupo=p["grupo"],
                               canastillas=p["canastillas"])
                for p in pedidos
            ]
        )

    @transaction.atomic
    def create(self, validated_data):
        pedidos = validated_data.pop("pedidos", None)
        plano = super().create(validated_data)
        self._guardar_pedidos(plano, pedidos)
        return plano

    @transaction.atomic
    def update(self, instance, validated_data):
        pedidos = validated_data.pop("pedidos", None)
        plano = super().update(instance, validated_data)
        self._guardar_pedidos(plano, pedidos)
        return plano
