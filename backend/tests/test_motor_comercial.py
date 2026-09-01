"""
El motor comercial: catálogo, precios, límites y versionado.

Lo que se comprueba aquí no es que los modelos guarden campos, sino la promesa
que sostiene el diseño: que cambiar una tarifa, un límite o un plan entero es
una edición de datos y nunca un despliegue. Cada test es una de las reglas de
oro del encargo escrita como aserción.

Las migraciones ya corrieron cuando pytest crea la base, así que los planes y
permisos que se leen aquí son exactamente los que dejó el traslado de la 0004.
"""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import (
    Caracteristica,
    PermisoDisponible,
    Plan,
    PrecioPlan,
    Producto,
    Subscription,
    TipoLimite,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff_plataforma(negocio):
    usuario = get_user_model().objects.create_user(
        email_usuario="comercial@ejemplo.test",
        nombre_usuario="Equipo Crynex",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    usuario.es_staff_plataforma = True
    usuario.save(update_fields=["es_staff_plataforma"])

    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


# ==========================================================================
# EL TRASLADO DE LA 0004
# ==========================================================================
def test_los_modulos_de_los_permisos_se_volvieron_productos():
    """
    Cada `modulo` distinto tiene ahora su fila, y ningún permiso quedó suelto.

    Era una cadena repetida en cada permiso; sin esto, un producto no podía
    tener descripción, categoría ni estado propios.
    """
    modulos = set(
        PermisoDisponible.objects.values_list("modulo", flat=True).distinct()
    )
    assert modulos, "la siembra de la 0002 debería haber dejado permisos"
    assert modulos == set(Producto.objects.values_list("nombre", flat=True))
    assert not PermisoDisponible.objects.filter(producto__isnull=True).exists()


def test_el_precio_de_cada_plan_paso_a_ser_una_fila():
    """El importe dejó de vivir en una columna del plan."""
    growth = Plan.objects.get(slug="growth")
    precio = growth.precios.get(periodicidad="MENSUAL")

    assert precio.importe == Decimal("89000.00")
    assert precio.moneda == "COP"
    assert precio.vigente_hasta is None
    assert growth.importe_mensual() == Decimal("89000.00")


def test_un_plan_gratuito_no_recibio_fila_de_precio():
    """
    Cero se deduce de no tener tarifa, y no se guarda como tarifa de cero.

    Una fila de 0,00 daría a entender que alguien fijó ese precio a propósito.
    """
    starter = Plan.objects.get(slug="starter")
    assert not starter.precios.exists()
    assert starter.importe_mensual() == Decimal("0")


def test_los_limites_que_usaban_los_planes_estan_en_el_catalogo():
    """
    Sin esto, el serializador rechazaría al primer guardado un límite que los
    planes ya venían usando.
    """
    codigos = set(TipoLimite.objects.values_list("codigo", flat=True))
    for plan in Plan.objects.all():
        assert set(plan.limites or {}) <= codigos


def test_un_plan_desactivado_quedo_archivado_y_no_borrador():
    """Un plan que ya se vendió no vuelve a ser un borrador."""
    plan = Plan.objects.create(slug="viejo", nombre="Viejo", estado="ARCHIVADO")
    assert plan.activo is False
    assert Plan.objects.get(slug="starter").activo is True


# ==========================================================================
# NADA COMERCIAL VIVE EN EL CÓDIGO
# ==========================================================================
def test_cambiar_una_tarifa_no_toca_codigo(staff_plataforma):
    """
    Segunda regla de oro: subir el precio es entrar al panel y guardar.

    Y el precio anterior no se sobrescribe: se cierra el día antes de que
    empiece el nuevo, para que una factura pasada siga cuadrando.
    """
    plan = Plan.objects.get(slug="growth")
    desde = timezone.localdate() + timedelta(days=30)

    respuesta = staff_plataforma.post(
        f"/api/platform/plans/{plan.id}/precios/",
        {
            "moneda": "COP",
            "periodicidad": "MENSUAL",
            "importe": "129000.00",
            "vigente_desde": desde.isoformat(),
        },
        format="json",
    )
    assert respuesta.status_code == 201

    anterior = plan.precios.get(importe=Decimal("89000.00"))
    assert anterior.vigente_hasta == desde - timedelta(days=1)
    # Hoy todavía rige el viejo: el nuevo empieza dentro de un mes.
    assert plan.importe_mensual() == Decimal("89000.00")


def test_cambiar_un_limite_no_toca_codigo(staff_plataforma):
    """Tercera regla de oro: 20 usuarios pasan a 30 desde el panel."""
    plan = Plan.objects.get(slug="growth")
    respuesta = staff_plataforma.patch(
        f"/api/platform/plans/{plan.id}/",
        {"limites": {**plan.limites, "max_usuarios": 30}},
        format="json",
    )
    assert respuesta.status_code == 200
    plan.refresh_from_db()
    assert plan.limite("max_usuarios") == 30


def test_un_recurso_nuevo_es_una_fila_y_no_una_migracion(staff_plataforma):
    """
    Se puede vender "vehículos" sin desplegar.

    El límite nuevo queda disponible en todos los planes al instante, con su
    valor por defecto, sin tocar ninguno.
    """
    respuesta = staff_plataforma.post(
        "/api/platform/limit-types/",
        {
            "codigo": "max_vehiculos",
            "nombre": "Vehículos",
            "unidad": "UNIDAD",
            "valor_por_defecto": 5,
        },
        format="json",
    )
    assert respuesta.status_code == 201

    plan = Plan.objects.get(slug="starter")
    assert plan.limite("max_vehiculos") == 5  # heredado, sin configurarlo

    ficha = staff_plataforma.get(f"/api/platform/plans/{plan.id}/").json()
    assert ficha["limites_efectivos"]["max_vehiculos"] == {
        "valor": 5,
        "propio": False,
    }


def test_un_plan_nuevo_no_necesita_un_componente_nuevo(staff_plataforma):
    """Cuarta regla de oro: crear "Professional" es un POST."""
    respuesta = staff_plataforma.post(
        "/api/platform/plans/",
        {
            "slug": "professional",
            "nombre": "Professional",
            "descripcion": "Para equipos grandes.",
            "permisos": [],
            "limites": {"max_usuarios": 50},
            "estado": "ACTIVO",
            "trial_dias": 14,
        },
        format="json",
    )
    assert respuesta.status_code == 201
    assert Plan.objects.get(slug="professional").limite("max_usuarios") == 50


def test_un_limite_desconocido_se_rechaza_con_un_mensaje_util(staff_plataforma):
    """
    Un número bajo una clave inventada no limitaría nada y sería invisible
    hasta que alguien se preguntara por qué un plan no funciona.
    """
    plan = Plan.objects.get(slug="starter")
    respuesta = staff_plataforma.patch(
        f"/api/platform/plans/{plan.id}/",
        {"limites": {"max_naves_espaciales": 3}},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "Tipos de límite" in str(respuesta.json())


# ==========================================================================
# HISTORIAL: LO VENDIDO NO SE REESCRIBE
# ==========================================================================
def test_duplicar_como_version_archiva_la_anterior_sin_tocar_a_sus_clientes(negocio):
    """
    El plan v2 nace para los clientes nuevos; los viejos siguen en el suyo,
    con su precio, y no se enteran.
    """
    v1 = Plan.objects.get(slug="growth")
    suscripcion = negocio.suscripcion
    suscripcion.plan = v1
    suscripcion.estado = "ACTIVA"
    suscripcion.save(update_fields=["plan", "estado"])

    v2 = v1.duplicar(slug="growth-v2", nueva_version=True)
    v2.estado = "ACTIVO"
    v2.save(update_fields=["estado"])
    PrecioPlan.objects.filter(plan=v2, periodicidad="MENSUAL").update(
        importe=Decimal("129000.00")
    )

    v1.refresh_from_db()
    suscripcion.refresh_from_db()

    assert v1.estado == "ARCHIVADO"      # nadie más lo contrata
    assert suscripcion.plan_id == v1.id  # pero este cliente sigue en él
    assert suscripcion.importe_mensual() == Decimal("89000.00")
    assert v2.version == 2 and v2.origen_id == v1.id


def test_archivar_un_plan_con_clientes_no_lo_borra(staff_plataforma, negocio):
    """Borrarlo dejaría a esos negocios sin plan y sin permisos de un golpe."""
    plan = negocio.suscripcion.plan
    respuesta = staff_plataforma.delete(f"/api/platform/plans/{plan.id}/")

    assert respuesta.status_code == 204
    plan.refresh_from_db()
    assert plan.estado == "ARCHIVADO"
    assert Plan.objects.filter(pk=plan.pk).exists()


def test_un_plan_en_borrador_no_se_puede_asignar(staff_plataforma, negocio):
    """Contratarlo dejaría a la empresa con permisos y precios a medias."""
    borrador = Plan.objects.create(
        slug="a-medias", nombre="A medias", estado="BORRADOR"
    )
    respuesta = staff_plataforma.post(
        f"/api/platform/tenants/{negocio.id}/cambiar-plan/",
        {"plan": borrador.slug},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "borrador" in str(respuesta.json()).lower()


# ==========================================================================
# CONTRATOS: LO PACTADO CON UN CLIENTE
# ==========================================================================
def test_un_limite_pactado_gana_al_del_plan_y_dice_de_donde_viene(
    staff_plataforma, negocio
):
    """
    Sin `origen`, el panel mostraría un 35 sin explicación y el acuerdo sería
    imposible de auditar seis meses después.
    """
    suscripcion = negocio.suscripcion
    suscripcion.limites_extra = {"max_usuarios": 35}
    suscripcion.save(update_fields=["limites_extra"])

    assert suscripcion.limite("max_usuarios") == 35

    ficha = staff_plataforma.get(
        f"/api/platform/subscriptions/{suscripcion.id}/"
    ).json()
    usuarios = ficha["limites_efectivos"]["max_usuarios"]
    assert usuarios["valor"] == 35
    assert usuarios["origen"] == "SUSCRIPCION"
    assert usuarios["del_plan"] == suscripcion.plan.limite("max_usuarios")


def test_un_precio_pactado_evita_inventar_un_plan_para_un_solo_cliente(negocio):
    """Un acuerdo especial es una condición del contrato, no del catálogo."""
    suscripcion = negocio.suscripcion
    suscripcion.plan = Plan.objects.get(slug="business")
    suscripcion.estado = "ACTIVA"
    suscripcion.importe_pactado = Decimal("2500000.00")
    suscripcion.periodicidad = "ANUAL"
    suscripcion.save()

    # Anual: aporta al MRR repartido entre los doce meses que cubre.
    assert suscripcion.importe_mensual() == Decimal("208333.33")


def test_una_suscripcion_que_no_esta_activa_no_aporta_al_mrr(negocio):
    """Un cliente en prueba todavía no paga, y contarlo inflaría la cifra."""
    suscripcion = negocio.suscripcion
    suscripcion.plan = Plan.objects.get(slug="growth")
    suscripcion.estado = "PRUEBA"
    suscripcion.save(update_fields=["plan", "estado"])

    assert suscripcion.importe_mensual() == Decimal("0")


def test_cambiar_de_plan_descarta_el_precio_pactado_anterior(
    staff_plataforma, negocio
):
    """Mantenerlo dejaría al cliente pagando una tarifa que ya no corresponde."""
    suscripcion = negocio.suscripcion
    suscripcion.importe_pactado = Decimal("1000000.00")
    suscripcion.save(update_fields=["importe_pactado"])

    respuesta = staff_plataforma.post(
        f"/api/platform/tenants/{negocio.id}/cambiar-plan/",
        {"plan": "business"},
        format="json",
    )
    assert respuesta.status_code == 200

    suscripcion.refresh_from_db()
    assert suscripcion.importe_pactado is None
    assert suscripcion.plan.slug == "business"


# ==========================================================================
# EL MRR DE LA PLATAFORMA
# ==========================================================================
def test_el_resumen_calcula_el_mrr_normalizado_a_meses(staff_plataforma, negocio):
    """
    Un plan anual también factura, solo que repartido. Sin normalizar, el MRR
    dependería de cómo prefiere pagar cada cliente.
    """
    suscripcion = negocio.suscripcion
    suscripcion.plan = Plan.objects.get(slug="growth")
    suscripcion.estado = "ACTIVA"
    suscripcion.periodicidad = "ANUAL"
    suscripcion.importe_pactado = Decimal("1200000.00")
    suscripcion.save()

    datos = staff_plataforma.get("/api/platform/resumen/").json()
    assert Decimal(datos["mrr"]) == Decimal("100000.00")
    assert Decimal(datos["arr"]) == Decimal("1200000.00")
    assert datos["suscripciones_facturando"] == 1


# ==========================================================================
# LO COMERCIAL SE CONFIGURA; LO ESTRUCTURAL NO
# ==========================================================================
def test_administrar_un_negocio_no_da_acceso_al_catalogo_comercial(api_owner):
    """
    El dueño de una empresa no toca los precios de todos los clientes. Es la
    misma separación que ya protegía planes y permisos.
    """
    for ruta in ("products", "features", "limit-types", "prices"):
        assert api_owner.get(f"/api/platform/{ruta}/").status_code == 403


def test_una_caracteristica_comercial_no_es_un_permiso(staff_plataforma):
    """
    "Soporte prioritario" no lo consulta ningún `requiere_permiso()`.
    Mezclarlo con los permisos obligaría a inventar codenames que no protegen
    nada, y alguien acabaría intentando protegerlo con ellos.
    """
    respuesta = staff_plataforma.post(
        "/api/platform/features/",
        {"codigo": "soporte-prioritario", "nombre": "Soporte prioritario"},
        format="json",
    )
    assert respuesta.status_code == 201

    caracteristica = Caracteristica.objects.get(codigo="soporte-prioritario")
    plan = Plan.objects.get(slug="business")
    plan.caracteristicas.add(caracteristica)

    # No aparece entre lo que la empresa puede repartir entre su gente.
    suscripcion = Subscription.objects.filter(plan=plan).first()
    if suscripcion:
        assert "soporte-prioritario" not in suscripcion.permisos_disponibles()


def test_los_productos_de_un_plan_salen_de_sus_permisos(staff_plataforma):
    """
    Una lista editable de productos podría decir que el plan incluye CRM
    mientras ningún permiso de CRM está marcado, y el cliente vería un módulo
    que no puede abrir. Aquí solo hay una verdad.
    """
    plan = Plan.objects.get(slug="business")
    esperados = {
        p.nombre
        for p in Producto.objects.filter(
            permisos__codename__in=plan.permisos, permisos__activo=True
        ).distinct()
    }
    ficha = staff_plataforma.get(f"/api/platform/plans/{plan.id}/").json()
    assert {p["nombre"] for p in ficha["productos"]} == esperados
