"""
Presentaciones comerciales: alta, edición, duplicado, orden, desactivación y
la regla de cantidad (mínima, incremento, decimales) de cada una.

Protege lo que el editor del panel y la tienda dan por hecho:

* que la regla se valida igual en el servidor que en el navegador
  (`catalog/cantidades.py` ↔ `utils/cantidades.ts`);
* que el pedido de la tienda no acepta presentaciones desactivadas ni
  cantidades fuera de la regla;
* que editar o desactivar una presentación no reescribe pedidos viejos.
"""
from decimal import Decimal

import pytest

from apps.catalog import cantidades
from apps.catalog.models import HistorialPrecio, PresentacionProducto, Producto, UnidadMedida
from apps.orders.models import DetallePedido

pytestmark = pytest.mark.django_db

URL = "/api/catalog/presentations/"


def _alta(producto, unidad, **extra):
    datos = {
        "producto": producto.id,
        "nombre_presentacion": "Kilo",
        "unidad_venta": unidad.id,
        "precio_unitario": "2000",
        "cantidad_minima": "0.5",
        "incremento_cantidad": "0.25",
        "decimales_cantidad": 2,
    }
    datos.update(extra)
    return datos


def _pedido(presentacion, cantidad):
    return {
        "cliente": {"nombre": "Cliente", "telefono": "3001112233", "autoriza_datos": True},
        "items": [{"presentacion_id": presentacion.id, "cantidad": cantidad}],
    }


# ==========================================================================
# LA REGLA DE CANTIDAD (pura, sin base de datos)
# ==========================================================================
@pytest.mark.parametrize(
    "minima, paso, decimales",
    [("1", "1", 0), ("0.5", "0.25", 2), ("6", "6", 0), ("0.5", "0.5", 1), ("10", "1", 0)],
)
def test_reglas_validas(minima, paso, decimales):
    assert cantidades.validar_regla(minima, paso, decimales) == {}


@pytest.mark.parametrize(
    "minima, paso, decimales, campo",
    [
        ("0", "1", 0, "cantidad_minima"),
        ("-1", "1", 0, "cantidad_minima"),
        ("1", "0", 0, "incremento_cantidad"),
        ("1", "-0.5", 1, "incremento_cantidad"),
        ("0.5", "1", 1, "cantidad_minima"),  # no es múltiplo
        ("1", "0.25", 1, "incremento_cantidad"),  # 2 decimales con precisión 1
        ("0.5", "0.5", 0, "cantidad_minima"),  # decimales con precisión 0
        ("1", "1", 3, "decimales_cantidad"),  # el pedido solo guarda 2
        ("abc", "1", 0, "cantidad_minima"),
    ],
)
def test_reglas_invalidas(minima, paso, decimales, campo):
    assert campo in cantidades.validar_regla(minima, paso, decimales)


def test_la_secuencia_es_exacta_sin_errores_de_coma_flotante():
    # Con float, 0.5 + 0.25·k acumula error y 0,75 o 1,1 saldrían inválidos.
    validas = ["0.5", "0.75", "1", "1.25", "10.5"]
    for valor in validas:
        assert cantidades.cantidad_valida(valor, "0.5", "0.25", 2), valor
    for valor in ["0.25", "0.6", "1.1", "1.255", "-1"]:
        assert not cantidades.cantidad_valida(valor, "0.5", "0.25", 2), valor
    assert cantidades.cantidad_valida("0.3", "0.1", "0.1", 1)
    assert cantidades.ejemplos("0.5", "0.25", 4) == [Decimal(v) for v in ("0.5", "0.75", "1", "1.25")]


# ==========================================================================
# ALTA
# ==========================================================================
def test_crear_una_presentacion_valida(api_owner, producto, unidad):
    r = api_owner.post(URL, _alta(producto, unidad), format="json")
    assert r.status_code == 201, r.data
    assert r.data["nombre_presentacion"] == "Kilo"
    assert Decimal(r.data["cantidad_minima"]) == Decimal("0.5")
    assert Decimal(r.data["incremento_cantidad"]) == Decimal("0.25")
    assert r.data["decimales_cantidad"] == 2

    guardada = PresentacionProducto.objects.get(pk=r.data["id"])
    assert guardada.precio_unitario == Decimal("2000")
    assert guardada.estado_presentacion is True


def test_varias_presentaciones_para_un_producto_quedan_en_orden(api_owner, producto, unidad):
    caja = UnidadMedida.objects.create(nombre_unidad="Caja", abreviatura_unidad="cj")
    ids = [
        api_owner.post(URL, _alta(producto, unidad), format="json").data["id"],
        api_owner.post(
            URL,
            _alta(producto, caja, nombre_presentacion="Caja x 12", cantidad_minima="1",
                  incremento_cantidad="1", decimales_cantidad=0, precio_unitario="22000"),
            format="json",
        ).data["id"],
    ]
    listado = api_owner.get(URL, {"producto": producto.id}).data
    assert [p["id"] for p in listado] == ids
    assert [p["orden"] for p in listado] == [0, 1]


def test_el_nombre_se_guarda_sin_espacios_sobrantes(api_owner, producto, unidad):
    r = api_owner.post(URL, _alta(producto, unidad, nombre_presentacion="  Media   libra "), format="json")
    assert r.data["nombre_presentacion"] == "Media libra"


def test_sin_regla_hereda_la_del_producto(api_owner, producto, unidad):
    producto.permite_fraccion, producto.tipo_cantidad = True, "medio"
    producto.save()
    datos = {
        "producto": producto.id,
        "nombre_presentacion": "Libra",
        "unidad_venta": unidad.id,
        "precio_unitario": "1500",
    }
    r = api_owner.post(URL, datos, format="json")
    assert r.status_code == 201, r.data
    assert Decimal(r.data["incremento_cantidad"]) == Decimal("0.5")


@pytest.mark.parametrize(
    "cambio, campo",
    [
        ({"nombre_presentacion": "   "}, "nombre_presentacion"),
        ({"precio_unitario": "-1"}, "precio_unitario"),
        ({"precio_unitario": "0"}, "precio_unitario"),
        ({"cantidad_minima": "0"}, "cantidad_minima"),
        ({"cantidad_minima": "-2"}, "cantidad_minima"),
        ({"incremento_cantidad": "0"}, "incremento_cantidad"),
        ({"incremento_cantidad": "-0.25"}, "incremento_cantidad"),
        ({"cantidad_minima": "0.3"}, "cantidad_minima"),
        ({"decimales_cantidad": 0}, "cantidad_minima"),
        ({"decimales_cantidad": 3}, "decimales_cantidad"),
        ({"factor_conversion": "0"}, "factor_conversion"),
    ],
)
def test_alta_invalida_explica_el_campo(api_owner, producto, unidad, cambio, campo):
    r = api_owner.post(URL, _alta(producto, unidad, **cambio), format="json")
    assert r.status_code == 400
    assert campo in r.data, r.data
    assert not PresentacionProducto.objects.filter(producto=producto).exists()


def test_la_unidad_es_obligatoria(api_owner, producto, unidad):
    datos = _alta(producto, unidad)
    del datos["unidad_venta"]
    r = api_owner.post(URL, datos, format="json")
    assert r.status_code == 400 and "unidad_venta" in r.data


def test_duplicado_sin_distinguir_mayusculas(api_owner, producto, unidad):
    assert api_owner.post(URL, _alta(producto, unidad), format="json").status_code == 201
    r = api_owner.post(URL, _alta(producto, unidad, nombre_presentacion="KILO"), format="json")
    assert r.status_code == 400
    assert "Ya existe" in str(r.data["nombre_presentacion"])


def test_duplicado_de_una_inactiva_sugiere_activarla(api_owner, producto, unidad):
    r = api_owner.post(URL, _alta(producto, unidad), format="json")
    api_owner.patch(f"{URL}{r.data['id']}/", {"estado_presentacion": False}, format="json")
    r2 = api_owner.post(URL, _alta(producto, unidad), format="json")
    assert r2.status_code == 400
    assert "inactiva" in str(r2.data["nombre_presentacion"])


def test_mismo_nombre_en_otra_unidad_no_es_duplicado(api_owner, producto, unidad):
    libra = UnidadMedida.objects.create(nombre_unidad="Libra", abreviatura_unidad="lb")
    assert api_owner.post(URL, _alta(producto, unidad), format="json").status_code == 201
    assert api_owner.post(URL, _alta(producto, libra), format="json").status_code == 201


def test_no_se_vende_en_una_unidad_desactivada(api_owner, producto, unidad):
    unidad.estado_unidad = False
    unidad.save()
    r = api_owner.post(URL, _alta(producto, unidad), format="json")
    assert r.status_code == 400 and "unidad_venta" in r.data


# ==========================================================================
# EDICIÓN, DUPLICADO, DESACTIVACIÓN, ORDEN
# ==========================================================================
def test_editar_cambia_la_regla_y_registra_el_precio(api_owner, presentacion, usuario_owner):
    r = api_owner.patch(
        f"{URL}{presentacion.id}/",
        {"precio_unitario": "12000", "cantidad_minima": "2", "incremento_cantidad": "2",
         "version": presentacion.version},
        format="json",
    )
    assert r.status_code == 200, r.data
    presentacion.refresh_from_db()
    assert presentacion.precio_unitario == Decimal("12000")
    assert presentacion.cantidad_minima == Decimal("2")
    [cambio] = HistorialPrecio.objects.filter(presentacion=presentacion)
    assert (cambio.precio_anterior, cambio.precio_nuevo) == (Decimal("10000"), Decimal("12000"))
    assert cambio.usuario == usuario_owner


def test_una_edicion_parcial_se_valida_contra_lo_guardado(api_owner, presentacion):
    # Regla guardada: 1 en 1, sin decimales. Pedir 0,5 de mínima sin cambiar
    # los decimales tiene que fallar aunque la petición no mande los decimales.
    r = api_owner.patch(f"{URL}{presentacion.id}/", {"cantidad_minima": "0.5"}, format="json")
    assert r.status_code == 400 and "cantidad_minima" in r.data


def test_edicion_concurrente_devuelve_409(api_owner, presentacion):
    leida = presentacion.version
    primero = api_owner.patch(
        f"{URL}{presentacion.id}/", {"precio_unitario": "11000", "version": leida}, format="json"
    )
    assert primero.status_code == 200
    segundo = api_owner.patch(
        f"{URL}{presentacion.id}/", {"precio_unitario": "9000", "version": leida}, format="json"
    )
    assert segundo.status_code == 409
    presentacion.refresh_from_db()
    assert presentacion.precio_unitario == Decimal("11000")


def test_duplicar_crea_otro_registro(api_owner, presentacion):
    # Duplicar = abrir el formulario con los datos copiados y guardar como
    # alta nueva; el nombre tiene que cambiar para no chocar con la original.
    copia = {
        "producto": presentacion.producto_id,
        "nombre_presentacion": "Bulto (copia)",
        "unidad_venta": presentacion.unidad_venta_id,
        "precio_unitario": str(presentacion.precio_unitario),
        "cantidad_minima": "1",
        "incremento_cantidad": "1",
        "decimales_cantidad": 0,
    }
    r = api_owner.post(URL, copia, format="json")
    assert r.status_code == 201
    assert r.data["id"] != presentacion.id
    assert PresentacionProducto.objects.filter(producto=presentacion.producto).count() == 2


def test_desactivar_y_reactivar(api_owner, api, presentacion):
    r = api_owner.patch(f"{URL}{presentacion.id}/", {"estado_presentacion": False}, format="json")
    assert r.status_code == 200 and r.data["estado_presentacion"] is False

    publico = api.get(f"/api/catalog/products/{presentacion.producto_id}/").json()
    assert publico["presentaciones"] == []
    assert publico["precio_desde"] is None

    # El editor del panel sigue viéndola para poder reactivarla.
    assert [p["id"] for p in api_owner.get(URL, {"producto": presentacion.producto_id}).data] == [presentacion.id]

    api_owner.patch(f"{URL}{presentacion.id}/", {"estado_presentacion": True}, format="json")
    publico = api.get(f"/api/catalog/products/{presentacion.producto_id}/").json()
    assert [p["id"] for p in publico["presentaciones"]] == [presentacion.id]


def test_reordenar(api_owner, producto, unidad):
    a = api_owner.post(URL, _alta(producto, unidad, nombre_presentacion="A"), format="json").data["id"]
    b = api_owner.post(URL, _alta(producto, unidad, nombre_presentacion="B"), format="json").data["id"]
    r = api_owner.post(f"{URL}reordenar/", {"producto": producto.id, "ids": [b, a]}, format="json")
    assert r.status_code == 200
    assert [p["id"] for p in r.data] == [b, a]
    assert [p["id"] for p in api_owner.get(URL, {"producto": producto.id}).data] == [b, a]


def test_reordenar_con_lista_incompleta_es_conflicto(api_owner, producto, unidad):
    a = api_owner.post(URL, _alta(producto, unidad, nombre_presentacion="A"), format="json").data["id"]
    api_owner.post(URL, _alta(producto, unidad, nombre_presentacion="B"), format="json")
    r = api_owner.post(f"{URL}reordenar/", {"producto": producto.id, "ids": [a]}, format="json")
    assert r.status_code == 409


# ==========================================================================
# PERMISOS
# ==========================================================================
def test_sin_permiso_no_se_crea_ni_se_edita(api_staff, producto, unidad, presentacion):
    assert api_staff.post(URL, _alta(producto, unidad), format="json").status_code == 403
    r = api_staff.patch(f"{URL}{presentacion.id}/", {"precio_unitario": "1"}, format="json")
    assert r.status_code == 403
    assert api_staff.post(f"{URL}reordenar/", {"producto": producto.id, "ids": [presentacion.id]},
                          format="json").status_code == 403
    presentacion.refresh_from_db()
    assert presentacion.precio_unitario == Decimal("10000")


def test_el_visitante_no_las_ve_ni_las_toca(api, producto, unidad):
    assert api.get(URL).status_code in (401, 403)
    assert api.post(URL, _alta(producto, unidad), format="json").status_code in (401, 403)


def test_con_el_permiso_delegado_si_se_edita(negocio, presentacion):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    from apps.tenancy.models import Membership

    usuario = get_user_model().objects.create_user(
        email_usuario="catalogo@ejemplo.test", nombre_usuario="Catálogo",
        password="clave-de-prueba-123", rol_usuario="ANALISTA", is_staff=True,
    )
    Membership.objects.create(usuario=usuario, tenant=negocio, rol="STAFF",
                              permisos=["catalog.change_producto"])
    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    r = cliente.patch(f"{URL}{presentacion.id}/", {"precio_unitario": "15000"}, format="json")
    assert r.status_code == 200, r.data


# ==========================================================================
# EL PRODUCTO Y SU GUARDADO ANIDADO
# ==========================================================================
def test_crear_producto_con_presentaciones_en_una_transaccion(api_owner, categoria, unidad):
    datos = {
        "nombre_producto": "Arroz",
        "categoria": categoria.id,
        "presentaciones": [
            {"nombre_presentacion": "Libra", "unidad_venta": unidad.id, "precio_unitario": "2500",
             "cantidad_minima": "1", "incremento_cantidad": "1", "decimales_cantidad": 0},
            {"nombre_presentacion": "Arroba", "unidad_venta": unidad.id, "precio_unitario": "0"},
        ],
    }
    r = api_owner.post("/api/catalog/products/", datos, format="json")
    assert r.status_code == 400
    # El error dice QUÉ presentación y QUÉ campo; la primera no tiene errores.
    assert r.data["presentaciones"][0] == {}
    assert "precio_unitario" in r.data["presentaciones"][1]
    # Nada a medias: ni el producto ni la presentación válida.
    assert not Producto.objects.filter(nombre_producto="Arroz").exists()

    datos["presentaciones"][1]["precio_unitario"] = "48000"
    r = api_owner.post("/api/catalog/products/", datos, format="json")
    assert r.status_code == 201, r.data
    assert r.data["num_presentaciones"] == 2
    assert [p["orden"] for p in r.data["presentaciones"]] == [0, 1]


def test_producto_con_presentaciones_repetidas_en_el_formulario(api_owner, categoria, unidad):
    fila = {"nombre_presentacion": "Libra", "unidad_venta": unidad.id, "precio_unitario": "2500"}
    r = api_owner.post(
        "/api/catalog/products/",
        {"nombre_producto": "Frijol", "categoria": categoria.id,
         "presentaciones": [fila, {**fila, "nombre_presentacion": "libra"}]},
        format="json",
    )
    assert r.status_code == 400
    assert "nombre_presentacion" in r.data["presentaciones"][1]


def test_patch_del_producto_sin_presentaciones_no_las_toca(api_owner, presentacion):
    producto = presentacion.producto
    r = api_owner.patch(
        f"/api/catalog/products/{producto.id}/",
        {"nombre_producto": "Nombre nuevo", "codigo_barras": "770123"},
        format="json",
    )
    assert r.status_code == 200, r.data
    presentacion.refresh_from_db()
    assert presentacion.estado_presentacion is True
    assert r.data["nombre_producto"] == "Nombre nuevo"
    assert r.data["codigo_barras"] == "770123"


def test_el_catalogo_cuenta_activas_e_inactivas(api_owner, presentacion, unidad):
    PresentacionProducto.objects.create(
        producto=presentacion.producto, nombre_presentacion="Viejo", unidad_venta=unidad,
        precio_unitario=1, estado_presentacion=False,
    )
    datos = api_owner.get(f"/api/catalog/products/{presentacion.producto_id}/").data
    assert datos["num_presentaciones"] == 1
    assert datos["num_presentaciones_inactivas"] == 1
    # El "desde" sale solo de las activas: la de $1 inactiva no lo falsea.
    assert Decimal(datos["precio_desde"]) == Decimal("10000")


def test_el_listado_del_catalogo_no_hace_una_consulta_por_producto(
    api_owner, categoria, unidad, django_assert_max_num_queries
):
    for i in range(6):
        p = Producto.objects.create(nombre_producto=f"P{i}", categoria=categoria)
        for j in range(3):
            PresentacionProducto.objects.create(
                producto=p, nombre_presentacion=f"Pres {j}", unidad_venta=unidad, precio_unitario=100 + j
            )
    with django_assert_max_num_queries(15):
        r = api_owner.get("/api/catalog/products/")
    assert r.status_code == 200


# ==========================================================================
# PEDIDOS: la regla y el estado se respetan, la historia no cambia
# ==========================================================================
@pytest.fixture
def kilo(producto, unidad):
    return PresentacionProducto.objects.create(
        producto=producto, nombre_presentacion="Kilo", unidad_venta=unidad, precio_unitario=2000,
        cantidad_minima=Decimal("0.5"), incremento_cantidad=Decimal("0.25"), decimales_cantidad=2,
    )


@pytest.mark.parametrize("cantidad", ["0.5", "0.75", "1", "3.25"])
def test_el_pedido_acepta_cantidades_de_la_secuencia(api, kilo, cantidad):
    r = api.post("/api/orders/", _pedido(kilo, cantidad), format="json")
    assert r.status_code == 201, r.data


@pytest.mark.parametrize("cantidad", ["0.25", "0.6", "1.1"])
def test_el_pedido_rechaza_cantidades_fuera_de_la_regla(api, kilo, cantidad):
    r = api.post("/api/orders/", _pedido(kilo, cantidad), format="json")
    assert r.status_code == 400
    assert "desde 0,5 y de 0,25 en 0,25" in str(r.data)


def test_el_pedido_no_acepta_una_presentacion_inactiva(api, kilo):
    kilo.estado_presentacion = False
    kilo.save()
    r = api.post("/api/orders/", _pedido(kilo, "1"), format="json")
    assert r.status_code == 400
    assert "ya no está disponible" in str(r.data)


def test_cambiar_precio_o_desactivar_no_reescribe_pedidos(api, api_owner, kilo):
    r = api.post("/api/orders/", _pedido(kilo, "1"), format="json")
    assert r.status_code == 201
    linea = DetallePedido.objects.get(pedido_id=r.data["pedido_id"])
    assert linea.precio_unitario == Decimal("2000")

    api_owner.patch(f"{URL}{kilo.id}/", {"precio_unitario": "2600"}, format="json")
    api_owner.delete(f"{URL}{kilo.id}/")

    linea.refresh_from_db()
    assert linea.precio_unitario == Decimal("2000")
    assert linea.presentacion_id == kilo.id
    assert PresentacionProducto.objects.filter(pk=kilo.pk).exists()


def test_el_pos_no_vende_una_presentacion_inactiva(kilo):
    from apps.pos.serializers import AgregarLineaSerializer

    kilo.estado_presentacion = False
    kilo.save()
    serializer = AgregarLineaSerializer(
        data={"presentacion_id": kilo.id, "cantidad": "1"}, context={"tenant": kilo.tenant}
    )
    assert not serializer.is_valid()
    assert "presentacion_id" in serializer.errors


def test_la_migracion_reparte_la_regla_del_producto():
    """La tabla de la migración 0012 y `regla_por_defecto` dicen lo mismo."""
    import importlib

    migracion = importlib.import_module("apps.catalog.migrations.0012_reparte_reglas_cantidad")
    for tipo, (paso, decimales) in migracion.REGLAS.items():
        producto = Producto(permite_fraccion=True, tipo_cantidad=tipo)
        assert cantidades.regla_por_defecto(producto) == {
            "cantidad_minima": paso, "incremento_cantidad": paso, "decimales_cantidad": decimales,
        }
    assert cantidades.regla_por_defecto(Producto(permite_fraccion=False, tipo_cantidad="cuarto"))[
        "incremento_cantidad"
    ] == Decimal("1")


def test_una_presentacion_vieja_en_cero_se_puede_desactivar_y_ordenar(api_owner, presentacion):
    """Datos guardados antes de estas reglas no bloquean el día a día."""
    PresentacionProducto.objects.filter(pk=presentacion.pk).update(precio_unitario=0)
    r = api_owner.patch(f"{URL}{presentacion.id}/", {"estado_presentacion": False}, format="json")
    assert r.status_code == 200, r.data
    r = api_owner.patch(f"{URL}{presentacion.id}/", {"orden": 3}, format="json")
    assert r.status_code == 200, r.data
    # Pero en cuanto se toca el precio, se exige uno real.
    r = api_owner.patch(f"{URL}{presentacion.id}/", {"precio_unitario": "0"}, format="json")
    assert r.status_code == 400 and "precio_unitario" in r.data


# ==========================================================================
# UNIDADES (el formulario puede crear una sin salir de la presentación)
# ==========================================================================
def test_crear_unidad_y_rechazar_duplicado(api_owner, unidad):
    r = api_owner.post("/api/catalog/units/", {"nombre_unidad": "Caja", "abreviatura_unidad": "cj"}, format="json")
    assert r.status_code == 201, r.data
    r = api_owner.post("/api/catalog/units/", {"nombre_unidad": "kilogramo", "abreviatura_unidad": "kg"}, format="json")
    assert r.status_code == 400 and "nombre_unidad" in r.data


def test_sin_permiso_no_se_crean_unidades(api_staff):
    r = api_staff.post("/api/catalog/units/", {"nombre_unidad": "Caja", "abreviatura_unidad": "cj"}, format="json")
    assert r.status_code == 403
