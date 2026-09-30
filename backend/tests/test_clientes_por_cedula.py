"""
El cliente de la tienda que se identifica con su cédula.

  * Por defecto nada cambia: la tienda sigue reconociendo al cliente por su
    nombre, como siempre.
  * Con "Cédula" elegida en la configuración, el primer pedido pide teléfono,
    dirección y el acuerdo de precios UNA vez; los siguientes, solo la cédula.
  * Consultar una cédula enseña lo mínimo para reconocerse, nunca el teléfono
    ni la dirección completos, y tiene un límite por visitante.
"""
from decimal import Decimal

import pytest
from django.test import override_settings

from apps.content.models import StoreSettings
from apps.orders.models import Cliente, Pedido

CEDULA = "1020345678"


@pytest.fixture
def por_cedula(negocio):
    StoreSettings.objects.update_or_create(
        tenant=negocio, defaults={"identificacion_clientes": StoreSettings.IDENTIFICACION_CEDULA}
    )
    return negocio


def _pedido(presentacion, **cliente):
    return {"cliente": cliente, "items": [{"presentacion_id": presentacion.id, "cantidad": 2}]}


def _primer_pedido(presentacion, **extra):
    datos = {
        "cedula": "1.020.345.678",
        "nombre": "Juan Pérez Gómez",
        "telefono": "+57 300 123 4567",
        "direccion": "Cra 12 #45-67 Chapinero",
        "acepta_precios": True,
        **extra,
    }
    return _pedido(presentacion, **datos)


# ==========================================================================
# SIN ELEGIR NADA: EL COMPORTAMIENTO DE SIEMPRE
# ==========================================================================
def test_por_defecto_la_tienda_sigue_identificando_por_nombre(api, presentacion):
    respuesta = api.post("/api/orders/", _pedido(presentacion, nombre="Tienda Don José"), format="json")

    assert respuesta.status_code == 201
    assert Cliente.objects.get().nombre_cliente == "Tienda Don José"


def test_por_defecto_una_cedula_enviada_no_cambia_el_flujo(api, presentacion):
    """Mandar una cédula a una tienda por nombre no crea clientes por cédula."""
    cuerpo = _pedido(presentacion, nombre="Tienda Don José", cedula=CEDULA)
    assert api.post("/api/orders/", cuerpo, format="json").status_code == 201
    assert Cliente.objects.get().documento_cliente == ""


def test_por_defecto_consultar_una_cedula_no_existe(api, negocio):
    respuesta = api.post("/api/orders-cliente/consultar/", {"cedula": CEDULA}, format="json")
    assert respuesta.status_code == 404


# ==========================================================================
# PRIMER PEDIDO: LOS DATOS Y EL ACUERDO, UNA SOLA VEZ
# ==========================================================================
def test_el_primer_pedido_exige_datos_y_acuerdo(api, por_cedula, presentacion):
    respuesta = api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA), format="json")

    assert respuesta.status_code == 400
    faltan = respuesta.json()["cliente"]
    assert set(faltan) == {"nombre", "telefono", "direccion", "acepta_precios"}
    assert not Pedido.objects.exists()


def test_el_primer_pedido_sin_aceptar_precios_no_pasa(api, por_cedula, presentacion):
    respuesta = api.post(
        "/api/orders/", _primer_pedido(presentacion, acepta_precios=False), format="json"
    )
    assert respuesta.status_code == 400
    assert "acepta_precios" in respuesta.json()["cliente"]


def test_una_cedula_invalida_se_explica(api, por_cedula, presentacion):
    respuesta = api.post("/api/orders/", _primer_pedido(presentacion, cedula="12"), format="json")
    assert respuesta.status_code == 400
    assert "cedula" in respuesta.json()["cliente"]


def test_el_primer_pedido_guarda_los_datos_y_el_acuerdo(api, por_cedula, presentacion):
    respuesta = api.post("/api/orders/", _primer_pedido(presentacion), format="json")

    assert respuesta.status_code == 201
    cliente = Cliente.objects.get()
    # La cédula se guarda solo con dígitos: con o sin puntos es la misma.
    assert cliente.documento_cliente == CEDULA
    assert cliente.telefono_cliente == "+57 300 123 4567"
    assert cliente.direccion_cliente == "Cra 12 #45-67 Chapinero"
    assert cliente.acepto_precios_en is not None
    assert respuesta.json()["cliente_nombre"] == "Juan P. G."


# ==========================================================================
# LOS SIGUIENTES: SOLO LA CÉDULA
# ==========================================================================
def test_los_siguientes_pedidos_solo_piden_la_cedula(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")

    respuesta = api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA), format="json")

    assert respuesta.status_code == 201
    assert Cliente.objects.count() == 1
    assert Pedido.objects.filter(cliente__documento_cliente=CEDULA).count() == 2


def test_quien_sabe_una_cedula_no_cambia_los_datos_guardados(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")

    api.post(
        "/api/orders/",
        _pedido(presentacion, cedula=CEDULA, nombre="Otro", telefono="999", direccion="Otra parte"),
        format="json",
    )

    cliente = Cliente.objects.get()
    assert cliente.nombre_cliente == "Juan Pérez Gómez"
    assert cliente.telefono_cliente == "+57 300 123 4567"
    assert cliente.direccion_cliente == "Cra 12 #45-67 Chapinero"


def test_otra_direccion_vale_solo_para_ese_pedido(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")

    respuesta = api.post(
        "/api/orders/",
        _pedido(presentacion, cedula=CEDULA, direccion_entrega="Calle 80 #20-10 oficina 301"),
        format="json",
    )

    pedido = Pedido.objects.get(id=respuesta.json()["pedido_id"])
    assert pedido.direccion_de_entrega == "Calle 80 #20-10 oficina 301"
    assert Cliente.objects.get().direccion_cliente == "Cra 12 #45-67 Chapinero"


def test_la_misma_direccion_no_se_duplica_en_el_pedido(api, por_cedula, presentacion):
    respuesta = api.post(
        "/api/orders/",
        _primer_pedido(presentacion, direccion_entrega="Cra 12 #45-67 Chapinero"),
        format="json",
    )
    pedido = Pedido.objects.get(id=respuesta.json()["pedido_id"])
    assert pedido.direccion_entrega == ""
    assert pedido.direccion_de_entrega == "Cra 12 #45-67 Chapinero"


def test_dos_clientes_con_el_mismo_nombre_son_dos_personas(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")
    api.post("/api/orders/", _primer_pedido(presentacion, cedula="80111222"), format="json")

    assert Cliente.objects.filter(nombre_cliente="Juan Pérez Gómez").count() == 2


def test_un_cliente_antiguo_sin_datos_completos_los_completa(api, por_cedula, presentacion):
    """Una cédula puesta desde el panel a un cliente de antes: su primer pedido la completa."""
    Cliente.objects.create(nombre_cliente="Cliente de antes", documento_cliente=CEDULA)

    incompleto = api.post("/api/orders/", _pedido(presentacion, cedula=CEDULA), format="json")
    assert incompleto.status_code == 400

    completo = api.post("/api/orders/", _primer_pedido(presentacion), format="json")
    assert completo.status_code == 201
    assert Cliente.objects.get().datos_completos


# ==========================================================================
# CONSULTAR Y REPETIR
# ==========================================================================
def test_una_cedula_desconocida_dice_que_no_existe(api, por_cedula):
    respuesta = api.post("/api/orders-cliente/consultar/", {"cedula": CEDULA}, format="json")
    assert respuesta.json() == {"existe": False}


def test_consultar_enmascara_los_datos(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")

    datos = api.post("/api/orders-cliente/consultar/", {"cedula": CEDULA}, format="json").json()

    assert datos == {
        "existe": True,
        "nombre": "Juan P. G.",
        "telefono": "•••• 4567",
        "direccion": "Cra 12…",
        "requiere_datos": False,
    }


def test_el_historial_trae_los_precios_de_hoy(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")
    presentacion.precio_unitario = Decimal("12500")
    presentacion.save(update_fields=["precio_unitario"])

    datos = api.post("/api/orders-cliente/historial/", {"cedula": CEDULA}, format="json").json()

    assert len(datos["pedidos"]) == 1
    linea = datos["pedidos"][0]["lineas"][0]
    assert linea["presentacion_id"] == presentacion.id
    assert Decimal(linea["cantidad"]) == 2
    assert Decimal(linea["precio_actual"]) == Decimal("12500")
    assert linea["disponible"] is True


def test_el_historial_marca_lo_que_ya_no_se_vende(api, por_cedula, presentacion):
    api.post("/api/orders/", _primer_pedido(presentacion), format="json")
    presentacion.estado_presentacion = False
    presentacion.save(update_fields=["estado_presentacion"])

    datos = api.post("/api/orders-cliente/historial/", {"cedula": CEDULA}, format="json").json()

    assert datos["pedidos"][0]["lineas"][0]["disponible"] is False


@override_settings(TASA_CONSULTA_CLIENTE="3/min")
def test_consultar_cedulas_tiene_limite(api, por_cedula):
    from django.core.cache import cache

    cache.clear()
    respuestas = [
        api.post("/api/orders-cliente/consultar/", {"cedula": f"1000000{n}"}, format="json").status_code
        for n in range(4)
    ]
    assert respuestas == [200, 200, 200, 429]


@override_settings(TASA_CONSULTA_CLIENTE="1/min", TENANCY_CLAVE_SERVIDOR="clave-de-pruebas")
def test_la_ip_del_visitante_solo_se_cree_con_la_clave_del_servidor(api, por_cedula):
    """Sin la clave, cambiar `X-Visitante-IP` en cada intento no esquiva el límite."""
    from django.core.cache import cache

    cache.clear()
    url, cuerpo = "/api/orders-cliente/consultar/", {"cedula": CEDULA}
    assert api.post(url, cuerpo, format="json", HTTP_X_VISITANTE_IP="1.1.1.1").status_code == 200
    assert api.post(url, cuerpo, format="json", HTTP_X_VISITANTE_IP="2.2.2.2").status_code == 429

    # Con la clave (el puente de la tienda), cada visitante cuenta aparte.
    con_clave = {"HTTP_X_TENANT_KEY": "clave-de-pruebas", "HTTP_X_TENANT": por_cedula.slug}
    assert api.post(url, cuerpo, format="json", HTTP_X_VISITANTE_IP="3.3.3.3", **con_clave).status_code == 200
    assert api.post(url, cuerpo, format="json", HTTP_X_VISITANTE_IP="4.4.4.4", **con_clave).status_code == 200


# ==========================================================================
# PANEL
# ==========================================================================
def test_usuario_y_contrasena_todavia_no_se_puede_elegir(api_owner, negocio):
    respuesta = api_owner.patch(
        "/api/content/site-config/", {"identificacion_clientes": "cuenta"}, format="json"
    )
    assert respuesta.status_code == 400


def test_el_panel_elige_identificar_por_cedula(api_owner, negocio):
    respuesta = api_owner.patch(
        "/api/content/site-config/", {"identificacion_clientes": "cedula"}, format="json"
    )
    assert respuesta.status_code == 200
    assert StoreSettings.objects.get(tenant=negocio).identificacion_clientes == "cedula"


def test_el_panel_no_repite_una_cedula(api_owner, negocio):
    Cliente.objects.create(nombre_cliente="Ya existe", documento_cliente=CEDULA)
    otro = Cliente.objects.create(nombre_cliente="Otro cliente")

    respuesta = api_owner.patch(
        f"/api/clients/{otro.id}/", {"documento_cliente": "1.020.345.678"}, format="json"
    )
    assert respuesta.status_code == 400
