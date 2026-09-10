"""
Domicilios.

Siete promesas, y las dos primeras no son sobre envíos sino sobre el resto del
sistema. Este es el SEGUNDO módulo con panel en la caja, así que es el primero
que puede decir algo sobre si la arquitectura aguanta: con un módulo, cualquier
mecanismo funciona.

1. Que añadir un módulo sigue sin obligar a tocar los que ya estaban. Ahora son
   dos las apps que no deben enterarse: `apps.pos` y `apps.orders`.
2. Que DOS paneles caben a la vez. Es lo que reventó `panel_lateral`, que era
   una cadena, y el único sitio donde el sistema suponía «uno».
3. Que a un repartidor no se le cuelgan más envíos de los que puede llevar,
   aunque dos personas se lo asignen a la vez.
4. Que la tarifa se COPIA: cambiar el precio de una zona no reescribe lo que se
   cobró el mes pasado.
5. Que los estados solo avanzan por su tabla, y que devolver no es cancelar.
6. Que un módulo no contratado no se usa aunque se conozca la URL.
7. Que los envíos de un negocio no se ven desde otro.
"""
from decimal import Decimal

import pytest

from apps.billing.models import Plan, Producto
from apps.business import perfil_pos
from apps.business.models import TenantModulo
from apps.delivery import operaciones as domicilios
from apps.delivery.models import Envio, Repartidor, Zona
from apps.pos import paneles
from apps.tenancy.context import usar_tenant

pytestmark = pytest.mark.django_db

PERMISOS = [
    "delivery.view_envio",
    "delivery.add_envio",
    "delivery.change_zona",
]


@pytest.fixture
def con_domicilios(negocio):
    """
    Un negocio con domicilios contratados y encendidos.

    Hay que tocar el plan a mano por lo mismo que con el POS y con reservas:
    `billing.0009` NO añade el módulo a los planes existentes. Regalárselo a los
    clientes actuales en una migración sería una decisión comercial tomada por
    descuido.
    """
    plan = Plan.objects.get(suscripciones__tenant=negocio)
    plan.permisos = [*plan.permisos, *PERMISOS]
    plan.save(update_fields=["permisos"])
    TenantModulo.objects.get_or_create(
        tenant=negocio,
        modulo=Producto.objects.get(slug="domicilios"),
        defaults={"activo": True},
    )
    return negocio


@pytest.fixture
def zona(con_domicilios):
    return Zona.objects.create(codigo="modelia", nombre="Modelia", tarifa=Decimal("4000"))


@pytest.fixture
def carlos(con_domicilios):
    return Repartidor.objects.create(nombre="Carlos", vehiculo="Moto", carga_maxima=2)


def _crear(tenant, **extra):
    datos = {
        "direccion": "Calle 1 # 2-3",
        "nombre_contacto": "Ana",
    }
    datos.update(extra)
    return domicilios.crear(tenant, **datos)


# ==========================================================================
# 1. AÑADIR UN MÓDULO SIGUE SIN OBLIGAR A TOCAR LOS QUE YA ESTABAN
# ==========================================================================
@pytest.mark.parametrize("app", ["pos", "orders"])
def test_ni_la_caja_ni_los_pedidos_saben_que_existen_los_domicilios(app):
    """
    El guardia de la fase, y esta vez son dos apps.

    Reservas solo tenía que no tocar el POS. Domicilios entra por dos puertas
    —la caja y los pedidos de la tienda— y las dos tienen que quedar intactas:
    `Envio.venta` y `Envio.pedido` apuntan desde AQUÍ hacia allá, nunca al
    revés. Un `if modulo == "domicilios"` escondido en cualquiera de las dos
    rompería la promesa sin que ningún otro test se enterara: todo seguiría
    funcionando, y el tercer módulo volvería a necesitar una rama.
    """
    from pathlib import Path

    from tests.inspeccion import buscar_en_codigo

    raiz = Path(__file__).resolve().parents[1] / "apps" / app
    # Los docstrings SÍ pueden nombrarlos: `pos/paneles.py` explica el mecanismo
    # con ejemplos, y ese texto es justo lo que hay que conservar. Lo que no
    # puede haber es una rama, y eso es lo que se busca.
    hallazgos = buscar_en_codigo(raiz, r"domicilio|delivery")
    assert not hallazgos, f"`apps.{app}` está ramificando por domicilios:\n" + "\n".join(
        hallazgos
    )


def test_el_modulo_aporta_su_panel_a_la_caja(con_domicilios):
    """El registro se llena en `ready()`, así que basta con instalar la app."""
    claves = {p.clave for p in paneles.disponibles(["pos", "domicilios"])}
    assert "domicilio" in claves


def test_sin_contratar_domicilios_su_panel_no_se_ofrece():
    """
    Filtrado en el servidor, no en la pantalla.

    Mandar la lista entera y confiar en que el panel oculte lo que no toca es
    cómo se filtra una funcionalidad que no se ha pagado.
    """
    claves = {p.clave for p in paneles.disponibles(["pos"])}
    assert "domicilio" not in claves
    assert "cliente" in claves  # el que trae el propio POS sigue estando


# ==========================================================================
# 2. DOS PANELES A LA VEZ — el «uno» que quedaba supuesto
# ==========================================================================
def test_un_negocio_puede_tener_los_dos_paneles():
    """
    El hallazgo de la fase 12, convertido en guardia.

    `panel_lateral` era UNA cadena. El restaurante que atiende en mesas y
    además reparte tenía los dos módulos contratados, los dos paneles
    registrados y los dos correctamente filtrados… y tenía que elegir cuál ver.
    No fallaba el registro de paneles —ese aguantó la fase entera sin tocarse—
    sino el sitio donde el negocio dice cuáles quiere.
    """
    limpio = perfil_pos.normalizar({"panel_lateral": ["reserva", "domicilio"]})
    assert limpio["panel_lateral"] == ["reserva", "domicilio"]


def test_la_cadena_vieja_sigue_valiendo():
    """
    Hay perfiles guardados con una cadena, y no pueden quedarse sin panel.

    Rechazarla no daría un error: daría una caja sin su panel lateral, que es
    el peor modo de fallar — el que nadie reporta porque no parece roto.
    """
    assert perfil_pos.normalizar({"panel_lateral": "reserva"})["panel_lateral"] == [
        "reserva"
    ]
    assert perfil_pos.normalizar({"panel_lateral": None})["panel_lateral"] == []


def test_el_defecto_no_se_comparte_entre_negocios():
    """
    Una lista por defecto compartida se llena sola en cuanto alguien la muta, y
    el fallo aparece en el negocio equivocado.
    """
    uno = perfil_pos.por_defecto()
    uno["panel_lateral"].append("domicilio")
    assert perfil_pos.por_defecto()["panel_lateral"] == []


def test_el_preset_de_restaurante_pide_los_dos():
    """
    El preset que hizo falta para que el problema existiera.

    Un restaurante que atiende mesas y no reparte, o que reparte y no atiende
    mesas, es un restaurante que casi nadie tiene.
    """
    from apps.business.models import Preset

    restaurante = Preset.objects.get(slug="restaurante")
    assert "domicilios" in restaurante.modulos
    assert "reservas" in restaurante.modulos
    assert restaurante.perfil_pos["panel_lateral"] == ["reserva", "domicilio"]


# ==========================================================================
# 3. LA CARGA DEL REPARTIDOR
# ==========================================================================
def test_al_repartidor_lleno_no_se_le_cuelga_otro(con_domicilios, carlos):
    for _ in range(2):
        domicilios.asignar(_crear(con_domicilios), carlos)

    with pytest.raises(domicilios.RepartidorLleno):
        domicilios.asignar(_crear(con_domicilios), carlos)


def test_lo_entregado_ya_no_pesa(con_domicilios, carlos):
    """
    `ESTADOS_EN_CALLE` es lo que cuenta, y un entregado no está en la calle.

    Si contara todo lo que alguna vez llevó, el repartidor se llenaría para
    siempre a media mañana.
    """
    primero = domicilios.asignar(_crear(con_domicilios), carlos)
    domicilios.asignar(_crear(con_domicilios), carlos)

    domicilios.cambiar_estado(primero, Envio.Estado.EN_RUTA)
    domicilios.cambiar_estado(primero, Envio.Estado.ENTREGADO)

    # Vuelve a caber uno.
    tercero = domicilios.asignar(_crear(con_domicilios), carlos)
    assert tercero.estado == Envio.Estado.ASIGNADO


def test_reasignarle_lo_que_ya_lleva_no_choca_consigo_mismo(con_domicilios, carlos):
    """El mismo cuidado que `reservations.reprogramar()` al mover una reserva."""
    envio = domicilios.asignar(_crear(con_domicilios), carlos)
    domicilios.asignar(_crear(con_domicilios), carlos)
    # Carlos está lleno, pero este envío YA es suyo: volver a asignárselo no
    # debe chocar contra su propio hueco.
    assert domicilios.asignar(envio, carlos).repartidor_id == carlos.pk


def test_quitarselo_lo_devuelve_a_la_bandeja_sin_dueno(con_domicilios, carlos):
    """
    Volver a PENDIENTE tiene que soltar al repartidor.

    Si no, el envío seguiría contando en su carga sin que nadie lo esté
    llevando, y la lista de disponibles mentiría.
    """
    envio = domicilios.asignar(_crear(con_domicilios), carlos)
    domicilios.cambiar_estado(envio, Envio.Estado.PENDIENTE)
    assert envio.repartidor_id is None
    assert domicilios.carga(carlos).count() == 0


def test_los_disponibles_son_los_que_todavia_caben(con_domicilios, carlos):
    otro = Repartidor.objects.create(nombre="Lucía", carga_maxima=1)
    domicilios.asignar(_crear(con_domicilios), otro)

    libres = {r.pk for r in domicilios.disponibles(con_domicilios)}
    assert carlos.pk in libres
    assert otro.pk not in libres


# ==========================================================================
# 4. LA TARIFA SE COPIA
# ==========================================================================
def test_la_tarifa_se_congela(con_domicilios, zona):
    envio = _crear(con_domicilios, zona=zona)
    assert envio.tarifa == Decimal("4000")

    zona.tarifa = Decimal("6000")
    zona.save(update_fields=["tarifa"])

    envio.refresh_from_db()
    # El envío de ayer se cobró a lo de ayer. Un informe que multiplicara
    # envíos por la tarifa ACTUAL de su zona daría un número que nunca ocurrió.
    assert envio.tarifa == Decimal("4000")


def test_sin_zona_manda_la_tarifa_base(con_domicilios):
    config = domicilios.configuracion(con_domicilios)
    config.tarifa_base = Decimal("3000")
    config.save(update_fields=["tarifa_base"])

    assert _crear(con_domicilios).tarifa == Decimal("3000")


def test_quien_solo_reparte_en_sus_zonas_rechaza_lo_de_fuera(con_domicilios):
    config = domicilios.configuracion(con_domicilios)
    config.exige_zona = True
    config.save(update_fields=["exige_zona"])

    with pytest.raises(domicilios.FueraDeCobertura):
        _crear(con_domicilios)


def test_perdonar_la_tarifa_no_perdona_la_cobertura(con_domicilios):
    """
    Son dos decisiones distintas y confundirlas dejaría entrar envíos a donde
    el negocio no llega, solo porque alguien puso la tarifa a mano.
    """
    config = domicilios.configuracion(con_domicilios)
    config.exige_zona = True
    config.save(update_fields=["exige_zona"])

    with pytest.raises(domicilios.FueraDeCobertura):
        _crear(con_domicilios, tarifa=Decimal("0"))


def test_la_promesa_de_la_zona_manda_sobre_la_del_negocio(con_domicilios, zona):
    config = domicilios.configuracion(con_domicilios)
    zona.minutos_de_promesa = 90
    zona.save(update_fields=["minutos_de_promesa"])

    lejos = _crear(con_domicilios, zona=zona)
    cerca = _crear(con_domicilios)
    assert lejos.prometido_para > cerca.prometido_para
    assert config.minutos_de_promesa == 45


def test_contra_entrega_sin_monto_se_rechaza(con_domicilios):
    """Si el repartidor no sabe cuánto cobrar, el negocio no puede cuadrarle."""
    with pytest.raises(domicilios.ErrorDeEnvio):
        _crear(con_domicilios, cobro_contra_entrega=True)


def test_el_contacto_se_copia_del_cliente(con_domicilios, cliente_negocio):
    envio = domicilios.crear(
        con_domicilios, direccion="Calle 9", cliente=cliente_negocio
    )
    assert envio.nombre_contacto == cliente_negocio.nombre_cliente


# ==========================================================================
# 5. LOS ESTADOS
# ==========================================================================
def test_un_entregado_no_revive(con_domicilios, carlos):
    envio = domicilios.asignar(_crear(con_domicilios), carlos)
    domicilios.cambiar_estado(envio, Envio.Estado.EN_RUTA)
    domicilios.cambiar_estado(envio, Envio.Estado.ENTREGADO)

    with pytest.raises(domicilios.CambioNoPermitido):
        domicilios.cambiar_estado(envio, Envio.Estado.EN_RUTA)


def test_devuelto_y_cancelado_no_son_lo_mismo(con_domicilios, carlos):
    """
    Cancelar antes de que salga no cuesta nada; devolver significa que el
    repartidor manejó hasta allá y volvió con el paquete. Un negocio que no
    puede separarlas no puede decidir si le hace falta cobrar por anticipado.

    Y se nota en la tabla: DEVUELTO sale de EN_RUTA, no de ASIGNADO. Para
    devolver algo hay que haber ido.
    """
    sin_salir = _crear(con_domicilios)
    with pytest.raises(domicilios.CambioNoPermitido):
        domicilios.cambiar_estado(sin_salir, Envio.Estado.DEVUELTO)
    domicilios.cambiar_estado(sin_salir, Envio.Estado.CANCELADO)
    assert sin_salir.estado == Envio.Estado.CANCELADO

    salido = domicilios.asignar(_crear(con_domicilios), carlos)
    domicilios.cambiar_estado(salido, Envio.Estado.EN_RUTA)
    domicilios.cambiar_estado(salido, Envio.Estado.DEVUELTO)
    assert salido.estado == Envio.Estado.DEVUELTO


def test_no_sale_a_la_calle_lo_que_nadie_lleva(con_domicilios):
    envio = _crear(con_domicilios)
    with pytest.raises(domicilios.CambioNoPermitido):
        domicilios.cambiar_estado(envio, Envio.Estado.EN_RUTA)


def test_las_horas_se_estampan_solas(con_domicilios, carlos):
    """
    Un envío en ruta sin hora de salida no permite saber si va tarde, que es la
    única pregunta que alguien le hace a esa pantalla.
    """
    envio = domicilios.asignar(_crear(con_domicilios), carlos)
    assert envio.salida is None

    domicilios.cambiar_estado(envio, Envio.Estado.EN_RUTA)
    assert envio.salida is not None
    assert envio.entrega is None

    domicilios.cambiar_estado(envio, Envio.Estado.ENTREGADO)
    assert envio.entrega is not None


def test_el_envio_dice_a_donde_puede_ir(api_owner, con_domicilios):
    """
    Las transiciones las decide el servidor y viajan en la respuesta.

    Reimplementar la tabla en TypeScript es cómo acaban divergiendo el panel y
    la API, y el síntoma son botones que se pulsan y no hacen nada.
    """
    _crear(con_domicilios)
    respuesta = api_owner.get("/api/domicilios/envios/tablero/")
    assert respuesta.status_code == 200
    siguientes = {s["valor"] for s in respuesta.data[0]["siguientes"]}
    assert siguientes == {"ASIGNADO", "CANCELADO"}


# ==========================================================================
# 6. SIN EL MÓDULO NO HAY MÓDULO
# ==========================================================================
def test_sin_el_modulo_el_tablero_no_existe(api_owner, negocio):
    assert api_owner.get("/api/domicilios/envios/tablero/").status_code == 403


def test_con_el_modulo_el_tablero_responde(api_owner, con_domicilios):
    assert api_owner.get("/api/domicilios/envios/tablero/").status_code == 200


def test_la_configuracion_nombra_a_quien_reparte(api_owner, con_domicilios):
    """
    Los datos NOMBRAN, el código PINTA. La pantalla no dice «Repartidor» si el
    negocio prefiere «Domiciliario».
    """
    respuesta = api_owner.put(
        "/api/domicilios/configuracion/",
        {"nombre_repartidor": "Domiciliario", "nombre_repartidor_plural": "Domiciliarios"},
        format="json",
    )
    assert respuesta.status_code == 200
    assert respuesta.data["nombre_repartidor"] == "Domiciliario"


def test_el_flujo_completo_por_api(api_owner, con_domicilios, zona, carlos):
    creado = api_owner.post(
        "/api/domicilios/envios/crear/",
        {
            "direccion": "Carrera 7 # 12-34",
            "referencia": "Portón verde",
            "nombre_contacto": "Ana",
            "zona_id": zona.pk,
        },
        format="json",
    )
    assert creado.status_code == 201, creado.data
    envio_id = creado.data["id"]
    assert creado.data["tarifa"] == "4000.00"

    asignado = api_owner.post(
        f"/api/domicilios/envios/{envio_id}/asignar/",
        {"repartidor_id": carlos.pk},
        format="json",
    )
    assert asignado.status_code == 200
    assert asignado.data["estado"] == "ASIGNADO"

    for estado in ("EN_RUTA", "ENTREGADO"):
        paso = api_owner.post(
            f"/api/domicilios/envios/{envio_id}/estado/", {"estado": estado}, format="json"
        )
        assert paso.status_code == 200, paso.data
        assert paso.data["estado"] == estado


def test_el_tablero_sin_ventana_solo_trae_lo_vivo(api_owner, con_domicilios, carlos):
    """
    Quien abre esta pantalla está despachando, no auditando. Con ventana pasa a
    ser el modo auditoría — es la diferencia deliberada con la agenda, donde la
    ventana es obligatoria.
    """
    cerrado = _crear(con_domicilios)
    domicilios.cambiar_estado(cerrado, Envio.Estado.CANCELADO)
    _crear(con_domicilios)

    respuesta = api_owner.get("/api/domicilios/envios/tablero/")
    assert {e["estado"] for e in respuesta.data} == {"PENDIENTE"}


# ==========================================================================
# 7. AISLAMIENTO
# ==========================================================================
def test_los_envios_de_un_negocio_no_se_ven_desde_otro(
    con_domicilios, zona, carlos, tenant_b
):
    _crear(con_domicilios, zona=zona)

    with usar_tenant(tenant_b):
        assert Envio.objects.count() == 0
        assert Zona.objects.count() == 0
        assert Repartidor.objects.count() == 0


# ==========================================================================
# 8. LA CARRERA
# ==========================================================================
@pytest.mark.postgres
@pytest.mark.django_db(transaction=True)
def test_dos_despachadores_no_llenan_de_mas_al_mismo_repartidor(settings, negocio):
    """
    Contar y luego escribir es la carrera de libro: los dos ven un hueco libre,
    los dos lo ocupan, y el repartidor sale con uno de más. Lo que lo evita es
    el `select_for_update` sobre la fila del repartidor, y eso solo se puede
    comprobar con transacciones de verdad — en SQLite este test no dice nada.

    Es la MISMA forma de problema que «dos camareros dan la misma mesa», y que
    el segundo módulo con panel se haya topado con ella otra vez es el dato más
    útil de esta fase.
    """
    if not getattr(settings, "USA_POSTGRES_EN_TESTS", False):
        pytest.skip("Necesita TEST_DATABASE_URL apuntando a PostgreSQL")

    # Todo se monta DENTRO del test y no en fixtures: `transaction=True` vacía
    # la base entre pruebas, así que lo que sembraron las migraciones ya no
    # está cuando esto corre.
    repartidor = Repartidor.objects.create(nombre="Carlos", carga_maxima=1)
    envios = [
        Envio.objects.create(direccion=f"Calle {i}", nombre_contacto=f"Cliente {i}")
        for i in range(2)
    ]

    import threading

    from django.db import connections

    errores = []
    barrera = threading.Barrier(2)

    def despachar(envio):
        # Cada hilo estrena conexión; sin eso compartirían transacción y no
        # habría concurso que medir.
        barrera.wait()
        try:
            with usar_tenant(negocio):
                domicilios.asignar(envio, repartidor)
        except domicilios.ErrorDeEnvio as error:
            errores.append(error)
        finally:
            connections.close_all()

    hilos = [threading.Thread(target=despachar, args=(e,)) for e in envios]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join()

    assert len(errores) == 1, "Los dos entraron: el bloqueo no está sosteniendo nada"
    with usar_tenant(negocio):
        assert domicilios.carga(repartidor).count() == 1


def test_un_envio_sin_direccion_se_rechaza(api_owner, con_domicilios):
    """
    La dirección es opcional en el serializer solo porque puede venir del
    pedido de la tienda. Si no llega por ninguna vía, la regla —que vive en
    `operaciones`, no en la vista— dice que no.
    """
    respuesta = api_owner.post(
        "/api/domicilios/envios/crear/", {"nombre_contacto": "Ana"}, format="json"
    )
    assert respuesta.status_code == 400
    assert "dirección" in respuesta.data["detail"]


def test_el_domicilio_de_un_pedido_copia_la_direccion_del_cliente(
    api_owner, con_domicilios, cliente_negocio
):
    """
    Copiada al crear, no leída después por la clave foránea. Si el cliente se
    muda el año que viene, este envío tiene que seguir diciendo a dónde fue.

    Y `apps.orders` no se entera de nada: la referencia va desde `Envio.pedido`
    hacia allá, nunca al revés.
    """
    from apps.orders.models import Pedido

    cliente_negocio.direccion_cliente = "Diagonal 5 # 40-11, apto 302"
    cliente_negocio.save(update_fields=["direccion_cliente"])

    pedido = Pedido.objects.create(cliente=cliente_negocio, total_pedido=0)
    respuesta = api_owner.post(
        "/api/domicilios/envios/crear/", {"pedido_id": pedido.pk}, format="json"
    )
    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["direccion"] == cliente_negocio.direccion_cliente
    assert respuesta.data["origen"] == "TIENDA"
