"""
Planificación logística (apps/logistica: rutas semanales y centro del día).

1. La programación semanal se guarda por plantilla; una sola está activa.
2. Un ajuste por fecha cambia o cancela la ruta SOLO ese día.
3. La propuesta cruza los pedidos REALES del día con las rutas: cada cliente
   va al vehículo que lo visita, en el orden de la ruta; lo que no encaja
   queda sin asignar con su motivo.
4. Los productos se consolidan por cliente sin convertir unidades y sin
   perder de qué pedido sale cada cantidad.
5. Las canastillas solo se estiman con una regla de carga explícita.
6. Generar crea un despacho por vehículo, con la primera parada junto a las
   puertas; regenerar sin cambios respeta el acomodo hecho a mano.
7. Confirmar congela los datos operativos: cambiar la ruta después no
   reescribe el despacho histórico.
"""
import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.billing.models import Plan, Producto
from apps.business.models import TenantModulo
from apps.logistica.models import Furgon, PlanoCarga, ReglaCarga, TipoCanastilla
from apps.orders.models import Cliente, DetallePedido, Pedido

pytestmark = pytest.mark.django_db

PERMISOS = ["logistica.view_planocarga", "logistica.add_planocarga", "logistica.change_furgon"]
LUNES = datetime.date(2026, 11, 23)
BASE = "/api/logistica/"
ESQUEMA = {"tipo": "frente_columnas", "niveles": 5, "pasillo_min_cm": 40}


@pytest.fixture
def con_plano(negocio):
    plan = Plan.objects.get(suscripciones__tenant=negocio)
    plan.permisos = [*plan.permisos, *PERMISOS]
    plan.save(update_fields=["permisos"])
    TenantModulo.objects.get_or_create(
        tenant=negocio, modulo=Producto.objects.get(slug="plano-carga"), defaults={"activo": True}
    )
    return negocio


@pytest.fixture
def turbos(con_plano):
    a = Furgon.objects.create(nombre="Turbo A", placa="AAA111", largo_cm=553, ancho_cm=230, alto_cm=220, esquema_carga=ESQUEMA)
    b = Furgon.objects.create(nombre="Turbo B", placa="BBB222", largo_cm=553, ancho_cm=230, alto_cm=220, esquema_carga=ESQUEMA)
    return a, b


@pytest.fixture
def canastilla(con_plano):
    return TipoCanastilla.objects.create(nombre="Estándar", largo_cm=60, ancho_cm=40, alto_cm=25, max_apiladas=6)


@pytest.fixture
def clientes(con_plano):
    return {n: Cliente.objects.create(nombre_cliente=n, direccion_cliente=f"Calle {n}") for n in
            ("La 68", "Don Luis", "La Cima", "Menta", "Fruver de Lucho", "Universidades", "Sin Ruta")}


def _pedido(cliente, presentacion, cantidad, fecha=LUNES, **extra):
    momento = timezone.make_aware(datetime.datetime.combine(fecha, datetime.time(9, 0)))
    p = Pedido.objects.create(cliente=cliente, fecha_programada=momento, **extra)
    DetallePedido.objects.create(pedido=p, presentacion=presentacion, cantidad=Decimal(cantidad))
    return p


@pytest.fixture
def programacion(api_owner, turbos, clientes):
    a, b = turbos
    prog = api_owner.post(f"{BASE}programaciones/", {"nombre": "Semana normal"}, format="json").json()
    ra = api_owner.post(f"{BASE}rutas/", {
        "programacion": prog["id"], "dia_semana": 0, "nombre": "Turbo A · lunes", "furgon": a.id, "color": "#16a34a",
        "paradas": [{"cliente": clientes[n].id} for n in ("La 68", "Don Luis", "La Cima", "Menta")],
    }, format="json")
    assert ra.status_code == 201, ra.json()
    rb = api_owner.post(f"{BASE}rutas/", {
        "programacion": prog["id"], "dia_semana": 0, "nombre": "Turbo B · lunes", "furgon": b.id, "color": "#2563eb",
        "paradas": [{"cliente": clientes[n].id} for n in ("Fruver de Lucho", "Universidades")],
    }, format="json")
    assert rb.status_code == 201, rb.json()
    return {"prog": prog, "a": ra.json(), "b": rb.json()}


def _dia(api, canastilla, fecha=LUNES):
    r = api.get(f"{BASE}planificacion/dia/", {"fecha": fecha.isoformat(), "tipo_canastilla": canastilla.id})
    assert r.status_code == 200, r.json()
    return r.json()


def _a_generar(propuesta):
    """La propuesta tal cual, en el formato que espera `generar/`."""
    return [
        {
            "clave": v["clave"], "furgon": v["furgon"]["id"], "nombre": v["nombre"],
            "paradas": [
                {"cliente": p["cliente_id"], "pedidos": [d["id"] for d in p["pedidos"]], "canastillas": p["canastillas"]}
                for p in v["paradas"]
            ],
        }
        for v in propuesta["vehiculos"] if v["paradas"]
    ]


def test_la_primera_programacion_queda_activa_y_solo_una_lo_esta(api_owner, programacion):
    assert programacion["prog"]["activa"] is True
    otra = api_owner.post(f"{BASE}programaciones/", {"nombre": "Diciembre"}, format="json").json()
    assert otra["activa"] is False
    api_owner.post(f"{BASE}programaciones/{otra['id']}/activar/")
    lista = {p["nombre"]: p["activa"] for p in api_owner.get(f"{BASE}programaciones/").json()}
    assert lista == {"Semana normal": False, "Diciembre": True}


def test_una_ruta_no_repite_vehiculo_el_mismo_dia(api_owner, programacion, turbos):
    r = api_owner.post(f"{BASE}rutas/", {
        "programacion": programacion["prog"]["id"], "dia_semana": 0, "nombre": "Otra", "furgon": turbos[0].id,
        "color": "#000000", "paradas": [],
    }, format="json")
    assert r.status_code == 400 and "ya tiene una ruta" in str(r.json())


def test_paradas_con_clientes_inexistentes_se_rechazan(api_owner, programacion):
    r = api_owner.patch(f"{BASE}rutas/{programacion['a']['id']}/", {"paradas": [{"cliente": 999999}]}, format="json")
    assert r.status_code == 400


def test_la_propuesta_cruza_pedidos_con_rutas(api_owner, programacion, canastilla, clientes, presentacion):
    p1 = _pedido(clientes["Don Luis"], presentacion, "35")
    p2 = _pedido(clientes["Don Luis"], presentacion, "12")  # segundo pedido del mismo cliente
    p3 = _pedido(clientes["La 68"], presentacion, "4")
    p4 = _pedido(clientes["Universidades"], presentacion, "10")
    p5 = _pedido(clientes["Sin Ruta"], presentacion, "2")
    _pedido(clientes["Menta"], presentacion, "1", fecha=LUNES + datetime.timedelta(days=1))  # otro día

    d = _dia(api_owner, canastilla)
    va = next(v for v in d["vehiculos"] if v["nombre"] == "Turbo A · lunes")
    vb = next(v for v in d["vehiculos"] if v["nombre"] == "Turbo B · lunes")
    # Orden de la ruta: La 68 → Don Luis (La Cima y Menta no pidieron).
    assert [p["nombre"] for p in va["paradas"]] == ["La 68", "Don Luis"]
    assert {x["nombre"] for x in va["paradas_sin_pedido"]} == {"La Cima", "Menta"}
    assert [p["nombre"] for p in vb["paradas"]] == ["Universidades"]

    # Consolidado: 35 + 12 = 47, sin perder cuánto aportó cada pedido.
    don_luis = va["paradas"][1]
    assert {d["id"] for d in don_luis["pedidos"]} == {p1.id, p2.id}
    (prod,) = don_luis["productos"]
    assert prod["cantidad"] == "47" and prod["unidad"] == "Bulto"
    assert {x["id"]: x["cantidad"] for x in prod["pedidos"]} == {p1.id: "35", p2.id: "12"}
    # Sin regla de carga no se estima: se avisa.
    assert don_luis["sin_regla"] == ["Producto de prueba"]

    assert [s["id"] for s in d["sin_asignar"]] == [p5.id]
    assert "ninguna ruta" in d["sin_asignar"][0]["motivo"]
    assert d["resumen"]["pedidos"] == 5
    assert p3.id in {x["id"] for x in va["paradas"][0]["pedidos"]} and p4.id


def test_las_canastillas_salen_de_la_regla_de_carga(api_owner, programacion, canastilla, clientes, presentacion):
    r = api_owner.post(f"{BASE}reglas-carga/guardar/", [
        {"presentacion": presentacion.id, "unidades_por_canastilla": "10", "peso_kg_por_unidad": "1.5"},
    ], format="json")
    assert r.status_code == 200, r.json()
    assert ReglaCarga.objects.get(presentacion=presentacion).unidades_por_canastilla == Decimal("10")
    _pedido(clientes["Don Luis"], presentacion, "35")
    _pedido(clientes["Don Luis"], presentacion, "12")
    d = _dia(api_owner, canastilla)
    don_luis = next(p for v in d["vehiculos"] for p in v["paradas"] if p["nombre"] == "Don Luis")
    assert don_luis["canastillas"] == 5  # 47 / 10 → 4,7 → 5
    assert don_luis["peso_kg"] == 70.5 and don_luis["sin_regla"] == []


def test_un_ajuste_cambia_solo_esa_fecha(api_owner, programacion, canastilla, clientes, turbos, presentacion):
    _pedido(clientes["Menta"], presentacion, "3")
    _pedido(clientes["Menta"], presentacion, "3", fecha=LUNES + datetime.timedelta(days=7))
    # Ese lunes Menta la visita la Turbo B; la Turbo A no sale.
    r = api_owner.post(f"{BASE}ajustes-ruta/", {
        "fecha": LUNES.isoformat(), "ruta": programacion["b"]["id"], "furgon": turbos[1].id,
        "paradas": [{"cliente": clientes["Menta"].id}, {"cliente": clientes["Universidades"].id}],
    }, format="json")
    assert r.status_code == 201, r.json()
    r = api_owner.post(f"{BASE}ajustes-ruta/", {"fecha": LUNES.isoformat(), "ruta": programacion["a"]["id"], "cancelada": True}, format="json")
    assert r.status_code == 201, r.json()

    d = _dia(api_owner, canastilla)
    assert [v["nombre"] for v in d["vehiculos"]] == ["Turbo B · lunes"]
    assert d["vehiculos"][0]["paradas"][0]["nombre"] == "Menta"
    assert [c["nombre"] for c in d["rutas_canceladas"]] == ["Turbo A · lunes"]
    # El lunes siguiente vuelve la ruta habitual.
    d2 = _dia(api_owner, canastilla, LUNES + datetime.timedelta(days=7))
    va = next(v for v in d2["vehiculos"] if v["nombre"] == "Turbo A · lunes")
    assert [p["nombre"] for p in va["paradas"]] == ["Menta"]


def test_un_ajuste_debe_caer_en_el_dia_de_la_ruta(api_owner, programacion):
    r = api_owner.post(f"{BASE}ajustes-ruta/", {
        "fecha": (LUNES + datetime.timedelta(days=1)).isoformat(), "ruta": programacion["a"]["id"], "cancelada": True,
    }, format="json")
    assert r.status_code == 400 and "no sale ese día" in str(r.json())


def test_generar_crea_un_despacho_por_vehiculo(api_owner, programacion, canastilla, clientes, presentacion):
    p_68 = _pedido(clientes["La 68"], presentacion, "4")
    p_luis = _pedido(clientes["Don Luis"], presentacion, "35")
    p_uni = _pedido(clientes["Universidades"], presentacion, "10")
    d = _dia(api_owner, canastilla)
    vehiculos = _a_generar(d)
    # Ajuste manual antes de confirmar: La 68 lleva 3 canastillas.
    vehiculos[0]["paradas"][0]["canastillas"] = 3
    r = api_owner.post(f"{BASE}planificacion/generar/", {
        "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id, "vehiculos": vehiculos,
    }, format="json")
    assert r.status_code == 201, r.json()
    assert len(r.json()["despachos"]) == 2

    plano = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    assert plano.estado == "BORRADOR" and plano.ruta_id == programacion["a"]["id"]
    assert [(g["nombre"], g["orden"], g["cantidad"]) for g in plano.grupos] == [("La 68", 1, 3), ("Don Luis", 2, 1)]
    assert {a.pedido_id for a in plano.pedidos.all()} == {p_68.id, p_luis.id}
    assert len(plano.posiciones) == 4
    # La primera parada va junto a las puertas: más lejos de la cabina que la última.
    x_de = lambda gid: [p["x_cm"] for p in plano.posiciones if p["grupo"] == gid]  # noqa: E731
    assert min(x_de("c%d" % clientes["La 68"].id)) >= max(x_de("c%d" % clientes["Don Luis"].id))
    assert plano.datos_operativos["paradas"][0]["nombre"] == "La 68"
    assert PlanoCarga.objects.get(ruta_clave=f"r{programacion['b']['id']}").pedidos.get().pedido_id == p_uni.id

    # La propuesta ya muestra los pedidos en su despacho y nada sin asignar.
    d2 = r.json()["propuesta"]
    assert d2["sin_asignar"] == []
    assert next(v for v in d2["vehiculos"] if v["clave"] == plano.ruta_clave)["despacho"]["id"] == plano.id


def test_regenerar_sin_cambios_respeta_el_acomodo_manual(api_owner, programacion, canastilla, clientes, presentacion):
    _pedido(clientes["La 68"], presentacion, "4")
    _pedido(clientes["Don Luis"], presentacion, "35")
    cuerpo = {"fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id, "vehiculos": _a_generar(_dia(api_owner, canastilla))}
    api_owner.post(f"{BASE}planificacion/generar/", cuerpo, format="json")
    plano = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    # A mano: la canastilla de La 68 se pasa a la pila 3.
    pos = [{"grupo": p["grupo"], "pila": p["pila"], "nivel": p["nivel"]} for p in plano.posiciones]
    pos[-1] = {**pos[-1], "pila": 3, "nivel": 0}
    assert api_owner.patch(f"/api/logistica/planos/{plano.id}/", {"posiciones": pos}, format="json").status_code == 200
    plano.refresh_from_db()
    antes = plano.posiciones

    r = api_owner.post(f"{BASE}planificacion/generar/", {**cuerpo, "vehiculos": _a_generar(_dia(api_owner, canastilla))}, format="json")
    assert r.status_code == 201, r.json()
    plano.refresh_from_db()
    assert plano.posiciones == antes


def test_mover_un_pedido_de_vehiculo(api_owner, programacion, canastilla, clientes, presentacion):
    _pedido(clientes["La 68"], presentacion, "4")
    p_luis = _pedido(clientes["Don Luis"], presentacion, "35")
    api_owner.post(f"{BASE}planificacion/generar/", {
        "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id, "vehiculos": _a_generar(_dia(api_owner, canastilla)),
    }, format="json")
    d = _dia(api_owner, canastilla)
    vehiculos = _a_generar(d)
    va = next(v for v in vehiculos if v["clave"] == f"r{programacion['a']['id']}")
    parada = next(p for p in va["paradas"] if p["cliente"] == clientes["Don Luis"].id)
    va["paradas"].remove(parada)
    vb = next((v for v in vehiculos if v["clave"] == f"r{programacion['b']['id']}"), None)
    if vb is None:
        vb = {"clave": f"r{programacion['b']['id']}", "furgon": programacion["b"]["furgon"], "nombre": "Turbo B · lunes", "paradas": []}
        vehiculos.append(vb)
    vb["paradas"].append(parada)
    r = api_owner.post(f"{BASE}planificacion/generar/", {
        "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id, "vehiculos": vehiculos,
    }, format="json")
    assert r.status_code == 201, r.json()
    a = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    b = PlanoCarga.objects.get(ruta_clave=f"r{programacion['b']['id']}")
    assert [g["nombre"] for g in a.grupos] == ["La 68"]
    assert b.pedidos.get().pedido_id == p_luis.id


def test_confirmar_congela_los_datos_operativos(api_owner, programacion, canastilla, clientes, presentacion):
    _pedido(clientes["La 68"], presentacion, "4", observaciones="Dejar en bodega")
    api_owner.post(f"{BASE}planificacion/generar/", {
        "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id, "vehiculos": _a_generar(_dia(api_owner, canastilla)),
    }, format="json")
    plano = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    r = api_owner.post(f"/api/logistica/planos/{plano.id}/confirmar/")
    assert r.status_code == 200, r.json()

    # Después: se renombra el cliente y se cambia la ruta habitual.
    Cliente.objects.filter(pk=clientes["La 68"].pk).update(nombre_cliente="Otro nombre")
    api_owner.patch(f"{BASE}rutas/{programacion['a']['id']}/", {"paradas": []}, format="json")

    html = api_owner.get(f"/api/logistica/planos/{plano.id}/pdf/", {"formato": "html"}).content.decode()
    for texto in ("GUÍA DE CARGA Y ENTREGA", "Turbo A", "AAA111", "La 68", "Producto de prueba", "Dejar en bodega", "Bulto"):
        assert texto in html, texto
    assert "Otro nombre" not in html

    # Lo confirmado no se regenera.
    r = api_owner.post(f"{BASE}planificacion/generar/", {
        "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id,
        "vehiculos": [{"clave": "f1", "furgon": plano.furgon_id, "nombre": "x",
                       "paradas": [{"cliente": clientes["La 68"].id, "pedidos": [plano.pedidos.get().pedido_id], "canastillas": 1}]}],
    }, format="json")
    assert r.status_code == 400 and "confirmado" in str(r.json())


def test_generar_valida_pedidos_y_clientes(api_owner, programacion, canastilla, clientes, presentacion, turbos):
    p = _pedido(clientes["La 68"], presentacion, "4")
    otro_dia = _pedido(clientes["La 68"], presentacion, "4", fecha=LUNES + datetime.timedelta(days=1))
    def generar(paradas):
        return api_owner.post(f"{BASE}planificacion/generar/", {
            "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id,
            "vehiculos": [{"clave": "f9", "furgon": turbos[0].id, "nombre": "x", "paradas": paradas}],
        }, format="json")
    assert "no se entrega" in str(generar([{"cliente": clientes["La 68"].id, "pedidos": [otro_dia.id], "canastillas": 1}]).json())
    assert "otro cliente" in str(generar([{"cliente": clientes["Menta"].id, "pedidos": [p.id], "canastillas": 1}]).json())
    assert generar([{"cliente": clientes["La 68"].id, "pedidos": [p.id], "canastillas": 0}]).status_code == 400


def test_sin_permiso_de_armar_no_genera(api_staff, usuario_staff, negocio, con_plano, canastilla):
    from apps.tenancy.models import Membership  # noqa: PLC0415

    Membership.objects.filter(usuario=usuario_staff, tenant=negocio).update(permisos=["logistica.view_planocarga"])
    assert api_staff.get(f"{BASE}planificacion/dia/", {"fecha": LUNES.isoformat()}).status_code == 200
    r = api_staff.post(f"{BASE}planificacion/generar/", {"fecha": LUNES.isoformat(), "vehiculos": []}, format="json")
    assert r.status_code == 403


def test_liberar_un_pedido_lo_saca_de_su_borrador(api_owner, programacion, canastilla, clientes, presentacion):
    p_68 = _pedido(clientes["La 68"], presentacion, "4")
    p_luis = _pedido(clientes["Don Luis"], presentacion, "35")
    cuerpo = {"fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id, "vehiculos": _a_generar(_dia(api_owner, canastilla))}
    api_owner.post(f"{BASE}planificacion/generar/", cuerpo, format="json")
    vehiculos = _a_generar(_dia(api_owner, canastilla))
    for v in vehiculos:
        v["paradas"] = [p for p in v["paradas"] if p_luis.id not in p["pedidos"]]
    r = api_owner.post(f"{BASE}planificacion/generar/", {**cuerpo, "vehiculos": vehiculos, "liberar": [p_luis.id]}, format="json")
    assert r.status_code == 201, r.json()
    # Ya no está en ningún despacho: la propuesta lo vuelve a sugerir por su ruta.
    don_luis = next(p for v in r.json()["propuesta"]["vehiculos"] for p in v["paradas"] if p["nombre"] == "Don Luis")
    assert don_luis["pedidos"][0]["despacho"] is None
    plano = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    assert [a.pedido_id for a in plano.pedidos.all()] == [p_68.id]
    assert [g["nombre"] for g in plano.grupos] == ["La 68"]
