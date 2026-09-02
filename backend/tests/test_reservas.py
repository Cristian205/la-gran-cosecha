"""
Reservas.

Seis promesas, y la primera no es «guarda reservas» sino algo sobre el resto
del sistema:

1. Que añadir un módulo no obliga a tocar los que ya estaban. Es la promesa que
   la fase 10 dejó escrita en `pos/paneles.py` y que esta fase cobra: reservas
   aporta un panel a la caja sin que `apps.pos` mencione una reserva.
2. Que dos personas no se sientan en la misma mesa a la misma hora.
3. Que mover una reserva pasa por la misma comprobación que crearla — el
   agujero clásico, porque «editar» no suena a «volver a disputar un hueco».
4. Que los estados solo avanzan por su tabla: una cancelada no revive.
5. Que un módulo no contratado no se usa aunque se conozca la URL.
6. Que la agenda de un negocio no se ve desde otro.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.billing.models import Plan, Producto
from apps.business.models import TenantModulo
from apps.pos import paneles
from apps.reservations import operaciones as reservas
from apps.reservations.models import Recurso, Reserva
from apps.tenancy.context import usar_tenant

pytestmark = pytest.mark.django_db

PERMISOS = [
    "reservations.view_reserva",
    "reservations.add_reserva",
    "reservations.change_recurso",
]


@pytest.fixture
def con_reservas(negocio):
    """
    Un negocio con reservas contratadas y encendidas.

    Hay que tocar el plan a mano por lo mismo que con el POS: `billing.0008` NO
    añade el módulo a los planes existentes. Regalárselo a los clientes
    actuales en una migración sería una decisión comercial tomada por descuido.
    """
    plan = Plan.objects.get(suscripciones__tenant=negocio)
    plan.permisos = [*plan.permisos, *PERMISOS]
    plan.save(update_fields=["permisos"])
    TenantModulo.objects.get_or_create(
        tenant=negocio,
        modulo=Producto.objects.get(slug="reservas"),
        defaults={"activo": True},
    )
    return negocio


@pytest.fixture
def mesa(con_reservas):
    return Recurso.objects.create(
        codigo="mesa-1", nombre="Mesa 1", zona="Salón", capacidad=4
    )


@pytest.fixture
def esta_noche():
    """Las 20:00 de mañana. Mañana, para no chocar con la antelación ni con el
    reloj de la suite si se ejecuta a las 23:59."""
    manana = timezone.now() + timedelta(days=1)
    return manana.replace(hour=20, minute=0, second=0, microsecond=0)


# ==========================================================================
# 1. AÑADIR UN MÓDULO NO OBLIGA A TOCAR LOS QUE YA ESTABAN
# ==========================================================================
def test_el_pos_no_sabe_que_existen_las_reservas():
    """
    El guardia de toda la fase, y el único que no se puede falsear.

    La promesa de `pos/paneles.py` era literal: «aportar las mesas serán tres
    líneas aquí y un componente allá — ni una sola condición nueva dentro de la
    caja». Un `if modulo == "reservas"` escondido en el POS la rompería sin que
    ningún otro test se enterara: todo seguiría funcionando, y el cuarto módulo
    volvería a necesitar una rama.
    """
    from pathlib import Path

    from tests.inspeccion import buscar_en_codigo

    pos = Path(__file__).resolve().parents[1] / "apps" / "pos"
    # Los docstrings SÍ pueden nombrarlas: `paneles.py` explica el mecanismo con
    # las mesas de ejemplo, y ese texto es justo lo que hay que conservar. Lo
    # que no puede haber es una rama, y eso es lo que se busca.
    hallazgos = buscar_en_codigo(pos, r"reserva")
    assert not hallazgos, "La caja está ramificando por reservas:\n" + "\n".join(
        hallazgos
    )


def test_el_modulo_aporta_su_panel_a_la_caja(con_reservas):
    """El registro se llena en `ready()`, así que basta con instalar la app."""
    claves = {p.clave for p in paneles.disponibles(["pos", "reservas"])}
    assert "reserva" in claves


def test_sin_contratar_reservas_su_panel_no_se_ofrece():
    """
    Filtrado en el servidor, no en la pantalla.

    Mandar la lista entera y confiar en que el panel oculte lo que no toca es
    cómo se filtra una funcionalidad que no se ha pagado.
    """
    claves = {p.clave for p in paneles.disponibles(["pos"])}
    assert "reserva" not in claves
    assert "cliente" in claves  # el que trae el propio POS sigue estando


# ==========================================================================
# 2. DOS PERSONAS NO SE SIENTAN EN LA MISMA MESA
# ==========================================================================
def test_el_hueco_ocupado_no_se_vuelve_a_dar(con_reservas, mesa, esta_noche):
    reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    with pytest.raises(reservas.RecursoOcupado):
        reservas.crear(
            con_reservas,
            recurso=mesa,
            inicio=esta_noche + timedelta(minutes=30),
            nombre_contacto="Luis",
        )


def test_los_extremos_no_chocan(con_reservas, mesa, esta_noche):
    """
    Una reserva de 20:00 a 21:30 deja libre la de 21:30.

    Es como lo entiende cualquiera que reparta mesas, y es justo el caso que se
    pierde cuando el solapamiento se escribe enumerando los cuatro casos en vez
    de con la comparación de intervalos.
    """
    primera = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    segunda = reservas.crear(
        con_reservas, recurso=mesa, inicio=primera.fin, nombre_contacto="Luis"
    )
    assert segunda.inicio == primera.fin


def test_una_cancelada_libera_el_hueco(con_reservas, mesa, esta_noche):
    primera = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    reservas.cambiar_estado(primera, Reserva.Estado.CANCELADA)

    segunda = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Luis"
    )
    assert segunda.pk != primera.pk


def test_un_recurso_puede_admitir_varias_a_la_vez(con_reservas, esta_noche):
    """
    Una sala de yoga admite veinte; una mesa, una.

    El número va en el RECURSO y no en un interruptor del negocio porque el
    mismo local puede tener las dos cosas.
    """
    sala = Recurso.objects.create(
        codigo="sala", nombre="Sala", capacidad=20, reservas_simultaneas=10
    )
    for i in range(10):
        reservas.crear(
            con_reservas, recurso=sala, inicio=esta_noche, nombre_contacto=f"Alumno {i}"
        )
    with pytest.raises(reservas.RecursoOcupado):
        reservas.crear(
            con_reservas, recurso=sala, inicio=esta_noche, nombre_contacto="El once"
        )


def test_no_se_reserva_para_mas_gente_de_la_que_cabe(con_reservas, mesa, esta_noche):
    with pytest.raises(reservas.ErrorDeReserva):
        reservas.crear(
            con_reservas,
            recurso=mesa,
            inicio=esta_noche,
            personas=8,
            nombre_contacto="Una familia grande",
        )


def test_sin_aforo_declarado_no_se_valida_la_capacidad(con_reservas, esta_noche):
    """Una hora de peluquería no tiene aforo, y exigirle uno obligaría a
    inventar un número que luego alguien tomaría por cierto."""
    silla = Recurso.objects.create(codigo="silla", nombre="Silla 1", capacidad=0)
    reserva = reservas.crear(
        con_reservas, recurso=silla, inicio=esta_noche, personas=3, nombre_contacto="Ana"
    )
    assert reserva.personas == 3


def test_no_se_reserva_para_dentro_de_dos_anos(con_reservas, mesa):
    lejos = timezone.now() + timedelta(days=900)
    with pytest.raises(reservas.ErrorDeReserva):
        reservas.crear(
            con_reservas, recurso=mesa, inicio=lejos, nombre_contacto="El optimista"
        )


# ==========================================================================
# 3. MOVER PASA POR LA MISMA COMPROBACIÓN
# ==========================================================================
def test_reprogramar_no_choca_consigo_misma(con_reservas, mesa, esta_noche):
    """
    El caso que se rompe si la comprobación no se excluye a sí misma: mover una
    reserva quince minutos chocaría siempre contra su propio hueco anterior.
    """
    reserva = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    movida = reservas.reprogramar(reserva, inicio=esta_noche + timedelta(minutes=15))
    assert movida.inicio == esta_noche + timedelta(minutes=15)


def test_reprogramar_sobre_un_hueco_ocupado_se_rechaza(con_reservas, mesa, esta_noche):
    reservas.crear(con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana")
    otra = reservas.crear(
        con_reservas,
        recurso=mesa,
        inicio=esta_noche + timedelta(hours=3),
        nombre_contacto="Luis",
    )
    with pytest.raises(reservas.RecursoOcupado):
        reservas.reprogramar(otra, inicio=esta_noche + timedelta(minutes=10))


def test_una_reserva_cumplida_ya_no_se_mueve(con_reservas, mesa, esta_noche):
    reserva = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    reservas.cambiar_estado(reserva, Reserva.Estado.EN_CURSO)
    reservas.cambiar_estado(reserva, Reserva.Estado.CUMPLIDA)
    with pytest.raises(reservas.CambioNoPermitido):
        reservas.reprogramar(reserva, inicio=esta_noche + timedelta(hours=1))


# ==========================================================================
# 4. LOS ESTADOS SOLO AVANZAN POR SU TABLA
# ==========================================================================
def test_una_cancelada_no_revive(con_reservas, mesa, esta_noche):
    """Si el cliente vuelve, es una reserva nueva. Resucitar la anterior
    devolvería un hueco que entretanto pudo darse a otro."""
    reserva = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    reservas.cambiar_estado(reserva, Reserva.Estado.CANCELADA)
    with pytest.raises(reservas.CambioNoPermitido):
        reservas.cambiar_estado(reserva, Reserva.Estado.CONFIRMADA)


def test_no_asistio_y_cancelada_no_son_lo_mismo(con_reservas, mesa, esta_noche):
    """
    Quien avisa libera el hueco a tiempo; quien no aparece deja la mesa vacía
    toda la noche. Un negocio que no distingue las dos cosas no puede decidir
    si le hace falta pedir señal.
    """
    reserva = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    reservas.cambiar_estado(reserva, Reserva.Estado.NO_ASISTIO)
    assert reserva.estado != Reserva.Estado.CANCELADA
    assert not reserva.ocupa


def test_la_reserva_dice_a_donde_puede_ir(con_reservas, mesa, esta_noche):
    """
    La tabla de transiciones viaja en la respuesta.

    Es lo que evita que la pantalla la reimplemente en TypeScript, que es como
    acaban divergiendo el servidor y el panel: unos botones que se pueden
    pulsar y no hacen nada.
    """
    from apps.reservations.serializers import ReservaSerializer

    reserva = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    siguientes = {s["valor"] for s in ReservaSerializer(reserva).data["siguientes"]}
    assert siguientes == {"CONFIRMADA", "EN_CURSO", "CANCELADA", "NO_ASISTIO"}


# ==========================================================================
# 5. EL ENGANCHE CON LA CAJA
# ==========================================================================
def test_enlazar_la_venta_pone_la_reserva_en_curso(
    con_reservas, mesa, esta_noche, usuario_owner
):
    """
    La clave foránea va de reserva a venta, y esa asimetría es la que sostiene
    toda la fase: el POS guarda un diccionario opaco y quien lo interpreta es
    este módulo.
    """
    from apps.billing.models import Producto as ProductoComercial
    from apps.business.models import TenantModulo as Modulo
    from apps.pos import operaciones as caja

    plan = Plan.objects.get(suscripciones__tenant=con_reservas)
    plan.permisos = [*plan.permisos, "pos.add_venta", "pos.change_turno"]
    plan.save(update_fields=["permisos"])
    Modulo.objects.get_or_create(
        tenant=con_reservas,
        modulo=ProductoComercial.objects.get(slug="pos"),
        defaults={"activo": True},
    )

    reserva = reservas.crear(
        con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana"
    )
    turno = caja.abrir_turno(con_reservas, usuario_owner)
    venta = caja.abrir_venta(
        turno,
        usuario_owner,
        contexto={"reserva_id": reserva.pk, "recurso_id": mesa.pk},
    )

    reservas.enlazar_venta(reserva, venta)
    reserva.refresh_from_db()
    assert reserva.venta_id == venta.pk
    assert reserva.estado == Reserva.Estado.EN_CURSO
    # Y la caja guardó el diccionario tal cual, sin interpretarlo.
    assert venta.contexto["reserva_id"] == reserva.pk


# ==========================================================================
# 6. EL MÓDULO, LOS PERMISOS Y EL AISLAMIENTO
# ==========================================================================
def test_sin_el_modulo_la_agenda_no_existe(api_owner, negocio):
    respuesta = api_owner.get("/api/reservas/recursos/")
    assert respuesta.status_code == 403


def test_con_el_modulo_la_agenda_responde(api_owner, con_reservas):
    assert api_owner.get("/api/reservas/recursos/").status_code == 200


def test_la_configuracion_nombra_lo_que_se_reserva(api_owner, con_reservas):
    """
    «Mesas», «Canchas», «Sillas». El nombre es un dato del negocio: los datos
    NOMBRAN, el código PINTA.
    """
    respuesta = api_owner.get("/api/reservas/configuracion/")
    assert respuesta.status_code == 200
    assert respuesta.data["nombre_recurso"] == "Mesa"

    api_owner.put(
        "/api/reservas/configuracion/",
        {"nombre_recurso": "Cancha", "nombre_recurso_plural": "Canchas"},
        format="json",
    )
    assert api_owner.get("/api/reservas/configuracion/").data["nombre_recurso"] == "Cancha"


def test_el_flujo_completo_por_api(api_owner, con_reservas, esta_noche):
    creado = api_owner.post(
        "/api/reservas/recursos/",
        {"codigo": "mesa-2", "nombre": "Mesa 2", "capacidad": 2},
        format="json",
    )
    assert creado.status_code == 201

    reserva = api_owner.post(
        "/api/reservas/reservas/crear/",
        {
            "recurso_id": creado.data["id"],
            "inicio": esta_noche.isoformat(),
            "personas": 2,
            "nombre_contacto": "Ana",
        },
        format="json",
    )
    assert reserva.status_code == 201, reserva.data

    agenda = api_owner.get(
        "/api/reservas/reservas/agenda/",
        {
            "desde": (esta_noche - timedelta(hours=2)).isoformat(),
            "hasta": (esta_noche + timedelta(hours=6)).isoformat(),
        },
    )
    assert [r["nombre_contacto"] for r in agenda.data] == ["Ana"]

    # Y el hueco ocupado sale como 400 con un mensaje para quien atiende, no
    # como un 500: quedarse sin mesa es una respuesta normal.
    repetida = api_owner.post(
        "/api/reservas/reservas/crear/",
        {
            "recurso_id": creado.data["id"],
            "inicio": esta_noche.isoformat(),
            "nombre_contacto": "Luis",
        },
        format="json",
    )
    assert repetida.status_code == 400
    assert "ocupada" in repetida.data["detail"]


def test_la_agenda_de_un_negocio_no_se_ve_desde_otro(
    con_reservas, mesa, esta_noche, tenant_b
):
    reservas.crear(con_reservas, recurso=mesa, inicio=esta_noche, nombre_contacto="Ana")

    with usar_tenant(tenant_b):
        assert Reserva.objects.count() == 0
        assert Recurso.objects.count() == 0


# ==========================================================================
# 7. LA CARRERA
# ==========================================================================
@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_dos_camareros_no_dan_la_misma_mesa(settings, negocio):
    """
    Comprobar y luego escribir es la carrera de libro: los dos ven el hueco
    libre, los dos lo ocupan. Lo que lo evita es el `select_for_update` sobre
    la fila del recurso, y eso solo se puede comprobar con transacciones de
    verdad — en SQLite este test no dice nada.
    """
    if not getattr(settings, "USA_POSTGRES_EN_TESTS", False):
        pytest.skip("Necesita TEST_DATABASE_URL apuntando a PostgreSQL")

    # Todo se monta DENTRO del test y no en fixtures: `transaction=True` vacia
    # la base entre pruebas, asi que lo que sembraron las migraciones —los
    # planes, el catalogo comercial— ya no esta cuando esto corre.
    mesa = Recurso.objects.create(codigo="mesa-1", nombre="Mesa 1", capacidad=4)
    esta_noche = (timezone.now() + timedelta(days=1)).replace(
        hour=20, minute=0, second=0, microsecond=0
    )

    import threading

    from django.db import connections

    errores = []
    barrera = threading.Barrier(2)

    def reservar(nombre):
        # Cada hilo estrena conexion; sin eso compartirian transaccion y no
        # habria concurso que medir.
        barrera.wait()
        try:
            with usar_tenant(negocio):
                reservas.crear(
                    negocio, recurso=mesa, inicio=esta_noche, nombre_contacto=nombre
                )
        except reservas.ErrorDeReserva as error:
            errores.append(error)
        finally:
            connections.close_all()

    hilos = [
        threading.Thread(target=reservar, args=(nombre,)) for nombre in ("Ana", "Luis")
    ]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join()

    assert Reserva.objects.filter(recurso=mesa).count() == 1
    assert len(errores) == 1
