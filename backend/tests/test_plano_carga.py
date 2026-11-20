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
    pos = [{"grupo": "g1", "pila": 30, "nivel": n} for n in range(3)]
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
        [{"grupo": "g1", "pila": 35, "nivel": 0}],  # fuera del furgón (hay 35 pilas: 0–34)
        [{"grupo": "g1", "pila": 0, "nivel": 0}] * 2,  # mismo lugar
        [{"grupo": "g1", "pila": 0, "nivel": 1}],  # flotando
        [{"grupo": "otro", "pila": 0, "nivel": 0}],  # grupo inexistente
        [{"grupo": "g1", "pila": c, "nivel": 0} for c in range(4)],  # más que su cantidad
    ],
)
def test_rechaza_acomodos_imposibles(api_owner, furgon, canastilla, posiciones):
    r = api_owner.post(URL, _plano(furgon, canastilla, posiciones), format="json")
    assert r.status_code == 400, r.json()


def test_editar_el_furgon_no_deforma_un_plano_confirmado(api_owner, furgon, canastilla):
    pos = [{"grupo": "g1", "pila": 34, "nivel": n} for n in range(3)]
    plano = api_owner.post(URL, _plano(furgon, canastilla, pos), format="json").json()
    assert api_owner.post(f"{URL}{plano['id']}/confirmar/").status_code == 200

    # Ahora solo caben 4 filas: la fila 7 ya no existiría.
    r = api_owner.patch(f"/api/logistica/furgones/{furgon.id}/", {"largo_cm": 240}, format="json")
    assert r.status_code == 200, r.json()
    assert api_owner.get(f"{URL}{plano['id']}/").json()["medidas"]["filas"] == 7


def test_editar_el_furgon_actualiza_los_borradores_al_instante(api_owner, furgon, canastilla):
    # Una canastilla en la fila 1 (sigue existiendo) y dos en la fila 7 (desaparece).
    pos = [{"grupo": "g1", "pila": 0, "nivel": 0}, {"grupo": "g1", "pila": 34, "nivel": 0}, {"grupo": "g1", "pila": 34, "nivel": 1}]
    plano = api_owner.post(URL, _plano(furgon, canastilla, pos), format="json").json()

    r = api_owner.patch(f"/api/logistica/furgones/{furgon.id}/", {"largo_cm": 240}, format="json")
    assert r.status_code == 200, r.json()
    datos = api_owner.get(f"{URL}{plano['id']}/").json()
    assert datos["medidas"]["filas"] == 4  # el esquema nuevo, sin recargar nada
    assert len(datos["posiciones"]) == 3  # nada se pierde: lo que no existe se reubica
    assert {"grupo": "g1", "pila": 0, "nivel": 0} in [{k: p[k] for k in ("grupo", "pila", "nivel")} for p in datos["posiciones"]]
    assert all(p["pila"] < len(datos["medidas"]["pilas"]) for p in datos["posiciones"])
    assert not datos["revision"]["errores"]


def test_editar_la_canastilla_actualiza_los_borradores(api_owner, furgon, canastilla):
    pos = [{"grupo": "g1", "pila": 0, "nivel": n} for n in range(3)]
    plano = api_owner.post(URL, _plano(furgon, canastilla, pos), format="json").json()
    # Solo se pueden apilar 2: la tercera pasa a otra posición.
    r = api_owner.patch(f"/api/logistica/canastillas/{canastilla.id}/", {"max_apiladas": 2}, format="json")
    assert r.status_code == 200, r.json()
    datos = api_owner.get(f"{URL}{plano['id']}/").json()
    assert datos["medidas"]["niveles"] == 2
    assert len(datos["posiciones"]) == 3 and max(p["nivel"] for p in datos["posiciones"]) == 1


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

    pos = [{"grupo": "g1", "pila": 30, "nivel": n} for n in range(2)]
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
    pos = [{"grupo": "g1", "pila": 30, "nivel": n} for n in range(2)]
    grupos = [{"id": "g1", "nombre": "D", "cantidad": 2, "orden": 1, "color": "#16a34a"}]
    plano = api_owner.post(URL, _despacho(furgon, canastilla, [], pos, grupos), format="json").json()
    r = api_owner.post(f"{URL}{plano['id']}/confirmar/")
    assert r.status_code == 400 and "supera la carga útil" in str(r.json())


def test_cada_canastilla_guarda_coordenadas_y_orientacion(api_owner, furgon, canastilla):
    grupos = [{"id": "g1", "nombre": "D", "cantidad": 1, "orden": 1, "color": "#16a34a"}]
    pos = [{"grupo": "g1", "pila": 7, "nivel": 0}]
    plano = api_owner.post(URL, _despacho(furgon, canastilla, [], pos, grupos), format="json").json()
    # Canastilla 60 × 40 × 25 sin girar: centro en (1,5·60, 2,5·40, 0,5·25) cm.
    assert plano["posiciones"][0] == {
        "grupo": "g1", "pila": 7, "nivel": 0, "x_cm": 90.0, "y_cm": 100.0, "z_cm": 12.5, "rotacion": 0
    }


def test_avisa_si_el_orden_de_entrega_obliga_a_mover_carga(api_owner, furgon, canastilla):
    grupos = [
        {"id": "pri", "nombre": "Primero", "cantidad": 1, "orden": 1, "color": "#16a34a"},
        {"id": "ult", "nombre": "Último", "cantidad": 1, "orden": 2, "color": "#2563eb"},
    ]
    # El último queda junto a la puerta (fila 6) y el primero al fondo: mal.
    pos = [{"grupo": "pri", "pila": 0, "nivel": 0}, {"grupo": "ult", "pila": 30, "nivel": 0}]
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


# ==========================================================================
# Esquema «fila transversal + dos laterales con pasillo» (La Gran Cosecha)
# Furgón 553 × 230 × 220 cm, canastilla 60 × 40 × 25 cm (máx. 6 apiladas).
# ==========================================================================
from apps.logistica.esquemas import calcular_esquema  # noqa: E402

ESQUEMA_LGC = {"tipo": "frente_columnas", "izquierda": 5, "derecha": 4, "niveles": 5, "pasillo_min_cm": 40}


@pytest.fixture
def hino(con_plano):
    return Furgon.objects.create(
        nombre="Hino 500", placa="LGL636", largo_cm=553, ancho_cm=230, alto_cm=220, esquema_carga=ESQUEMA_LGC
    )


def _zona(e, z):
    return [p for p in e["pilas"] if p["zona"] == z]


def test_laterales_atravesados_y_fila_delantera_al_contrario(hino, canastilla):
    """Por defecto, como carga La Gran Cosecha: laterales con la canastilla atravesada."""
    e = calcular_esquema(hino, canastilla)
    assert e["errores"] == []
    # B. Laterales atravesados (rot 90): 60 cm de ancho cada uno, paso de 40 cm.
    izq, der = _zona(e, "izquierda"), _zona(e, "derecha")
    assert len(izq) == 5 and len(der) == 4 and {p["rot"] for p in izq + der} == {90}
    assert {p["y"] for p in izq} == {30} and {p["y"] for p in der} == {200}
    # A. La fila delantera va al contrario (longitudinal) y se CALCULA: 230 // 40 = 5.
    frente = _zona(e, "frente")
    assert len(frente) == 5 and {p["rot"] for p in frente} == {0} and {p["x"] for p in frente} == {30}
    # El pasillo empieza DESPUÉS de la fila delantera (60 cm de fondo) y queda de 110 cm.
    assert izq[0]["x"] == 80 and e["frente_fondo_cm"] == 60
    assert e["pasillo_cm"] == 110 and e["niveles"] == 5 and e["capacidad"] == 14 * 5
    assert [p["etiqueta"] for p in frente][:2] == ["T1", "T2"] and izq[-1]["etiqueta"] == "I5"


def test_laterales_longitudinales_si_se_configura(hino, canastilla):
    hino.esquema_carga = {**ESQUEMA_LGC, "orientacion_laterales": "longitudinal"}
    e = calcular_esquema(hino, canastilla)
    assert {p["rot"] for p in _zona(e, "izquierda")} == {0} and {p["rot"] for p in _zona(e, "frente")} == {90}
    assert len(_zona(e, "frente")) == 3 and e["pasillo_cm"] == 150


def test_sin_cantidades_llena_lo_que_cabe(hino, canastilla):
    hino.esquema_carga = {"tipo": "frente_columnas"}
    e = calcular_esquema(hino, canastilla)
    assert len(_zona(e, "izquierda")) == (553 - 60) // 40 == 12


@pytest.mark.parametrize(
    "cambio, texto",
    [
        ({"frente": 6}, "caben 5 canastillas, no 6"),
        ({"izquierda": 20}, "caben 12 canastillas a lo largo, no 20"),
        ({"pasillo_min_cm": 120}, "el mínimo es 120 cm"),
    ],
)
def test_lo_que_no_cabe_se_reporta_y_no_se_inventa(hino, canastilla, cambio, texto):
    hino.esquema_carga = {**ESQUEMA_LGC, **cambio}
    e = calcular_esquema(hino, canastilla)
    assert any(texto in err for err in e["errores"]), e["errores"]
    # Nunca hay pilas superpuestas ni fuera del furgón.
    assert not any("superponen" in err or "se sale" in err for err in e["errores"])


def test_un_esquema_imposible_no_deja_guardar(api_owner, hino, canastilla):
    hino.esquema_carga = {**ESQUEMA_LGC, "pasillo_min_cm": 120}
    hino.save()
    r = api_owner.post(URL, _despacho(hino, canastilla, []), format="json")
    assert r.status_code == 400 and "pasillo" in str(r.json())


def test_con_pasillo_solo_estorba_lo_que_queda_encima(api_owner, hino, canastilla):
    grupos = [
        {"id": "pri", "nombre": "Primero", "cantidad": 2, "orden": 1, "color": "#16a34a"},
        {"id": "ult", "nombre": "Último", "cantidad": 2, "orden": 2, "color": "#2563eb"},
    ]
    # Pilas: 0–4 fila delantera, 5–9 lateral izquierdo, 10–13 lateral derecho.
    pos = [
        {"grupo": "pri", "pila": 5, "nivel": 0},
        {"grupo": "ult", "pila": 9, "nivel": 0},   # más cerca de la puerta, pero por el pasillo se llega igual
        {"grupo": "pri", "pila": 6, "nivel": 0},
        {"grupo": "ult", "pila": 6, "nivel": 1},   # encima de una del primero: esto sí estorba
    ]
    plano = api_owner.post(URL, _despacho(hino, canastilla, [], pos, grupos), format="json").json()
    avisos = [a for a in plano["revision"]["advertencias"] if "delante" in a]
    assert len(avisos) == 1 and avisos[0].startswith("1 canastilla(s) de «Último»")


def test_bloqueos_se_validan(api_owner, hino, canastilla):
    r = api_owner.post(URL, {**_despacho(hino, canastilla, []), "bloqueos": [2, 2, 5]}, format="json")
    assert r.status_code == 201 and r.json()["bloqueos"] == [2, 5]
    r = api_owner.post(URL, {**_despacho(hino, canastilla, []), "bloqueos": [99]}, format="json")
    assert r.status_code == 400


def test_el_esquema_del_vehiculo_se_valida(api_owner, con_plano):
    datos = {"nombre": "X", "largo_cm": 553, "ancho_cm": 230, "alto_cm": 220}
    r = api_owner.post("/api/logistica/furgones/", {**datos, "esquema_carga": {"tipo": "piramide"}}, format="json")
    assert r.status_code == 400
    r = api_owner.post("/api/logistica/furgones/", {**datos, "esquema_carga": ESQUEMA_LGC}, format="json")
    assert r.status_code == 201
    assert r.json()["esquema_carga"]["izquierda"] == 5
    assert r.json()["esquema_carga"]["orientacion_laterales"] == "transversal"


def test_vista_previa_del_esquema_sin_guardar(api_owner, canastilla, con_plano):
    datos = {"largo_cm": 553, "ancho_cm": 230, "alto_cm": 220, "esquema_carga": ESQUEMA_LGC, "tipo_canastilla": canastilla.id}
    r = api_owner.post("/api/logistica/furgones/vista-previa/", datos, format="json")
    assert r.status_code == 200, r.json()
    assert r.json()["capacidad"] == 70 and not Furgon.objects.exists()


def test_el_pdf_dibuja_la_misma_distribucion(api_owner, hino, canastilla):
    grupos = [{"id": "g1", "nombre": "Restaurante La Huerta", "cantidad": 2, "orden": 1, "color": "#16a34a", "numero": 7}]
    pos = [{"grupo": "g1", "pila": 0, "nivel": 0}, {"grupo": "g1", "pila": 0, "nivel": 1}]
    plano = api_owner.post(URL, _despacho(hino, canastilla, [], pos, grupos), format="json").json()
    r = api_owner.get(f"{URL}{plano['id']}/pdf/", {"formato": "html"})
    assert r.status_code == 200
    html = r.content.decode()
    for texto in ("PASILLO", "CABINA", "PUERTAS", "Restaurante La Huerta", "LGL636", "×2", "Fila delantera (2)", "GUÍA DE CARGA Y ENTREGA", "Entregado"):
        assert texto in html, texto
    # Sin códigos técnicos de posición: el conductor ve números de parada y zonas.
    assert ">T1<" not in html


def test_los_despachos_viejos_de_rejilla_se_convierten_a_pilas(furgon, canastilla):
    """La migración 0008 conserva cada canastilla en su lugar."""
    import importlib

    from django.apps import apps as registro

    from apps.logistica.models import PlanoCarga

    migracion = importlib.import_module("apps.logistica.migrations.0008_planos_a_pilas")
    viejo = {
        "furgon": {"largo": 420, "ancho": 200, "alto": 200},
        "canastilla": {"largo": 60, "ancho": 40, "alto": 25},
        "girada": False, "filas": 7, "columnas": 5, "niveles": 6, "capacidad": 210,
    }
    plano = PlanoCarga.objects.create(
        nombre="Viejo", fecha="2026-11-19", furgon=furgon, tipo_canastilla=canastilla, medidas=viejo,
        grupos=[{"id": "g1", "nombre": "D", "cantidad": 1, "orden": 1, "color": "#16a34a"}],
        posiciones=[{"grupo": "g1", "fila": 1, "columna": 2, "nivel": 0}],
    )
    migracion.convertir(registro, None)
    plano.refresh_from_db()
    assert len(plano.medidas["pilas"]) == 35
    assert plano.posiciones == [
        {"grupo": "g1", "pila": 7, "nivel": 0, "x_cm": 90.0, "y_cm": 100.0, "z_cm": 12.5, "rotacion": 0}
    ]
