"""
Fixtures compartidas de la suite.

Dos grupos bien separados:

* Los de arriba construyen datos del dominio actual (usuarios, catálogo,
  clientes) y sirven a los tests de regresión, que ya pasan hoy.
* Los de abajo (`tenant_a`, `tenant_b`, `api_tenant_a`…) describen el mundo
  multi-tenant que todavía no existe. Importan `apps.tenancy` DENTRO de la
  función a propósito: si se importara arriba, la suite entera fallaría al
  recolectar en lugar de fallar solo donde toca.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalog.models import Categoria, PresentacionProducto, Producto, UnidadMedida
from apps.orders.models import Cliente

Usuario = get_user_model()

FALTA_TENANCY = (
    "apps.tenancy todavía no existe. Es lo que construye la fase 1 del roadmap; "
    "este fallo es el objetivo del refactor, no un error de la suite."
)


# ==========================================================================
# CLIENTES HTTP
# ==========================================================================
@pytest.fixture
def api():
    """Cliente anónimo — el visitante de la tienda pública."""
    return APIClient()


@pytest.fixture
def api_owner(usuario_owner):
    """Cliente autenticado como dueño (GERENTE): pasa cualquier permiso."""
    cliente = APIClient()
    cliente.force_authenticate(user=usuario_owner)
    return cliente


@pytest.fixture
def api_staff(usuario_staff):
    """Cliente autenticado como ANALISTA sin permisos concedidos."""
    cliente = APIClient()
    cliente.force_authenticate(user=usuario_staff)
    return cliente


# ==========================================================================
# USUARIOS
# ==========================================================================
@pytest.fixture
def usuario_owner(db):
    return Usuario.objects.create_user(
        email_usuario="duena@ejemplo.test",
        nombre_usuario="Dueña de la cuenta",
        password="clave-de-prueba-123",
        rol_usuario="GERENTE",
        is_staff=True,
    )


@pytest.fixture
def usuario_staff(db):
    return Usuario.objects.create_user(
        email_usuario="analista@ejemplo.test",
        nombre_usuario="Analista",
        password="clave-de-prueba-123",
        rol_usuario="ANALISTA",
        is_staff=True,
    )


# ==========================================================================
# CATÁLOGO
# ==========================================================================
@pytest.fixture
def unidad(db):
    return UnidadMedida.objects.create(
        nombre_unidad="Kilogramo", abreviatura_unidad="kg"
    )


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(
        nombre_categoria="Categoría de prueba", abreviatura="CAT", orden=1
    )


@pytest.fixture
def producto(categoria):
    return Producto.objects.create(
        nombre_producto="Producto de prueba", categoria=categoria
    )


@pytest.fixture
def presentacion(producto, unidad):
    return PresentacionProducto.objects.create(
        producto=producto,
        nombre_presentacion="Bulto",
        unidad_venta=unidad,
        factor_conversion=1,
        precio_unitario=10000,
    )


@pytest.fixture
def cliente_negocio(db):
    return Cliente.objects.create(
        nombre_cliente="Tienda del barrio", telefono_cliente="3001234567"
    )


# ==========================================================================
# MULTI-TENANT — todo lo de aquí abajo falla hasta la fase 1
# ==========================================================================
@pytest.fixture
def tenancy():
    """Importa apps.tenancy o falla con un mensaje que explica por qué."""
    try:
        from apps import tenancy  # noqa: PLC0415
    except ImportError:
        pytest.fail(FALTA_TENANCY, pytrace=False)
    return tenancy


@pytest.fixture
def tenant_a(tenancy, db):
    return tenancy.models.Tenant.objects.create(
        slug="la-gran-cosecha", nombre="La Gran Cosecha"
    )


@pytest.fixture
def tenant_b(tenancy, db):
    return tenancy.models.Tenant.objects.create(
        slug="perfumeria-xyz", nombre="Perfumería XYZ"
    )


@pytest.fixture
def api_tenant_a(tenant_a, tenancy):
    """Staff del tenant A, con su pertenencia y su ámbito activo."""
    return _cliente_de_tenant(tenancy, tenant_a, "staff-a@ejemplo.test")


@pytest.fixture
def api_tenant_b(tenant_b, tenancy):
    return _cliente_de_tenant(tenancy, tenant_b, "staff-b@ejemplo.test")


def _cliente_de_tenant(tenancy, tenant, email):
    usuario = Usuario.objects.create_user(
        email_usuario=email,
        nombre_usuario=f"Staff de {tenant.nombre}",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    tenancy.models.Membership.objects.create(
        usuario=usuario, tenant=tenant, rol="ADMIN"
    )
    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    # El tenant activo viaja en el JWT; con force_authenticate se declara
    # por cabecera, que es la vía que el middleware acepta en tests.
    cliente.credentials(HTTP_X_TENANT=tenant.slug)
    return cliente


@pytest.fixture
def recursos_del_tenant_b(tenant_b, tenancy):
    """
    Un objeto de cada tipo perteneciente al tenant B. Es lo que el tenant A
    nunca debe poder ver, listar, leer ni modificar.
    """
    con_tenant = lambda modelo, **kw: modelo.objects.create(tenant=tenant_b, **kw)  # noqa: E731

    categoria = con_tenant(Categoria, nombre_categoria="Perfumes", abreviatura="PER", orden=1)
    producto = con_tenant(Producto, nombre_producto="Perfume floral", categoria=categoria)
    unidad = con_tenant(UnidadMedida, nombre_unidad="Frasco", abreviatura_unidad="fr")
    presentacion = PresentacionProducto.objects.create(
        producto=producto, nombre_presentacion="100 ml", unidad_venta=unidad,
        factor_conversion=1, precio_unitario=85000,
    )
    cliente = con_tenant(Cliente, nombre_cliente="Clienta de la perfumería")

    from apps.orders.models import Pedido  # noqa: PLC0415

    pedido = con_tenant(Pedido, cliente=cliente, estado="PENDIENTE")

    return {
        "categoria": categoria,
        "producto": producto,
        "presentacion": presentacion,
        "cliente": cliente,
        "pedido": pedido,
    }
