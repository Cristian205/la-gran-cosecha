"""
El rol Gerente manda en el negocio: acceso total, sin permisos que repartir.

El panel presenta «Gerente» como quien dirige el negocio y no le ofrece lista
de permisos que marcar. Esta prueba fija esa promesa en el servidor, que es
donde de verdad se decide: tenerla solo en la pantalla dejaba un rol anunciado
como total y tratado como limitado, y el síntoma eran botones que le faltaban
a un gerente sin que nadie supiera por qué.
"""
import pytest

pytestmark = pytest.mark.django_db


def _gerente(tenancy, tenant):
    from django.contrib.auth import get_user_model

    usuario = get_user_model().objects.create_user(
        email_usuario="gerente@ejemplo.test",
        nombre_usuario="Gerenta del negocio",
        password="clave-de-prueba-123",
        is_staff=True,
        rol_usuario="GERENTE",
    )
    return tenancy.models.Membership.objects.create(
        usuario=usuario, tenant=tenant, rol="MANAGER"
    )


def test_el_gerente_pasa_cualquier_permiso_sin_tener_lista(tenancy, tenant_a):
    pertenencia = _gerente(tenancy, tenant_a)

    assert pertenencia.permisos == []
    assert pertenencia.tiene_acceso_total
    # Da igual el codename: no se le reparte nada porque le toca todo.
    for codename in (
        "orders.add_pedido",
        "orders.delete_pedido",
        "catalog.change_producto",
        "un.permiso.que.no.existe.todavia",
    ):
        assert pertenencia.tiene_permiso(codename), codename


def test_un_gerente_desactivado_no_pasa_nada(tenancy, tenant_a):
    """El acceso total es del rol activo; dar de baja a alguien lo corta."""
    pertenencia = _gerente(tenancy, tenant_a)
    pertenencia.activo = False
    pertenencia.save(update_fields=["activo"])

    assert not pertenencia.tiene_permiso("orders.view_pedido")


def test_los_roles_de_apoyo_siguen_necesitando_permisos(tenancy, tenant_a):
    """
    Lo que no cambia: Ventas y Personal se delegan permiso a permiso. Si
    alguno de estos acabara con acceso total, los permisos no servirían para
    nada.
    """
    from django.contrib.auth import get_user_model

    for i, rol in enumerate(("SALES", "STAFF")):
        usuario = get_user_model().objects.create_user(
            email_usuario=f"apoyo{i}@ejemplo.test",
            nombre_usuario=f"Apoyo {i}",
            password="clave-de-prueba-123",
            is_staff=True,
        )
        pertenencia = tenancy.models.Membership.objects.create(
            usuario=usuario, tenant=tenant_a, rol=rol, permisos=["orders.view_pedido"]
        )
        assert not pertenencia.tiene_acceso_total, rol
        assert pertenencia.tiene_permiso("orders.view_pedido"), rol
        assert not pertenencia.tiene_permiso("orders.delete_pedido"), rol
