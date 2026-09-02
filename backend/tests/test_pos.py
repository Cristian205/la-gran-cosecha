"""
La caja.

Cinco promesas, y ninguna es «guarda ventas»:

1. Que cobrar y descontar ocurren juntos o no ocurren. Una venta que no se puede
   entregar es peor que una venta rechazada.
2. Que el turno cuadra: lo contado, lo esperado y la diferencia, los tres.
3. Que anular devuelve la mercancía sin borrar el histórico.
4. Que el POS es UNO: la ferretería y el mercado usan el mismo código con
   configuraciones opuestas.
5. Que un módulo no contratado no se puede usar aunque se conozca la URL.
"""
from decimal import Decimal

import pytest

from apps.business import aplicar as perfilar
from apps.business.consulta import perfil_pos
from apps.business.models import Preset, TenantModulo
from apps.billing.models import Plan, Producto
from apps.inventory import operaciones as inventario
from apps.inventory.models import Existencia, MovimientoInventario, Ubicacion
from apps.pos import operaciones as caja
from apps.pos import paneles
from apps.pos.models import LineaVenta, MedioPago, Turno, Venta

pytestmark = pytest.mark.django_db


@pytest.fixture
def con_pos(negocio):
    """
    Un negocio con el POS contratado y encendido.

    Hace falta tocar el plan porque `billing.0007` NO añade el POS a los planes
    existentes: es un producto que se vende aparte, y regalarlo a los clientes
    actuales en una migración sería una decisión comercial tomada por un
    programador.
    """
    plan = Plan.objects.get(suscripciones__tenant=negocio)
    plan.permisos = [*plan.permisos, "pos.add_venta", "pos.change_turno", "pos.delete_venta"]
    plan.save(update_fields=["permisos"])
    TenantModulo.objects.get_or_create(
        tenant=negocio, modulo=Producto.objects.get(slug="pos"), defaults={"activo": True}
    )
    return negocio


@pytest.fixture
def caja_abierta(con_pos, usuario_owner):
    return caja.abrir_turno(con_pos, usuario_owner, fondo_inicial=Decimal("50000"))


@pytest.fixture
def con_stock(producto, presentacion):
    producto.controla_stock = True
    producto.save(update_fields=["controla_stock"])
    inventario.entrada(producto, 100, motivo="Inventario inicial")
    return presentacion


# ==========================================================================
# 1. COBRAR Y DESCONTAR, O NINGUNA DE LAS DOS
# ==========================================================================
def test_cobrar_descuenta_en_el_acto(caja_abierta, usuario_owner, con_stock, producto):
    """
    El mostrador descuenta; no reserva.

    Es la diferencia deliberada con la tienda online: aquí no hay ventana entre
    confirmar y entregar, la bolsa se la lleva el cliente.
    """
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 3)
    efectivo = MedioPago.objects.get(codigo="efectivo")

    caja.cobrar(venta, [(efectivo, venta.total)], usuario=usuario_owner)

    venta.refresh_from_db()
    assert venta.estado == "PAGADA"
    assert inventario.disponible(producto) == Decimal("97.000")
    # Y el kardex sabe de dónde vino.
    movimiento = MovimientoInventario.objects.filter(origen_tipo="pos.Venta").first()
    assert movimiento.origen_id == venta.pk


def test_sin_stock_no_se_cobra_y_no_queda_nada_a_medias(
    caja_abierta, usuario_owner, con_stock, producto
):
    """
    Cobrar algo que no se puede entregar es peor que no cobrarlo.

    El descuento va en la MISMA transacción que los pagos, así que si el
    inventario se niega, la venta entera se deshace: no queda ni un pago
    registrado ni la venta marcada como pagada.
    """
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 500)
    efectivo = MedioPago.objects.get(codigo="efectivo")

    with pytest.raises(inventario.StockInsuficiente):
        caja.cobrar(venta, [(efectivo, venta.total)], usuario=usuario_owner)

    venta.refresh_from_db()
    assert venta.estado == "ABIERTA"
    assert venta.pagos.count() == 0
    assert inventario.disponible(producto) == Decimal("100.000")


def test_no_se_cobra_de_menos(caja_abierta, usuario_owner, con_stock):
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 2)
    efectivo = MedioPago.objects.get(codigo="efectivo")

    with pytest.raises(caja.PagoIncompleto):
        caja.cobrar(venta, [(efectivo, venta.total - 1)], usuario=usuario_owner)


def test_el_pago_partido_es_normal(caja_abierta, usuario_owner, con_stock):
    """Mitad efectivo, mitad tarjeta. Pasa todos los días."""
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 2)
    efectivo = MedioPago.objects.get(codigo="efectivo")
    tarjeta = MedioPago.objects.get(codigo="tarjeta")

    mitad = venta.total / 2
    caja.cobrar(venta, [(efectivo, mitad), (tarjeta, venta.total - mitad)], usuario=usuario_owner)

    venta.refresh_from_db()
    assert venta.estado == "PAGADA"
    assert venta.pagos.count() == 2


def test_una_venta_cobrada_no_se_edita(caja_abierta, usuario_owner, con_stock):
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 1)
    caja.cobrar(venta, [(MedioPago.objects.get(codigo="efectivo"), venta.total)])

    with pytest.raises(caja.VentaNoModificable):
        caja.agregar_linea(venta, con_stock, 1)


def test_las_lineas_se_congelan(caja_abierta, usuario_owner, con_stock, producto):
    """
    Renombrar o subir el precio no reescribe una venta de hace seis meses.

    Es la misma regla que `VersionPagina` y `DetallePedido`: lo histórico se
    guarda como copia, nunca como referencia.
    """
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    linea = caja.agregar_linea(venta, con_stock, 1)
    nombre = linea.nombre_congelado
    precio = linea.precio_unitario

    producto.nombre_producto = "Otro nombre"
    producto.save(update_fields=["nombre_producto"])
    con_stock.precio_unitario = precio * 3
    con_stock.save(update_fields=["precio_unitario"])

    linea.refresh_from_db()
    assert linea.nombre_congelado == nombre
    assert linea.precio_unitario == precio


# ==========================================================================
# 2. EL TURNO CUADRA
# ==========================================================================
def test_solo_hay_un_turno_abierto_por_caja(con_pos, usuario_owner, caja_abierta):
    with pytest.raises(caja.ErrorDeCaja):
        caja.abrir_turno(con_pos, usuario_owner)


def test_el_arqueo_solo_cuenta_el_efectivo(caja_abierta, usuario_owner, con_stock):
    """
    Lo cobrado con tarjeta llega al banco, no al cajón.

    Sumarlo haría que el arqueo no cuadrara nunca, que es la forma más rápida
    de que la gente deje de hacerlo.
    """
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 1)
    caja.cobrar(venta, [(MedioPago.objects.get(codigo="tarjeta"), venta.total)])

    assert caja.efectivo_esperado(caja_abierta) == caja_abierta.fondo_inicial


def test_cerrar_guarda_los_tres_numeros(caja_abierta, usuario_owner, con_stock):
    """
    Lo contado, lo esperado y la diferencia. Un sistema que solo guarda el
    número correcto no sirve para descubrir nada al día siguiente.
    """
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 1)
    caja.cobrar(venta, [(MedioPago.objects.get(codigo="efectivo"), venta.total)])

    esperado = caja.efectivo_esperado(caja_abierta)
    cerrado = caja.cerrar_turno(
        caja_abierta, usuario_owner, total_declarado=esperado - 5000, nota="Faltó vuelto"
    )

    assert cerrado.total_calculado == esperado
    assert cerrado.diferencia == Decimal("-5000")
    assert not cerrado.esta_abierto


def test_no_se_cierra_con_ventas_sin_cobrar(caja_abierta, usuario_owner, con_stock):
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 1)

    with pytest.raises(caja.ErrorDeCaja):
        caja.cerrar_turno(caja_abierta, usuario_owner, total_declarado=0)


def test_no_se_vende_con_la_caja_cerrada(caja_abierta, usuario_owner):
    caja.cerrar_turno(caja_abierta, usuario_owner, total_declarado=50000)
    with pytest.raises(caja.TurnoCerrado):
        caja.abrir_venta(caja_abierta, usuario_owner)


# ==========================================================================
# 3. ANULAR DEVUELVE, NO BORRA
# ==========================================================================
def test_anular_devuelve_la_mercancia(caja_abierta, usuario_owner, con_stock, producto):
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 4)
    caja.cobrar(venta, [(MedioPago.objects.get(codigo="efectivo"), venta.total)])
    assert inventario.disponible(producto) == Decimal("96.000")

    caja.anular(venta, usuario_owner, motivo="El cliente se arrepintió")

    venta.refresh_from_db()
    assert venta.estado == "ANULADA"
    assert inventario.disponible(producto) == Decimal("100.000")
    # El histórico conserva las dos: la venta y su vuelta.
    assert Venta.objects.filter(pk=venta.pk).exists()
    assert MovimientoInventario.objects.filter(origen_id=venta.pk).count() == 2


def test_anular_una_venta_abierta_no_toca_inventario(
    caja_abierta, usuario_owner, con_stock, producto
):
    """Nunca se descontó, así que no hay nada que devolver."""
    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 4)
    caja.anular(venta, usuario_owner)

    assert inventario.disponible(producto) == Decimal("100.000")
    assert MovimientoInventario.objects.filter(origen_id=venta.pk).count() == 0


# ==========================================================================
# 4. UN SOLO POS, DOS EXPERIENCIAS
# ==========================================================================
def test_el_mismo_pos_se_comporta_distinto_segun_el_perfil(negocio):
    """
    La promesa entera del encargo, en un test.

    Ni una rama de código: el mercado busca por categorías con foto, la
    ferretería con el lector de código de barras. Es el mismo módulo.
    """
    perfilar.aplicar_preset(negocio, Preset.objects.get(slug="mercado"))
    del_mercado = perfil_pos(negocio)

    perfilar.aplicar_preset(
        negocio, Preset.objects.get(slug="ferreteria"), sobrescribir=True
    )
    de_ferreteria = perfil_pos(negocio)

    assert del_mercado["busqueda"] == "categorias"
    assert del_mercado["muestra_imagenes"] is True
    assert de_ferreteria["busqueda"] == "codigo_barras"
    assert de_ferreteria["muestra_imagenes"] is False
    assert de_ferreteria["pide_atributos_en_linea"] is True


def test_un_perfil_pos_con_basura_no_deja_la_caja_sin_selector(negocio):
    """Una `busqueda` que el frontend no sabe pintar dejaría la caja inservible."""
    from apps.business.models import PerfilNegocio

    perfil = PerfilNegocio.objects.get(tenant=negocio)
    perfil.perfil_pos = {"busqueda": "telepatia", "inventada": True}
    perfil.save(update_fields=["perfil_pos"])

    resuelto = perfil_pos(negocio)
    assert resuelto["busqueda"] == "rejilla"   # el valor por defecto
    assert "inventada" not in resuelto


def test_el_registro_de_paneles_filtra_por_modulo_contratado():
    """
    El mecanismo que hará aditivo el módulo de reservas.

    El POS no sabe qué es una mesa: sabe que hay un panel registrado. Hoy solo
    trae el suyo, y eso ya prueba la forma del contrato.
    """
    sin_modulos = paneles.disponibles([])
    assert [p.clave for p in sin_modulos] == ["cliente"]

    con_reservas = paneles.registrar(
        paneles.Panel(clave="mesas", nombre="Mesas", modulo="reservas")
    )
    try:
        assert "mesas" not in [p.clave for p in paneles.disponibles([])]
        assert "mesas" in [p.clave for p in paneles.disponibles(["reservas"])]
    finally:
        paneles._REGISTRO.pop(con_reservas.clave, None)


# ==========================================================================
# 5. UN MÓDULO SIN CONTRATAR NO SE USA
# ==========================================================================
def test_sin_el_modulo_la_caja_no_existe(api_owner, negocio):
    """
    Conocer la URL no basta.

    Se comprueba en el servidor y no ocultando el menú: el menú lo pinta el
    navegador de quien mira.
    """
    respuesta = api_owner.get("/api/pos/configuracion/")
    assert respuesta.status_code == 403


def test_con_el_modulo_la_caja_responde(api_owner, con_pos):
    respuesta = api_owner.get("/api/pos/configuracion/")
    assert respuesta.status_code == 200
    assert respuesta.data["turno"] is None          # todavía sin abrir
    assert respuesta.data["perfil_pos"]["busqueda"] # siempre completo
    assert [p["clave"] for p in respuesta.data["paneles"]] == ["cliente"]


def test_el_flujo_completo_por_api(api_owner, con_pos, con_stock, producto):
    abierto = api_owner.post("/api/pos/turnos/abrir/", {"fondo_inicial": "20000"}, format="json")
    assert abierto.status_code == 201

    venta = api_owner.post("/api/pos/ventas/abrir/", {}, format="json")
    assert venta.status_code == 201
    venta_id = venta.data["id"]

    linea = api_owner.post(
        f"/api/pos/ventas/{venta_id}/lineas/",
        {"presentacion_id": con_stock.id, "cantidad": "2"},
        format="json",
    )
    assert linea.status_code == 200
    total = Decimal(linea.data["total"])
    assert total > 0

    efectivo = MedioPago.objects.get(codigo="efectivo")
    cobrada = api_owner.post(
        f"/api/pos/ventas/{venta_id}/cobrar/",
        {"pagos": [{"medio_id": efectivo.id, "importe": str(total)}]},
        format="json",
    )
    assert cobrada.status_code == 200
    assert cobrada.data["estado"] == "PAGADA"
    assert inventario.disponible(producto) == Decimal("98.000")


def test_la_api_traduce_la_falta_de_stock_a_400(api_owner, con_pos, con_stock):
    """
    Quedarse sin mercancía es una respuesta normal, no un fallo del servidor.

    Y el mensaje está escrito para que lo lea un cajero, así que viaja tal cual.
    """
    api_owner.post("/api/pos/turnos/abrir/", {}, format="json")
    venta = api_owner.post("/api/pos/ventas/abrir/", {}, format="json")
    api_owner.post(
        f"/api/pos/ventas/{venta.data['id']}/lineas/",
        {"presentacion_id": con_stock.id, "cantidad": "999"},
        format="json",
    )
    efectivo = MedioPago.objects.get(codigo="efectivo")

    respuesta = api_owner.post(
        f"/api/pos/ventas/{venta.data['id']}/cobrar/",
        {"pagos": [{"medio_id": efectivo.id, "importe": "9999999"}]},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "disponibles" in respuesta.data["detail"] or "suficiente" in respuesta.data["detail"]


# ==========================================================================
# 6. AISLAMIENTO
# ==========================================================================
def test_las_ventas_de_un_negocio_no_se_ven_desde_otro(caja_abierta, usuario_owner, con_stock, tenant_b):
    from apps.tenancy.context import usar_tenant

    venta = caja.abrir_venta(caja_abierta, usuario_owner)
    caja.agregar_linea(venta, con_stock, 1)

    with usar_tenant(tenant_b):
        assert Venta.objects.count() == 0
        assert LineaVenta.objects.count() == 0
        assert Turno.objects.count() == 0


# ==========================================================================
# 7. LA DERIVA DE LOS DOS CATALOGOS
# ==========================================================================
def test_cada_modulo_tiene_un_solo_producto_comercial():
    """
    El fallo que costo entender, convertido en guardia permanente.

    `billing.0002` siembra los permisos desde el catalogo Python y `0004` deriva
    un `Producto` por cada etiqueta distinta, con el slug sacado de esa etiqueta.
    Una migracion de modulo que CREE un producto con su propio slug acaba con
    dos filas para lo mismo, y los permisos colgando del que no era: el modulo
    queda contratado y apagado a la vez, sin que nada avise.

    Inventario se libro por casualidad —slugify("Inventario") da "inventario"—.
    Este test es lo que evita volver a depender de esa suerte.
    """
    from collections import Counter

    from apps.billing.models import PermisoDisponible, Producto

    repetidos = [n for n, veces in Counter(
        Producto.objects.values_list("nombre", flat=True)
    ).items() if veces > 1]
    assert not repetidos, f"Dos productos comerciales para lo mismo: {repetidos}"

    # Y los permisos de un modulo cuelgan todos del mismo producto.
    for prefijo, slug in (
        ("pos.", "pos"),
        ("inventory.", "inventario"),
        ("reservations.", "reservas"),
    ):
        productos = set(
            PermisoDisponible.objects.filter(codename__startswith=prefijo)
            .values_list("producto__slug", flat=True)
        )
        assert productos == {slug}, f"{prefijo} apunta a {productos}, no a {{'{slug}'}}"


def test_el_slug_del_codigo_y_el_de_la_base_coinciden():
    """
    `pos.views.MODULO` es lo que el guardia compara. Si la base guarda otro
    slug, la caja queda inaccesible para todo el mundo y el 403 no explica nada.
    """
    from apps.billing.models import Producto
    from apps.pos.views import MODULO

    assert Producto.objects.filter(slug=MODULO, estado="ACTIVO").exists()


def test_cada_panel_registrado_tiene_componente_en_el_panel():
    """
    La deriva del registro, ahora entre el servidor y la caja del navegador.

    Es el mismo fallo silencioso que ya vigila el motor de tiendas con
    `Bloque` y `registro.tsx`, un piso mas abajo: un panel que el servidor
    ofrece y que React no sabe pintar deja el lateral del carrito vacio sin dar
    ningun error. El negocio ve una caja a la que «le falta algo» y nadie sabe
    decir que.

    Se lee el registro de verdad y no una lista escrita aqui: una lista a mano
    acabaria midiendo si alguien toco el test.
    """
    import re
    from pathlib import Path

    from apps.pos import paneles

    registro = (
        Path(__file__).resolve().parents[2]
        / "frontend" / "admin-panel" / "src" / "pages" / "pos" / "paneles" / "registro.tsx"
    ).read_text(encoding="utf-8")

    cuerpo = registro.split("export const PANELES")[1]
    conocidos = set(re.findall(r'^\s*"?([a-z0-9_-]+)"?:\s*[{A-Za-z]', cuerpo, re.M))

    declarados = {p.clave for p in paneles.disponibles(["pos", "reservas"])}
    sin_componente = declarados - conocidos
    assert not sin_componente, (
        f"El servidor ofrece paneles que la caja no sabe pintar: {sorted(sin_componente)}"
    )
    sin_declarar = conocidos - declarados
    assert not sin_declarar, (
        f"Hay paneles que ningun modulo puede ofrecer: {sorted(sin_declarar)}"
    )
