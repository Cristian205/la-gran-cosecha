"""
Plano de carga (apps/logistica).

1. Un módulo no contratado no se usa aunque se conozca la URL.
2. La rejilla elige la orientación de la canastilla que mete más por nivel y
   respeta el máximo de apiladas.
3. Un plano solo se guarda con un acomodo físicamente posible: dentro del
   furgón, sin dos canastillas en el mismo lugar y ninguna flotando.
4. Editar el furgón después no deforma los planos ya guardados.
5. Sin permiso de armar, se puede mirar pero no guardar.
"""
import pytest

from apps.billing.models import Plan, Producto
from apps.business.models import TenantModulo
from apps.logistica.models import Furgon, TipoCanastilla
from apps.logistica.serializers import calcular_rejilla

pytestmark = pytest.mark.django_db

PERMISOS = ["logistica.view_planocarga", "logistica.add_planocarga", "logistica.change_furgon"]
URL = "/api/logistica/planos/"


@pytest.fixture
def con_plano(negocio):
    """Negocio con el módulo contratado y encendido (billing.0014 no lo añade a los planes)."""
    plan = Plan.objects.get(suscripciones__tenant=negocio)
    plan.permisos = [*plan.permisos, *PERMISOS]
    plan.save(update_fields=["permisos"])
    TenantModulo.objects.get_or_create(
        tenant=negocio, modulo=Producto.objects.get(slug="plano-carga"), defaults={"activo": True}
    )
    return negocio


@pytest.fixture
def furgon(con_plano):
    # 420 × 200 × 200 cm por dentro.
    return Furgon.objects.create(nombre="NHR", largo_cm=420, ancho_cm=200, alto_cm=200)


@pytest.fixture
def canastilla(con_plano):
    # 60 × 40 × 25 cm, máximo 6 apiladas.
    return TipoCanastilla.objects.create(nombre="Estándar", largo_cm=60, ancho_cm=40, alto_cm=25, max_apiladas=6)


def _plano(furgon, canastilla, posiciones, cantidad=3):
    return {
        "nombre": "Ruta norte",
        "fecha": "2026-11-19",
        "furgon": furgon.id,
        "tipo_canastilla": canastilla.id,
        "grupos": [{"id": "g1", "nombre": "Restaurante Sabor", "cantidad": cantidad, "orden": 1, "color": "#a3d917"}],
        "posiciones": posiciones,
    }


def test_sin_el_modulo_no_se_usa(api_owner, negocio):
    assert api_owner.get(URL).status_code == 403
    assert api_owner.get("/api/logistica/furgones/").status_code == 403


def test_la_rejilla_elige_la_orientacion_que_mas_mete(furgon, canastilla):
    r = calcular_rejilla(furgon, canastilla)
    # Sin girar: 420//60=7 × 200//40=5 = 35. Girada: 420//40=10 × 200//60=3 = 30.
    assert (r["filas"], r["columnas"], r["girada"]) == (7, 5, False)
    # 200//25 = 8 niveles por altura, pero el máximo de apiladas es 6.
    assert r["niveles"] == 6
    assert r["capacidad"] == 7 * 5 * 6


def test_guarda_un_acomodo_valido(api_owner, furgon, canastilla, usuario_owner):
    pos = [{"grupo": "g1", "fila": 6, "columna": 0, "nivel": n} for n in range(3)]
    r = api_owner.post(URL, _plano(furgon, canastilla, pos), format="json")
    assert r.status_code == 201, r.json()
    datos = r.json()
    assert datos["medidas"]["filas"] == 7 and len(datos["posiciones"]) == 3
    assert datos["creado_por_nombre"] == usuario_owner.nombre_usuario

    lista = api_owner.get(URL).json()
    filas = lista["results"] if isinstance(lista, dict) else lista
    assert filas[0]["total_canastillas"] == 3


@pytest.mark.parametrize(
    "posiciones",
    [
        [{"grupo": "g1", "fila": 7, "columna": 0, "nivel": 0}],  # fuera del furgón
        [{"grupo": "g1", "fila": 0, "columna": 0, "nivel": 0}] * 2,  # mismo lugar
        [{"grupo": "g1", "fila": 0, "columna": 0, "nivel": 1}],  # flotando
        [{"grupo": "otro", "fila": 0, "columna": 0, "nivel": 0}],  # grupo inexistente
        [{"grupo": "g1", "fila": 0, "columna": c, "nivel": 0} for c in range(4)],  # más que su cantidad
    ],
)
def test_rechaza_acomodos_imposibles(api_owner, furgon, canastilla, posiciones):
    r = api_owner.post(URL, _plano(furgon, canastilla, posiciones), format="json")
    assert r.status_code == 400, r.json()


def test_editar_el_furgon_no_deforma_un_plano_guardado(api_owner, furgon, canastilla):
    pos = [{"grupo": "g1", "fila": 6, "columna": 4, "nivel": 0}]
    plano = api_owner.post(URL, _plano(furgon, canastilla, pos), format="json").json()

    furgon.largo_cm = 240  # ahora solo caben 4 filas: la fila 6 ya no existiría
    furgon.save()

    r = api_owner.patch(f"{URL}{plano['id']}/", {"notas": "Cargar primero lo frío"}, format="json")
    assert r.status_code == 200, r.json()
    assert r.json()["medidas"]["filas"] == 7


def test_la_rejilla_se_consulta_antes_de_guardar(api_owner, furgon, canastilla):
    r = api_owner.get(f"{URL}rejilla/", {"furgon": furgon.id, "tipo_canastilla": canastilla.id})
    assert r.status_code == 200 and r.json()["capacidad"] == 210
    assert api_owner.get(f"{URL}rejilla/", {"furgon": 999999, "tipo_canastilla": canastilla.id}).status_code == 400


def test_sin_permiso_de_armar_no_guarda(api_staff, furgon, canastilla, usuario_staff, negocio):
    # El acceso lo da la pertenencia al negocio, no `user_permissions`.
    from apps.tenancy.models import Membership

    Membership.objects.filter(usuario=usuario_staff, tenant=negocio).update(permisos=["logistica.view_planocarga"])
    assert api_staff.get(URL).status_code == 200
    r = api_staff.post(URL, _plano(furgon, canastilla, []), format="json")
    assert r.status_code == 403


# ==========================================================================
# Despachos: pedidos, planificación por fecha, confirmación y duplicado
# ==========================================================================
import datetime

from django.utils import timezone

from apps.orders.models import Pedido


def _pedido(cliente, fecha):
    momento = timezone.make_aware(datetime.datetime.combine(fecha, datetime.time(9, 0)))
    return Pedido.objects.create(cliente=cliente, fecha_programada=momento, direccion_entrega="Cra 1 # 2-3")


MANANA = datetime.date(2026, 11, 20)


def _despacho(furgon, canastilla, pedidos, posiciones=None, grupos=None):
    grupos = grupos or [{"id": "g1", "nombre": "Destino", "cantidad": 1, "orden": 1, "color": "#16a34a"}]
    return {
        "nombre": "Ruta",
        "fecha": MANANA.isoformat(),
        "furgon": furgon.id,
        "tipo_canastilla": canastilla.id,
        "grupos": grupos,
        "pedidos": pedidos,
        "posiciones": posiciones if posiciones is not None else [],
    }


def test_un_pedido_no_va_en_dos_despachos(api_owner, furgon, canastilla, cliente_negocio):
    p = _pedido(cliente_negocio, MANANA)
    r1 = api_owner.post(URL, _despacho(furgon, canastilla, [{"pedido": p.id, "grupo": "g1", "canastillas": 2}]), format="json")
    assert r1.status_code == 201, r1.json()
    # La cantidad del destino es la suma de sus pedidos.
    assert r1.json()["grupos"][0]["cantidad"] == 2
    r2 = api_owner.post(URL, _despacho(furgon, canastilla, [{"pedido": p.id, "grupo": "g1", "canastillas": 1}]), format="json")
    assert r2.status_code == 400 and "ya está en el despacho" in str(r2.json())


def test_la_planificacion_es_por_fecha_de_entrega(api_owner, furgon, canastilla, cliente_negocio):
    a = _pedido(cliente_negocio, MANANA)
    _pedido(cliente_negocio, MANANA + datetime.timedelta(days=1))  # otro día: no aparece
    api_owner.post(URL, _despacho(furgon, canastilla, [{"pedido": a.id, "grupo": "g1", "canastillas": 3}]), format="json")
    b = _pedido(cliente_negocio, MANANA)

    r = api_owner.get(f"{URL}planificacion/", {"fecha": MANANA.isoformat()})
    assert r.status_code == 200, r.json()
    datos = r.json()
    assert {p["id"] for p in datos["pedidos"]} == {a.id, b.id}
    assert datos["resumen"] == {"pedidos": 2, "asignados": 1, "sin_vehiculo": 1, "canastillas": 3, "despachos": 1}


def test_confirmar_exige_todo_ubicado_y_bloquea_cambios(api_owner, furgon, canastilla, cliente_negocio):
    p = _pedido(cliente_negocio, MANANA)
    plano = api_owner.post(
        URL, _despacho(furgon, canastilla, [{"pedido": p.id, "grupo": "g1", "canastillas": 2}]), format="json"
    ).json()
    r = api_owner.post(f"{URL}{plano['id']}/confirmar/")
    assert r.status_code == 400 and "Faltan 2 canastillas" in str(r.json())

    pos = [{"grupo": "g1", "fila": 6, "columna": 0, "nivel": n} for n in range(2)]
    assert api_owner.patch(f"{URL}{plano['id']}/", {"posiciones": pos}, format="json").status_code == 200
    r = api_owner.post(f"{URL}{plano['id']}/confirmar/")
    assert r.status_code == 200, r.json()
    assert r.json()["estado"] == "CONFIRMADO" and r.json()["confirmado_por_nombre"]
    # Sin carga útil ni peso de canastilla, el peso se avisa: no se supone.
    assert any("peso" in a for a in r.json()["revision"]["advertencias"])

    assert api_owner.patch(f"{URL}{plano['id']}/", {"notas": "x"}, format="json").status_code == 400
    assert api_owner.post(f"{URL}{plano['id']}/reabrir/").json()["estado"] == "BORRADOR"


def test_el_peso_se_valida_cuando_se_conoce(api_owner, furgon, canastilla):
    furgon.carga_util_kg = 30
    furgon.save()
    canastilla.peso_lleno_kg = 20
    canastilla.save()
    pos = [{"grupo": "g1", "fila": 6, "columna": 0, "nivel": n} for n in range(2)]
    grupos = [{"id": "g1", "nombre": "D", "cantidad": 2, "orden": 1, "color": "#16a34a"}]
    plano = api_owner.post(URL, _despacho(furgon, canastilla, [], pos, grupos), format="json").json()
    r = api_owner.post(f"{URL}{plano['id']}/confirmar/")
    assert r.status_code == 400 and "supera la carga útil" in str(r.json())


def test_cada_canastilla_guarda_coordenadas_y_orientacion(api_owner, furgon, canastilla):
    grupos = [{"id": "g1", "nombre": "D", "cantidad": 1, "orden": 1, "color": "#16a34a"}]
    pos = [{"grupo": "g1", "fila": 1, "columna": 2, "nivel": 0}]
    plano = api_owner.post(URL, _despacho(furgon, canastilla, [], pos, grupos), format="json").json()
    # Canastilla 60 × 40 × 25 sin girar: centro en (1,5·60, 2,5·40, 0,5·25) cm.
    assert plano["posiciones"][0] | {} == {
        "grupo": "g1", "fila": 1, "columna": 2, "nivel": 0, "x_cm": 90.0, "y_cm": 100.0, "z_cm": 12.5, "rotacion": 0
    }


def test_avisa_si_el_orden_de_entrega_obliga_a_mover_carga(api_owner, furgon, canastilla):
    grupos = [
        {"id": "pri", "nombre": "Primero", "cantidad": 1, "orden": 1, "color": "#16a34a"},
        {"id": "ult", "nombre": "Último", "cantidad": 1, "orden": 2, "color": "#2563eb"},
    ]
    # El último queda junto a la puerta (fila 6) y el primero al fondo: mal.
    pos = [{"grupo": "pri", "fila": 0, "columna": 0, "nivel": 0}, {"grupo": "ult", "fila": 6, "columna": 0, "nivel": 0}]
    plano = api_owner.post(URL, _despacho(furgon, canastilla, [], pos, grupos), format="json").json()
    assert any("«Último»" in a and "delante" in a for a in plano["revision"]["advertencias"])


def test_duplicar_no_copia_los_pedidos(api_owner, furgon, canastilla, cliente_negocio):
    p = _pedido(cliente_negocio, MANANA)
    plano = api_owner.post(
        URL, _despacho(furgon, canastilla, [{"pedido": p.id, "grupo": "g1", "canastillas": 1}]), format="json"
    ).json()
    r = api_owner.post(f"{URL}{plano['id']}/duplicar/", {"fecha": "2026-11-21"}, format="json")
    assert r.status_code == 201, r.json()
    copia = r.json()
    assert copia["fecha"] == "2026-11-21" and copia["pedidos_detalle"] == [] and copia["estado"] == "BORRADOR"
