"""
Lotes de despacho (apps/logistica/lotes.py): de los pedidos del día a los
vehículos cargados y documentados.

 1. Los pedidos elegibles son los que todavía no están en un lote ni en un
    despacho, agrupados por fecha de ENTREGA.
 2. Crear un lote reserva sus pedidos: ninguno puede entrar en dos lotes.
 3. El reparto respeta la ruta: un cliente que solo visita una turbo va a esa.
 4. Un cliente que visitan varias turbos va a la que vaya más holgada, no
    «la primera» ni por mitades.
 5. Un cliente fuera de ruta entra donde haya capacidad y queda marcado.
 6. Lo que no cabe en ningún vehículo no se inventa: queda sin asignar.
 7. Las correcciones manuales se validan y quedan en la bitácora.
 8. Una entrega extraordinaria (sin pedido) llega hasta el plano de carga.
 9. Generar crea un despacho por vehículo atado al lote y mueve el estado
    logístico de cada pedido.
10. Confirmar exige despachos sin errores y congela el resumen.
11. Anular devuelve los pedidos a «pendiente de planificación».
12. La documentación del lote sale en PDF: planos, productos y facturas.
"""
import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.billing.models import Plan, Producto
from apps.business.models import TenantModulo
from apps.logistica.models import EventoLote, Furgon, LoteDespacho, PlanoCarga, TipoCanastilla
from apps.orders.models import Cliente, DetallePedido, Pedido

pytestmark = pytest.mark.django_db

PERMISOS = ["logistica.view_planocarga", "logistica.add_planocarga", "logistica.change_furgon"]
LUNES = datetime.date(2026, 11, 23)
BASE = "/api/logistica/"
LOTES = f"{BASE}lotes/"
#: Furgón chico: 2 pilas × 2 niveles = 4 canastillas. Sirve para provocar
#: sobrecapacidad con pedidos pequeños, que es lo que hay que probar.
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
    a = Furgon.objects.create(
        nombre="Turbo A", placa="AAA111", largo_cm=553, ancho_cm=230, alto_cm=220,
        carga_util_kg=4000, esquema_carga=ESQUEMA,
    )
    b = Furgon.objects.create(
        nombre="Turbo B", placa="BBB222", largo_cm=553, ancho_cm=230, alto_cm=220,
        carga_util_kg=4000, esquema_carga=ESQUEMA,
    )
    return a, b


@pytest.fixture
def canastilla(con_plano):
    return TipoCanastilla.objects.create(
        nombre="Estándar", largo_cm=60, ancho_cm=40, alto_cm=25, max_apiladas=6
    )


@pytest.fixture
def clientes(con_plano):
    nombres = ("La 68", "Don Luis", "La Cima", "Menta", "Fruver de Lucho", "Universidades", "Sin Ruta")
    return {n: Cliente.objects.create(nombre_cliente=n, direccion_cliente=f"Calle {n}") for n in nombres}


def _pedido(cliente, presentacion, cantidad, fecha=LUNES, **extra):
    momento = timezone.make_aware(datetime.datetime.combine(fecha, datetime.time(9, 0)))
    p = Pedido.objects.create(cliente=cliente, fecha_programada=momento, **extra)
    DetallePedido.objects.create(pedido=p, presentacion=presentacion, cantidad=Decimal(cantidad))
    return p


@pytest.fixture
def regla(api_owner, presentacion):
    """Una canastilla cada 10 unidades, 1,5 kg por unidad."""
    r = api_owner.post(
        f"{BASE}reglas-carga/guardar/",
        [{"presentacion": presentacion.id, "unidades_por_canastilla": "10", "peso_kg_por_unidad": "1.5"}],
        format="json",
    )
    assert r.status_code == 200, r.json()
    return presentacion


@pytest.fixture
def programacion(api_owner, turbos, clientes):
    """Turbo A visita cuatro clientes el lunes; Turbo B, dos. «Menta» va en las dos."""
    a, b = turbos
    prog = api_owner.post(f"{BASE}programaciones/", {"nombre": "Semana normal"}, format="json").json()
    ra = api_owner.post(f"{BASE}rutas/", {
        "programacion": prog["id"], "dia_semana": 0, "nombre": "Turbo A · lunes", "furgon": a.id,
        "color": "#16a34a",
        "paradas": [{"cliente": clientes[n].id} for n in ("La 68", "Don Luis", "La Cima", "Menta")],
    }, format="json")
    assert ra.status_code == 201, ra.json()
    rb = api_owner.post(f"{BASE}rutas/", {
        "programacion": prog["id"], "dia_semana": 0, "nombre": "Turbo B · lunes", "furgon": b.id,
        "color": "#2563eb",
        "paradas": [{"cliente": clientes[n].id} for n in ("Fruver de Lucho", "Universidades", "Menta")],
    }, format="json")
    assert rb.status_code == 201, rb.json()
    return {"prog": prog, "a": ra.json(), "b": rb.json()}


def _elegibles(api, fecha=None):
    r = api.get(f"{LOTES}elegibles/", {"fecha": fecha.isoformat()} if fecha else {})
    assert r.status_code == 200, r.json()
    return r.json()


def _crear(api, canastilla, pedidos, fecha=LUNES, **extra):
    r = api.post(LOTES, {
        "fecha": fecha.isoformat(), "tipo_canastilla": canastilla.id,
        "pedidos": [p.id if hasattr(p, "id") else p for p in pedidos], **extra,
    }, format="json")
    return r


def _ok(respuesta, esperado=200):
    assert respuesta.status_code == esperado, respuesta.json()
    return respuesta.json()


def _vehiculo(lote: dict, nombre: str) -> dict:
    return next(v for v in lote["vehiculos"] if v["nombre"].startswith(nombre))


def _paradas(lote: dict, nombre: str) -> list[str]:
    return [p["nombre"] for p in _vehiculo(lote, nombre)["paradas"]]


def _para_guardar(lote: dict) -> dict:
    """La vista hidratada en el formato que espera `distribucion/`."""
    return {
        "vehiculos": [
            {
                "clave": v["clave"],
                "furgon": v["furgon"]["id"],
                "nombre": v["nombre"],
                "color": v["color"],
                "inicio": v["inicio"],
                "fin": v["fin"],
                "paradas": [
                    {
                        "cliente": p["cliente"],
                        "pedidos": [d["id"] for d in p["pedidos"]],
                        "canastillas": p["canastillas_calculadas"],
                        "manual": p["manual"],
                        "nota": p["nota"],
                        "extra": p["extra"],
                        "nombre": p["nombre"],
                        "direccion": p["direccion"],
                    }
                    for p in v["paradas"]
                ],
            }
            for v in lote["vehiculos"]
            if v["furgon"]
        ]
    }


# ==========================================================================
# 1-2. Elegibles y reserva
# ==========================================================================
def test_los_elegibles_se_agrupan_por_fecha_de_entrega(api_owner, programacion, canastilla, clientes, regla):
    _pedido(clientes["La 68"], regla, "40")
    _pedido(clientes["Don Luis"], regla, "10")
    _pedido(clientes["Menta"], regla, "10", fecha=LUNES + datetime.timedelta(days=1))

    datos = _elegibles(api_owner)
    assert [(f["fecha"], f["pedidos"]) for f in datos["fechas"]] == [
        (LUNES.isoformat(), 2), ((LUNES + datetime.timedelta(days=1)).isoformat(), 1)
    ]
    # Con fecha vienen los pedidos del día, con sus canastillas estimadas.
    delDia = _elegibles(api_owner, LUNES)
    assert delDia["resumen"] == {"pedidos": 2, "clientes": 2, "canastillas": 5}
    assert {p["cliente_nombre"] for p in delDia["pedidos"]} == {"La 68", "Don Luis"}


def test_un_pedido_sin_fecha_programada_se_entrega_al_dia_siguiente(api_owner, programacion, canastilla, clientes, regla):
    """La misma regla que la factura: sin fecha fijada, el día siguiente al pedido."""
    p = Pedido.objects.create(cliente=clientes["La 68"])
    DetallePedido.objects.create(pedido=p, presentacion=regla, cantidad=Decimal("10"))
    manana = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
    assert [f["fecha"] for f in _elegibles(api_owner)["fechas"]] == [manana]


def test_un_pedido_no_entra_en_dos_lotes(api_owner, programacion, canastilla, clientes, regla):
    p = _pedido(clientes["La 68"], regla, "40")
    primero = _ok(_crear(api_owner, canastilla, [p]), 201)
    assert primero["numero"] == 1

    r = _crear(api_owner, canastilla, [p])
    assert r.status_code == 400
    assert "ya está en el lote #1" in str(r.json())
    # Y ya no aparece como elegible.
    assert _elegibles(api_owner)["fechas"] == []


def test_un_pedido_de_otra_fecha_no_entra_en_el_lote(api_owner, programacion, canastilla, clientes, regla):
    p = _pedido(clientes["La 68"], regla, "40", fecha=LUNES + datetime.timedelta(days=1))
    r = _crear(api_owner, canastilla, [p])
    assert r.status_code == 400
    assert "no se entrega el 23/11/2026" in str(r.json())


def test_crear_un_lote_exige_permiso_de_armar(api_staff, programacion, canastilla, clientes, regla):
    p = _pedido(clientes["La 68"], regla, "40")
    assert _crear(api_staff, canastilla, [p]).status_code == 403


# ==========================================================================
# 3-6. El motor de reparto
# ==========================================================================
def test_el_reparto_respeta_la_ruta_de_cada_cliente(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    pluis = _pedido(clientes["Don Luis"], regla, "20")
    puni = _pedido(clientes["Universidades"], regla, "30")

    lote = _ok(_crear(api_owner, canastilla, [p68, pluis, puni]), 201)
    assert _paradas(lote, "Turbo A") == ["La 68", "Don Luis"]
    assert _paradas(lote, "Turbo B") == ["Universidades"]
    assert lote["sin_asignar"] == []
    # Las paradas salen en el orden de la ruta, no en el de los pedidos.
    assert [p["orden"] for p in _vehiculo(lote, "Turbo A")["paradas"]] == [1, 2]
    # Y cada parada trae sus productos consolidados y su peso.
    parada = _vehiculo(lote, "Turbo A")["paradas"][0]
    assert parada["canastillas_calculadas"] == 4 and parada["peso_kg"] == 60.0
    assert [(pr["producto"], pr["cantidad"]) for pr in parada["productos"]] == [("Producto de prueba", "40")]


def test_dos_pedidos_del_mismo_cliente_son_una_sola_parada(api_owner, programacion, canastilla, clientes, regla):
    a = _pedido(clientes["Don Luis"], regla, "35")
    b = _pedido(clientes["Don Luis"], regla, "12")
    lote = _ok(_crear(api_owner, canastilla, [a, b]), 201)
    parada = _vehiculo(lote, "Turbo A")["paradas"][0]
    assert [p["id"] for p in parada["pedidos"]] == [a.id, b.id]
    # 47 unidades = 4,7 canastillas → 5, sin perder qué pedido aportó qué.
    assert parada["canastillas_calculadas"] == 5
    assert [x["cantidad"] for x in parada["productos"][0]["pedidos"]] == ["35", "12"]


def test_un_cliente_de_dos_rutas_va_al_vehiculo_mas_holgado(api_owner, programacion, canastilla, clientes, regla):
    """«Menta» está en las dos rutas: decide la carga, no el orden de las rutas."""
    _pedido(clientes["La 68"], regla, "300")      # 30 canastillas a Turbo A
    _pedido(clientes["Universidades"], regla, "10")  # 1 canastilla a Turbo B
    menta = _pedido(clientes["Menta"], regla, "20")

    lote = _ok(_crear(api_owner, canastilla, [p for p in Pedido.objects.all()]), 201)
    assert "Menta" in _paradas(lote, "Turbo B")
    assert "Menta" not in _paradas(lote, "Turbo A")

    # Al contrario: si la carga está en B, Menta se va con A.
    LoteDespacho.objects.all().delete()
    Pedido.objects.exclude(id=menta.id).delete()
    _pedido(clientes["Universidades"], regla, "300")
    _pedido(clientes["La 68"], regla, "10")
    lote = _ok(_crear(api_owner, canastilla, [p for p in Pedido.objects.all()]), 201)
    assert "Menta" in _paradas(lote, "Turbo A")


def test_un_cliente_fuera_de_ruta_entra_donde_cabe_y_queda_marcado(api_owner, programacion, canastilla, clientes, regla):
    _pedido(clientes["La 68"], regla, "200")   # 20 canastillas a Turbo A
    fuera = _pedido(clientes["Sin Ruta"], regla, "20")

    lote = _ok(_crear(api_owner, canastilla, [p for p in Pedido.objects.all()]), 201)
    assert lote["sin_asignar"] == []
    # Entra en el que va más holgado (Turbo B, vacío) y se avisa por qué.
    parada = next(p for v in lote["vehiculos"] for p in v["paradas"] if p["nombre"] == "Sin Ruta")
    assert parada["fuera_de_ruta"] is True
    assert "Sin Ruta" in _paradas(lote, "Turbo B")
    assert any("no está en ninguna ruta" in n for n in lote["notas_motor"])
    assert any("fuera de su ruta" in a for a in lote["resumen"]["advertencias"])
    assert fuera.id in [p["id"] for p in parada["pedidos"]]


def test_el_reparto_equilibra_cuando_un_vehiculo_se_pasa_de_capacidad(api_owner, programacion, canastilla, clientes, regla):
    """
    Cuatro clientes de Turbo A con carga grande: lo que no cabe se pasa a
    Turbo B si allí también hay ruta («Menta»), y si no, queda avisado.
    """
    for nombre in ("La 68", "Don Luis", "La Cima"):
        _pedido(clientes[nombre], regla, "900")
    _pedido(clientes["Menta"], regla, "300")

    lote = _ok(_crear(api_owner, canastilla, [p for p in Pedido.objects.all()]), 201)
    capacidad = _vehiculo(lote, "Turbo A")["capacidad"]["canastillas"]
    assert _vehiculo(lote, "Turbo A")["metricas"]["canastillas"] <= capacidad or any(
        "capacidad" in n for n in lote["notas_motor"]
    )
    # «Menta», que las dos rutas visitan, es la que se mueve.
    assert "Menta" in _paradas(lote, "Turbo B")
    assert any("quedaba por encima de su capacidad" in n for n in lote["notas_motor"])


def test_sin_rutas_ese_dia_nada_se_asigna_y_se_dice_por_que(api_owner, con_plano, canastilla, clientes, regla):
    p = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p]), 201)
    assert lote["vehiculos"] == []
    assert [d["id"] for d in lote["sin_asignar"]] == [p.id]
    assert any("Ninguna ruta programada" in n or "ninguna ruta" in n for n in lote["notas_motor"])
    assert lote["resumen"]["puede_confirmar"] is False


# ==========================================================================
# 7-8. Correcciones manuales
# ==========================================================================
def test_mover_un_pedido_de_vehiculo_queda_en_la_bitacora(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    puni = _pedido(clientes["Universidades"], regla, "30")
    lote = _ok(_crear(api_owner, canastilla, [p68, puni]), 201)

    cuerpo = _para_guardar(lote)
    a = next(v for v in cuerpo["vehiculos"] if v["nombre"].startswith("Turbo A"))
    b = next(v for v in cuerpo["vehiculos"] if v["nombre"].startswith("Turbo B"))
    b["paradas"].append(a["paradas"].pop(0))  # La 68 se va con Turbo B

    lote = _ok(api_owner.put(f"{LOTES}{lote['id']}/distribucion/", cuerpo, format="json"))
    assert _paradas(lote, "Turbo A") == []
    assert set(_paradas(lote, "Turbo B")) == {"La 68", "Universidades"}
    ajustes = [e for e in lote["eventos"] if e["tipo"] == "AJUSTE"]
    assert len(ajustes) == 1
    assert f"#{p68.id} pasó de Turbo A · lunes a Turbo B · lunes" in ajustes[0]["detalle"]


def test_un_pedido_retirado_del_reparto_queda_sin_asignar(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    cuerpo = _para_guardar(lote)
    for v in cuerpo["vehiculos"]:
        v["paradas"] = []

    lote = _ok(api_owner.put(f"{LOTES}{lote['id']}/distribucion/", cuerpo, format="json"))
    assert [d["id"] for d in lote["sin_asignar"]] == [p68.id]
    assert "Se retiró del reparto" in lote["sin_asignar"][0]["motivo"]


def test_un_pedido_ajeno_al_lote_se_rechaza(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    otro = _pedido(clientes["Don Luis"], regla, "10")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    cuerpo = _para_guardar(lote)
    cuerpo["vehiculos"][0]["paradas"][0]["pedidos"].append(otro.id)

    r = api_owner.put(f"{LOTES}{lote['id']}/distribucion/", cuerpo, format="json")
    assert r.status_code == 400 and f"#{otro.id} no es de este lote" in str(r.json())


def test_el_mismo_pedido_en_dos_paradas_se_rechaza(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    cuerpo = _para_guardar(lote)
    a = cuerpo["vehiculos"][0]
    a["paradas"].append({**a["paradas"][0]})

    r = api_owner.put(f"{LOTES}{lote['id']}/distribucion/", cuerpo, format="json")
    assert r.status_code == 400 and "está en dos paradas" in str(r.json())


def test_el_punto_inicial_y_final_se_guardan_y_llegan_al_despacho(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    cuerpo = _para_guardar(lote)
    a = next(v for v in cuerpo["vehiculos"] if v["nombre"].startswith("Turbo A"))
    a["inicio"] = {"nombre": "Bodega norte", "direccion": "Calle 80"}
    a["fin"] = {"nombre": "Bodega norte", "direccion": "Calle 80"}

    lote = _ok(api_owner.put(f"{LOTES}{lote['id']}/distribucion/", cuerpo, format="json"))
    assert _vehiculo(lote, "Turbo A")["inicio"]["nombre"] == "Bodega norte"
    assert any("punto inicial o final" in e["detalle"] for e in lote["eventos"])

    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    plano = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    assert plano.datos_operativos["recorrido"]["inicio"]["direccion"] == "Calle 80"


def test_una_entrega_extraordinaria_llega_al_plano_de_carga(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    cuerpo = _para_guardar(lote)
    a = next(v for v in cuerpo["vehiculos"] if v["nombre"].startswith("Turbo A"))
    a["paradas"].append({
        "extra": True, "pedidos": [], "cliente": None, "nombre": "Recoger canastillas en Menta",
        "direccion": "Calle Menta", "nota": "traer 10 vacías", "canastillas": 2,
    })

    lote = _ok(api_owner.put(f"{LOTES}{lote['id']}/distribucion/", cuerpo, format="json"))
    extra = _vehiculo(lote, "Turbo A")["paradas"][-1]
    assert extra["extra"] is True and extra["canastillas_calculadas"] == 2
    assert lote["resumen"]["paradas_extra"] == 1

    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    plano = PlanoCarga.objects.get(ruta_clave=f"r{programacion['a']['id']}")
    assert [(g["nombre"], g["cantidad"]) for g in plano.grupos] == [
        ("La 68", 4), ("Recoger canastillas en Menta", 2)
    ]
    # La parada extraordinaria no tiene pedidos, pero sí sitio en el furgón.
    assert len(plano.posiciones) == 6
    assert plano.datos_operativos["paradas"][1]["extra"] is True


def test_agregar_y_quitar_pedidos_del_lote(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    nuevo = _pedido(clientes["Don Luis"], regla, "10")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/pedidos/", {"agregar": [nuevo.id]}, format="json"))
    assert [d["id"] for d in lote["sin_asignar"]] == [nuevo.id]
    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/redistribuir/", format="json"))
    assert set(_paradas(lote, "Turbo A")) == {"La 68", "Don Luis"}

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/pedidos/", {"quitar": [p68.id]}, format="json"))
    assert _paradas(lote, "Turbo A") == ["Don Luis"]
    # El pedido retirado vuelve a ser elegible.
    assert [p["id"] for p in _elegibles(api_owner, LUNES)["pedidos"]] == [p68.id]


# ==========================================================================
# 9-11. Generar, confirmar, estados
# ==========================================================================
def test_generar_crea_un_despacho_por_vehiculo_atado_al_lote(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    puni = _pedido(clientes["Universidades"], regla, "30")
    lote = _ok(_crear(api_owner, canastilla, [p68, puni]), 201)
    assert lote["estado"] == "PREPARACION"

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    assert lote["estado"] == "PREPARADO"
    assert len(lote["despachos"]) == 2
    planos = PlanoCarga.objects.filter(lote_id=lote["id"])
    assert planos.count() == 2 and all(p.estado == "BORRADOR" for p in planos)
    assert all(v["despacho"]["id"] for v in lote["vehiculos"] if v["paradas"])
    assert any(e["tipo"] == "GENERADO" for e in lote["eventos"])


def test_el_estado_logistico_del_pedido_avanza_con_el_lote(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")

    def estado_de(pedido):
        r = api_owner.get("/api/orders/", {"page_size": 50})
        assert r.status_code == 200, r.json()
        filas = r.json()["results"] if isinstance(r.json(), dict) else r.json()
        return next(f["logistica"]["estado"] for f in filas if f["id"] == pedido.id)

    assert estado_de(p68) == "PENDIENTE_PLANIFICACION"
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    assert estado_de(p68) == "EN_LOTE"
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    assert estado_de(p68) == "PREPARADO"
    _ok(api_owner.post(f"{LOTES}{lote['id']}/confirmar/", format="json"))
    assert estado_de(p68) == "CONFIRMADO"
    _ok(api_owner.post(f"{LOTES}{lote['id']}/estado/", {"estado": "EN_RUTA"}, format="json"))
    assert estado_de(p68) == "EN_RUTA"
    _ok(api_owner.post(f"{LOTES}{lote['id']}/estado/", {"estado": "ENTREGADO"}, format="json"))
    assert estado_de(p68) == "ENTREGADO"
    p68.refresh_from_db()
    assert p68.estado == "ENTREGADO"


def test_no_se_confirma_sin_los_despachos_generados(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    resumen = _ok(api_owner.get(f"{LOTES}{lote['id']}/resumen/"))
    assert resumen["puede_confirmar"] is False
    assert any("todavía no tiene plano de carga" in a for a in resumen["advertencias"])

    r = api_owner.post(f"{LOTES}{lote['id']}/confirmar/", format="json")
    assert r.status_code == 400 and "antes de confirmar" in str(r.json())


def test_confirmar_congela_el_resumen_y_los_datos_operativos(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/confirmar/", format="json"))
    assert lote["estado"] == "CONFIRMADO" and lote["abierto"] is False
    guardado = LoteDespacho.objects.get(pk=lote["id"])
    assert guardado.resumen["pedidos_asignados"] == 1 and guardado.confirmado_en is not None
    plano = PlanoCarga.objects.get(lote=guardado)
    assert plano.estado == "CONFIRMADO"
    congelado = plano.datos_operativos["paradas"][0]["nombre"]

    # Renombrar al cliente no reescribe el despacho histórico.
    clientes["La 68"].nombre_cliente = "La 68 (sede nueva)"
    clientes["La 68"].save(update_fields=["nombre_cliente"])
    plano.refresh_from_db()
    assert plano.datos_operativos["paradas"][0]["nombre"] == congelado == "La 68"

    # Y el reparto ya no se toca sin reabrir.
    r = api_owner.put(f"{LOTES}{lote['id']}/distribucion/", _para_guardar(lote), format="json")
    assert r.status_code == 400 and "reábrelo" in str(r.json())


def test_reabrir_un_lote_vuelve_sus_despachos_a_borrador(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/confirmar/", format="json"))

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/estado/", {"estado": "PREPARADO"}, format="json"))
    assert lote["estado"] == "PREPARADO" and lote["abierto"] is True
    assert PlanoCarga.objects.get(lote_id=lote["id"]).estado == "BORRADOR"


def test_un_estado_imposible_se_rechaza(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    r = api_owner.post(f"{LOTES}{lote['id']}/estado/", {"estado": "ENTREGADO"}, format="json")
    assert r.status_code == 400 and "no puede pasar" in str(r.json())


def test_anular_devuelve_los_pedidos_a_pendientes(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/anular/", {"motivo": "se corrió el despacho"}, format="json"))
    assert lote["estado"] == "ANULADO"
    assert not PlanoCarga.objects.filter(lote_id=lote["id"]).exists()
    assert [p["id"] for p in _elegibles(api_owner, LUNES)["pedidos"]] == [p68.id]
    # La bitácora se conserva aunque el lote se descarte.
    assert EventoLote.objects.filter(lote_id=lote["id"], tipo="ANULADO").exists()
    # Y el pedido se puede meter en un lote nuevo.
    assert _crear(api_owner, canastilla, [p68]).status_code == 201


def test_un_lote_confirmado_no_se_anula_sin_reabrir(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/confirmar/", format="json"))
    r = api_owner.post(f"{LOTES}{lote['id']}/anular/", format="json")
    assert r.status_code == 400 and "reábrelo" in str(r.json())


def test_el_listado_resume_cada_lote(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68], nombre="Despacho del martes"), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)

    filas = _ok(api_owner.get(LOTES))
    assert len(filas) == 1
    assert filas[0]["numero"] == 1
    assert filas[0]["nombre"] == "Despacho del martes"
    assert filas[0]["pedidos"] == 1 and filas[0]["vehiculos"] == 1 and filas[0]["despachos"] == 1
    assert filas[0]["estado_etiqueta"] == "Despachos preparados"
    assert _ok(api_owner.get(LOTES, {"fecha": "2026-01-01"})) == []
    assert len(_ok(api_owner.get(LOTES, {"estado": "PREPARADO"}))) == 1
    assert _ok(api_owner.get(LOTES, {"estado": "CONFIRMADO"})) == []


# ==========================================================================
# 12. Documentos
# ==========================================================================
@pytest.mark.parametrize("doc", ["planos", "productos", "facturas", "todo"])
def test_la_documentacion_del_lote_sale_en_pdf(api_owner, programacion, canastilla, clientes, regla, doc):
    p68 = _pedido(clientes["La 68"], regla, "40")
    puni = _pedido(clientes["Universidades"], regla, "30")
    lote = _ok(_crear(api_owner, canastilla, [p68, puni]), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)

    r = api_owner.get(f"{LOTES}{lote['id']}/pdf/", {"doc": doc})
    assert r.status_code == 200, r.content[:400]
    assert r["Content-Type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    assert EventoLote.objects.filter(lote_id=lote["id"], tipo="DOCUMENTO").exists()


def test_la_relacion_de_productos_suma_el_total_del_lote(api_owner, programacion, canastilla, clientes, regla):
    _pedido(clientes["La 68"], regla, "40")
    _pedido(clientes["Universidades"], regla, "30")
    lote = _ok(_crear(api_owner, canastilla, [p for p in Pedido.objects.all()]), 201)

    r = api_owner.get(f"{LOTES}{lote['id']}/pdf/", {"doc": "productos", "formato": "html"})
    assert r.status_code == 200
    html = r.content.decode()
    assert "Total del lote (alistamiento en bodega)" in html
    assert "70" in html  # 40 + 30 unidades, en su unidad original
    assert "Turbo A · lunes" in html and "Turbo B · lunes" in html


def test_sin_planos_generados_no_hay_documento_de_planos(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)
    r = api_owner.get(f"{LOTES}{lote['id']}/pdf/", {"doc": "planos"})
    assert r.status_code == 400 and "genera los despachos" in str(r.json())


# ==========================================================================
# Un pedido reservado en un lote no se despacha por otro camino
# ==========================================================================
def test_el_centro_del_dia_no_reparte_un_pedido_reservado_en_un_lote(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    suelto = _pedido(clientes["Don Luis"], regla, "20")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)

    dia = _ok(api_owner.get(f"{BASE}planificacion/dia/", {"fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id}))
    reservado = next(d for d in dia["sin_asignar"] if d["id"] == p68.id)
    assert f"reservado en el lote de despacho #{lote['numero']}" in reservado["motivo"]
    # El que no está en el lote sigue repartiéndose con normalidad.
    asignados = [d["id"] for v in dia["vehiculos"] for par in v["paradas"] for d in par["pedidos"]]
    assert asignados == [suelto.id]


def test_generar_desde_el_centro_rechaza_un_pedido_de_otro_lote(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)

    r = api_owner.post(f"{BASE}planificacion/generar/", {
        "fecha": LUNES.isoformat(), "tipo_canastilla": canastilla.id,
        "vehiculos": [{
            "clave": f"r{programacion['a']['id']}", "furgon": programacion["a"]["furgon"], "nombre": "Turbo A",
            "paradas": [{"cliente": clientes["La 68"].id, "pedidos": [p68.id], "canastillas": 4}],
        }],
    }, format="json")
    assert r.status_code == 400
    assert f"reservado en el lote de despacho #{lote['numero']}" in str(r.json())


def test_un_despacho_a_mano_no_toma_un_pedido_de_un_lote(api_owner, programacion, canastilla, clientes, regla, turbos):
    p68 = _pedido(clientes["La 68"], regla, "40")
    lote = _ok(_crear(api_owner, canastilla, [p68]), 201)

    r = api_owner.post("/api/logistica/planos/", {
        "nombre": "A mano", "fecha": LUNES.isoformat(), "furgon": turbos[0].id, "tipo_canastilla": canastilla.id,
        "grupos": [{"id": "g1", "nombre": "La 68", "cantidad": 4, "orden": 1, "color": "#16a34a"}],
        "posiciones": [], "bloqueos": [], "notas": "",
        "pedidos": [{"pedido": p68.id, "grupo": "g1", "canastillas": 4}],
    }, format="json")
    assert r.status_code == 400
    assert f"reservado en el lote de despacho #{lote['numero']}" in str(r.json())


def test_quitar_un_pedido_ya_generado_retira_su_parada_del_plano(api_owner, programacion, canastilla, clientes, regla):
    p68 = _pedido(clientes["La 68"], regla, "40")
    pluis = _pedido(clientes["Don Luis"], regla, "20")
    lote = _ok(_crear(api_owner, canastilla, [p68, pluis]), 201)
    _ok(api_owner.post(f"{LOTES}{lote['id']}/generar/", format="json"), 201)
    plano = PlanoCarga.objects.get(lote_id=lote["id"])
    assert len(plano.grupos) == 2

    lote = _ok(api_owner.post(f"{LOTES}{lote['id']}/pedidos/", {"quitar": [p68.id]}, format="json"))
    plano.refresh_from_db()
    assert [g["nombre"] for g in plano.grupos] == ["Don Luis"]
    assert all(p["grupo"] == f"c{clientes['Don Luis'].id}" for p in plano.posiciones)
    assert _paradas(lote, "Turbo A") == ["Don Luis"]
