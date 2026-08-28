"""
Red de seguridad del refactor multi-tenant.

Cada test de aquí describe una funcionalidad que HOY funciona y que el punto 20
del plan exige no romper. Si alguno se pone en rojo durante las fases 1 a 4, es
que el refactor destruyó algo que el negocio ya usaba.

No pretende cobertura completa: cubre los caminos que un cambio de ámbito de
datos puede romper sin hacer ruido.
"""
import pytest
from django.core import mail

from apps.catalog.models import Producto
from apps.orders.models import Pedido

pytestmark = pytest.mark.django_db


# ==========================================================================
# CATÁLOGO PÚBLICO — lo que ve el visitante de la tienda
# ==========================================================================
def test_el_catalogo_publico_se_lee_sin_autenticacion(api, presentacion):
    respuesta = api.get("/api/catalog/products/")
    assert respuesta.status_code == 200
    assert respuesta.json()["count"] == 1


def test_el_visitante_no_ve_productos_desactivados(api, producto):
    producto.estado_producto = False
    producto.save(update_fields=["estado_producto"])

    assert api.get("/api/catalog/products/").json()["count"] == 0


def test_el_staff_si_ve_productos_desactivados(api_owner, producto):
    producto.estado_producto = False
    producto.save(update_fields=["estado_producto"])

    assert api_owner.get("/api/catalog/products/").json()["count"] == 1


def test_el_visitante_no_puede_crear_productos(api, categoria):
    respuesta = api.post(
        "/api/catalog/products/",
        {"nombre_producto": "Intruso", "categoria": categoria.id},
        format="json",
    )
    assert respuesta.status_code in (401, 403)


def test_el_producto_expone_precio_desde(api, presentacion):
    """
    `precio_desde` es una anotación del queryset, no un campo. Es justo el tipo
    de cosa que un cambio de manager rompe en silencio.
    """
    producto = api.get("/api/catalog/products/").json()["results"][0]
    assert float(producto["precio_desde"]) == 10000.0


# ==========================================================================
# GENERACIÓN AUTOMÁTICA DE CÓDIGO Y ORDEN
# ==========================================================================
def test_el_codigo_de_producto_se_genera_desde_la_abreviatura(categoria):
    primero = Producto.objects.create(nombre_producto="Uno", categoria=categoria)
    segundo = Producto.objects.create(nombre_producto="Dos", categoria=categoria)

    assert primero.codigo_producto == "CAT-001"
    assert segundo.codigo_producto == "CAT-002"


def test_el_orden_es_consecutivo(categoria):
    primero = Producto.objects.create(nombre_producto="Uno", categoria=categoria)
    segundo = Producto.objects.create(nombre_producto="Dos", categoria=categoria)

    assert segundo.orden == primero.orden + 1


# ==========================================================================
# PEDIDOS — el flujo central del negocio
# ==========================================================================
def _pedido_valido(presentacion, nombre="Tienda nueva"):
    return {
        "cliente": {"nombre": nombre, "telefono": "3009998877"},
        "items": [{"presentacion_id": presentacion.id, "cantidad": "3"}],
        "observaciones": "Entregar por la mañana",
    }


def test_un_visitante_puede_crear_un_pedido(api, presentacion):
    respuesta = api.post("/api/orders/", _pedido_valido(presentacion), format="json")

    assert respuesta.status_code == 201
    assert respuesta.json()["success"] is True

    pedido = Pedido.objects.get(id=respuesta.json()["pedido_id"])
    assert pedido.estado == "PENDIENTE"
    # 3 unidades x 10 000: el total se recalcula desde las líneas, no se confía
    # en lo que mande el cliente.
    assert float(pedido.total_pedido) == 30000.0


def test_el_pedido_reutiliza_el_cliente_existente(api, presentacion, cliente_negocio):
    api.post(
        "/api/orders/",
        _pedido_valido(presentacion, nombre=cliente_negocio.nombre_cliente),
        format="json",
    )
    assert cliente_negocio.pedidos.count() == 1


def test_un_pedido_sin_productos_se_rechaza(api, presentacion):
    respuesta = api.post(
        "/api/orders/",
        {"cliente": {"nombre": "Alguien"}, "items": [], "personalizados": []},
        format="json",
    )
    assert respuesta.status_code == 400


def test_un_producto_personalizado_queda_pendiente_de_revision(api, categoria, unidad):
    """El flujo de 'producto que el cliente escribe y el admin aprueba'."""
    respuesta = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Tienda curiosa"},
            "personalizados": [
                {
                    "nombre": "Algo que no está en catálogo",
                    "cantidad": "2",
                    "unidad_id": unidad.id,
                    "categoria_id": categoria.id,
                }
            ],
        },
        format="json",
    )
    assert respuesta.status_code == 201

    detalle = Pedido.objects.get(id=respuesta.json()["pedido_id"]).detalles.first()
    assert detalle.es_catalogo is False
    assert detalle.estado_revision == "PENDIENTE"


def test_el_visitante_no_puede_listar_pedidos(api, presentacion):
    assert api.get("/api/orders/").status_code in (401, 403)


def test_el_staff_con_permiso_lista_pedidos(api_owner, api, presentacion):
    api.post("/api/orders/", _pedido_valido(presentacion), format="json")

    respuesta = api_owner.get("/api/orders/")
    assert respuesta.status_code == 200
    assert respuesta.json()["count"] == 1


# ==========================================================================
# PERMISOS — el comportamiento que la fase 4 debe preservar
# ==========================================================================
def test_el_dueno_no_necesita_permisos_explicitos(api_owner, cliente_negocio):
    """`es_owner()`: GERENTE y superusuario pasan cualquier verificación."""
    assert api_owner.get("/api/clients/").status_code == 200


def test_el_analista_sin_permisos_no_ve_clientes(api_staff, cliente_negocio):
    assert api_staff.get("/api/clients/").status_code == 403


def test_el_analista_con_permiso_si_ve_clientes(api_staff, usuario_staff, cliente_negocio):
    from django.contrib.auth.models import Permission

    usuario_staff.user_permissions.add(
        Permission.objects.get(
            codename="view_cliente", content_type__app_label="orders"
        )
    )
    # El caché de permisos vive en la instancia; hay que refrescarla.
    usuario_staff.refresh_from_db()
    api_staff.force_authenticate(user=usuario_staff)

    assert api_staff.get("/api/clients/").status_code == 200


# ==========================================================================
# CONFIGURACIÓN DEL SITIO — el singleton que la fase 2 desmonta
# ==========================================================================
def test_la_configuracion_del_sitio_se_lee_sin_autenticacion(api, negocio):
    respuesta = api.get("/api/content/site-config/")
    assert respuesta.status_code == 200
    # El tema por defecto que consume theming.ts en el storefront.
    assert respuesta.json()["color_primario"] == "#16a34a"


def test_el_visitante_no_puede_cambiar_la_configuracion(api, negocio):
    respuesta = api.patch(
        "/api/content/site-config/", {"nombre_empresa": "Intruso"}, format="json"
    )
    assert respuesta.status_code in (401, 403)


# ==========================================================================
# AUTENTICACIÓN OTP — dos pasos, sin sesión entre ellos
# ==========================================================================
def test_el_login_correcto_envia_otp_y_no_entrega_token_aun(api, usuario_owner):
    respuesta = api.post(
        "/api/auth/login/",
        {"email_usuario": usuario_owner.email_usuario, "password": "clave-de-prueba-123"},
        format="json",
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["step"] == 2
    assert cuerpo["otp_ticket"]
    # El paso 1 nunca puede devolver credenciales de acceso.
    assert "access" not in cuerpo
    assert len(mail.outbox) == 1


def test_una_contrasena_incorrecta_no_envia_otp(api, usuario_owner):
    respuesta = api.post(
        "/api/auth/login/",
        {"email_usuario": usuario_owner.email_usuario, "password": "equivocada"},
        format="json",
    )

    assert respuesta.status_code == 400
    assert len(mail.outbox) == 0
