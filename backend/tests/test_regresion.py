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
def test_el_contenido_de_la_tienda_se_lee_sin_autenticacion(api, negocio):
    """
    Banderolas, insignias, beneficios, testimonios y ofertas son publicos.

    Estaban devolviendo 401 a todo visitante: `get_permissions` colaba el
    `IsAuthenticated` por defecto de DRF junto al `AllowAny`, y DRF exige que
    pasen todos. Las tiendas se servian sin nada de eso y sin avisar, porque
    cada bloque devuelve null cuando su lista viene vacia.
    """
    for ruta in ("banners", "trust-badges", "beneficios", "testimonials", "ofertas"):
        respuesta = api.get(f"/api/content/{ruta}/")
        assert respuesta.status_code == 200, f"{ruta} respondio {respuesta.status_code}"


def test_el_contenido_de_la_tienda_no_se_escribe_sin_permiso(api, negocio):
    """Publica de lectura no significa publica de escritura."""
    respuesta = api.post("/api/content/banners/", {"titulo": "Colado"}, format="json")
    assert respuesta.status_code in (401, 403)


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


def test_el_analista_con_permiso_si_ve_clientes(api_staff, usuario_staff, negocio):
    """
    Cambió el sitio donde vive el permiso, no la regla.

    Antes se concedía en el `user_permissions` de Django, que es global: darle
    "ver clientes" a alguien se lo daba en todos los negocios donde trabajara.
    Ahora se concede en su pertenencia a ESTE negocio.
    """
    pertenencia = usuario_staff.memberships.get(tenant=negocio)
    pertenencia.permisos = ["orders.view_cliente"]
    pertenencia.save(update_fields=["permisos"])

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


# ==========================================================================
# EL DESPLIEGUE
# ==========================================================================
def test_un_origen_con_barra_o_espacio_no_tumba_el_arranque():
    """
    El fallo que dejo el backend dias sin desplegarse.

    `CORS_ALLOWED_ORIGINS=" https://a.app/,https://b.app/"` —una barra final y
    un espacio de separar con «, »— hace que `django-cors-headers` falle su
    comprobacion de arranque (`corsheaders.E014`) y Django aborte ANTES de
    servir la primera peticion. El sintoma no se parecia en nada a la causa: la
    tienda daba 404 en todo y se busco el fallo alli durante horas.

    Un origen es esquema, host y puerto. Lo que sobra se recorta en vez de
    rechazarse: quien copia una URL de la barra del navegador la copia con la
    barra final, y esa es la forma normal de escribirla.
    """
    from config.settings.base import origenes

    monkeypatched = " https://tienda.vercel.app/ , https://panel.vercel.app//"
    import os

    anterior = os.environ.get("CORS_DE_PRUEBA")
    os.environ["CORS_DE_PRUEBA"] = monkeypatched
    try:
        assert origenes("CORS_DE_PRUEBA", []) == [
            "https://tienda.vercel.app",
            "https://panel.vercel.app",
        ]
    finally:
        if anterior is None:
            del os.environ["CORS_DE_PRUEBA"]
        else:
            os.environ["CORS_DE_PRUEBA"] = anterior


def test_los_origenes_repetidos_se_colapsan():
    """Pegar dos veces el mismo dominio es lo normal cuando se van anadiendo a
    mano; duplicarlo no aporta nada y ensucia el diagnostico."""
    import os

    from config.settings.base import origenes

    os.environ["CORS_DE_PRUEBA"] = "https://a.app,https://a.app/,https://b.app"
    try:
        assert origenes("CORS_DE_PRUEBA", []) == ["https://a.app", "https://b.app"]
    finally:
        del os.environ["CORS_DE_PRUEBA"]
