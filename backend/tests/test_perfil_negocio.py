"""
El perfil de negocio: presets, capacidades y módulos.

Lo que se comprueba no es que los JSON se guarden, sino las cuatro promesas de
las que depende que Crynex siga siendo un sistema y no diez aplicaciones:

1. Que adoptar un preset COPIA, para que editarlo en Crynex no cambie negocios
   en producción.
2. Que las capacidades tienen consumidores reales — si nadie las lee, el perfil
   es decorativo.
3. Que un módulo funciona solo si el plan lo cubre Y el cliente lo quiere.
4. Que en ningún sitio se ramifica por sector. Ese es el test que vigila la
   regla fundamental del encargo.
"""
import subprocess
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.billing.models import Plan, Producto, Subscription
from apps.business import aplicar as servicio
from apps.business import seleccion
from apps.business.capacidades import CAPACIDADES
from apps.business.consulta import puede
from apps.business.models import PerfilNegocio, Preset, TenantModulo
from apps.catalog.models import Producto as ProductoCatalogo

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_plataforma(negocio):
    """El equipo de Crynex, que administra los presets de todos los negocios."""
    usuario = get_user_model().objects.create_user(
        email_usuario="crynex@ejemplo.test",
        nombre_usuario="Equipo Crynex",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    usuario.es_staff_plataforma = True
    usuario.save(update_fields=["es_staff_plataforma"])

    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


@pytest.fixture
def mercado():
    return Preset.objects.get(slug="mercado")


@pytest.fixture
def ferreteria():
    return Preset.objects.get(slug="ferreteria")


# ==========================================================================
# 1. ADOPTAR COPIA, NO REFERENCIA
# ==========================================================================
def test_un_negocio_nace_con_perfil(negocio):
    """
    Sin esto, cada consumidor tendría que defenderse de la ausencia del perfil
    por separado, y uno se olvidaría.
    """
    perfil = PerfilNegocio.objects.get(tenant=negocio)
    assert perfil.esta_configurado is False
    # Y con las capacidades por defecto, que son la plataforma de siempre.
    assert perfil.puede("acepta_pedidos_online") is True
    assert perfil.puede("controla_stock") is False


def test_adoptar_copia_los_valores(negocio, ferreteria):
    perfil = servicio.aplicar_preset(negocio, ferreteria)

    assert perfil.esta_configurado
    assert perfil.preset_version_origen == ferreteria.version
    assert perfil.puede("controla_stock") is True
    assert perfil.puede("acepta_pedidos_online") is False
    assert perfil.politica_stock["permite_negativo"] is True
    assert [eje["codigo"] for eje in perfil.esquema_atributos] == ["empaque", "medida"]


def test_editar_el_preset_no_toca_a_quien_ya_lo_adopto(negocio, ferreteria):
    """
    La razón de que se copie en vez de referenciar.

    Si el perfil apuntara al preset, retocar «Ferretería» en el panel de Crynex
    cambiaría el comportamiento de cuarenta negocios en producción sin avisar a
    ninguno. Un negocio que funciona no cambia solo.
    """
    perfil = servicio.aplicar_preset(negocio, ferreteria)

    ferreteria.capacidades = {"controla_stock": False, "acepta_pedidos_online": True}
    ferreteria.version += 1
    ferreteria.save()

    perfil.refresh_from_db()
    assert perfil.puede("controla_stock") is True  # lo que copió, no lo que dice hoy
    assert perfil.preset_version_origen == ferreteria.version - 1


def test_reaplicar_no_borra_el_trabajo_del_cliente(negocio, mercado, ferreteria):
    servicio.aplicar_preset(negocio, mercado)
    with pytest.raises(servicio.YaTienePerfil):
        servicio.aplicar_preset(negocio, ferreteria)


def test_adoptar_copia_el_tema_a_la_configuracion(negocio, mercado):
    from apps.content.models import StoreSettings
    from apps.storefront.models import Plantilla

    plantilla = Plantilla.objects.filter(es_predeterminada=True).first()
    if plantilla is None:
        pytest.skip("La siembra del motor de tiendas no dejó plantilla por defecto")

    plantilla.tema_valores = {"color-primario": "#123456"}
    plantilla.save(update_fields=["tema_valores"])
    mercado.plantilla = plantilla
    mercado.save(update_fields=["plantilla"])

    servicio.aplicar_preset(negocio, mercado)
    config = StoreSettings.objects.get(tenant=negocio)
    assert config.tokens.get("color-primario") == "#123456"


# ==========================================================================
# 2. LAS CAPACIDADES TIENEN CONSUMIDORES REALES
# ==========================================================================
def test_toda_capacidad_declara_quien_la_lee():
    """
    La disciplina que evita un perfil decorativo.

    Una bandera que nadie lee es peor que no tenerla: promete configurabilidad
    que no se cumple, y cuando alguien la activa y no pasa nada, deja de fiarse
    del resto. Es la misma regla que el motor ya aplica a `TokenTema` y a
    `Bloque`.
    """
    for codigo, datos in CAPACIDADES.items():
        assert datos.get("consumidor"), f"«{codigo}» no dice quién la lee"


def test_un_negocio_que_no_vende_online_rechaza_pedidos(
    api, negocio, ferreteria, presentacion
):
    """`acepta_pedidos_online` apagado: la tienda es catálogo, no comercio."""
    servicio.aplicar_preset(negocio, ferreteria)

    respuesta = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Quien sea", "telefono": "3000000000"},
            "items": [{"presentacion_id": presentacion.id, "cantidad": "1"}],
        },
        format="json",
    )
    assert respuesta.status_code == 400
    assert "no recibe pedidos por internet" in str(respuesta.data)


def test_el_perfil_decide_como_nace_un_producto(api_owner, negocio, categoria, ferreteria):
    """La capacidad propone el valor inicial; no lo impone después."""
    servicio.aplicar_preset(negocio, ferreteria)

    respuesta = api_owner.post(
        "/api/catalog/products/",
        {"nombre_producto": "Tornillo 8x1", "categoria": categoria.id, "presentaciones": []},
        format="json",
    )
    assert respuesta.status_code == 201
    creado = ProductoCatalogo.objects.get(nombre_producto="Tornillo 8x1")
    assert creado.controla_stock is True   # la ferretería lleva inventario
    assert creado.permite_fraccion is False


def test_lo_que_manda_la_peticion_gana_al_perfil(api_owner, negocio, categoria, ferreteria):
    servicio.aplicar_preset(negocio, ferreteria)

    api_owner.post(
        "/api/catalog/products/",
        {
            "nombre_producto": "Cable por metro",
            "categoria": categoria.id,
            "controla_stock": False,
            "presentaciones": [],
        },
        format="json",
    )
    creado = ProductoCatalogo.objects.get(nombre_producto="Cable por metro")
    assert creado.controla_stock is False


def test_la_politica_de_stock_llega_hasta_mover(negocio, producto, ferreteria):
    """
    El perfil gobierna el inventario sin que `mover()` sepa de sectores.

    La ferretería permite saldo negativo: prefiere vender y cuadrar después.
    """
    from apps.inventory import operaciones

    servicio.aplicar_preset(negocio, ferreteria)
    producto.controla_stock = True
    producto.save(update_fields=["controla_stock"])

    # Sin existencias y aun así se vende: lo permite la política, no un `if`.
    operaciones.salida(producto, 5)
    assert operaciones.disponible(producto) < 0


# ==========================================================================
# 3. PLAN Y ACTIVACIÓN SON DOS PREGUNTAS
# ==========================================================================
def test_un_modulo_necesita_plan_y_activacion(negocio):
    inventario = Producto.objects.get(slug="inventario")
    assert "inventario" in servicio.modulos_del_plan(negocio)

    TenantModulo.objects.create(tenant=negocio, modulo=inventario, activo=False)
    # El plan lo cubre, pero el cliente lo apagó: no está operativo.
    assert "inventario" not in servicio.modulos_activos(negocio)


def test_una_suscripcion_pausada_no_concede_nada(negocio):
    suscripcion = Subscription.objects.get(tenant=negocio)
    suscripcion.estado = "PAUSADA"
    suscripcion.save(update_fields=["estado"])
    assert servicio.modulos_del_plan(negocio) == set()


def test_el_preset_no_enciende_lo_que_el_plan_no_cubre(negocio, ferreteria):
    """
    Un preset es una recomendación, no una compra.

    Que «Ferretería» sugiera inventario no puede impedir darse de alta a quien
    no lo tiene contratado: vería un error sin entender qué hizo mal.
    """
    plan = Plan.objects.get(suscripciones__tenant=negocio)
    plan.permisos = [p for p in plan.permisos if not p.startswith("inventory.")]
    plan.save(update_fields=["permisos"])

    perfil = servicio.aplicar_preset(negocio, ferreteria)
    assert perfil.esta_configurado          # el alta se completó igual
    assert "inventario" not in servicio.modulos_activos(negocio)


# ==========================================================================
# 4. EL ALGORITMO DE SELECCIÓN
# ==========================================================================
def test_las_senales_pesan_mas_que_la_etiqueta(negocio):
    """
    Quien describe una ferretería sin decir que lo es, igual llega a ferretería.

    Es el punto del scoring por señales: preguntan cómo TRABAJA el negocio, no
    cómo se llama.
    """
    candidatos = seleccion.sugerir(
        {"usa_codigo_barras": True, "cobra_en_mostrador": True, "controla_stock": True}
    )
    assert candidatos[0]["preset"].slug == "ferreteria"
    assert candidatos[0]["motivos"]  # y dice por qué


def test_sin_respuestas_convincentes_cae_al_predeterminado():
    candidatos = seleccion.sugerir({})
    assert len(candidatos) == 1
    assert candidatos[0]["preset"].es_predeterminado


def test_un_modulo_sin_contratar_desempata_pero_no_descarta():
    """
    La calibración que se corrigió al construir el POS.

    Con la penalización dentro de la puntuación, una ferretería de manual
    —código de barras, cobro en mostrador— dejaba de reconocerse como
    ferretería en cuanto su plan no incluía la caja. No tener contratado el POS
    no convierte a nadie en una frutería.
    """
    respuestas = {"usa_codigo_barras": True, "cobra_en_mostrador": True}
    sin_pos = seleccion.sugerir(
        respuestas, modulos_disponibles={"catalogo", "pedidos", "clientes", "inventario"}
    )

    # Sigue siendo la primera opción: describe al negocio igual de bien.
    assert sin_pos[0]["preset"].slug == "ferreteria"
    # Y se dice lo que falta, que es la forma honesta de avisar.
    assert "pos" in sin_pos[0]["modulos_no_cubiertos"]
    assert sin_pos[0]["penalizacion"] > 0


def test_el_alta_por_api_configura_el_negocio(api_owner, negocio):
    preguntas = api_owner.get("/api/business/alta/")
    assert preguntas.status_code == 200
    assert preguntas.data["preguntas"]

    sugeridos = api_owner.post(
        "/api/business/alta/",
        {"senales": {"usa_codigo_barras": True, "cobra_en_mostrador": True}},
        format="json",
    )
    assert sugeridos.data[0]["preset"]["slug"] == "ferreteria"

    adoptado = api_owner.post(
        "/api/business/alta/adoptar/", {"preset": "ferreteria"}, format="json"
    )
    assert adoptado.status_code == 200
    assert adoptado.data["esta_configurado"] is True
    assert puede(negocio, "controla_stock") is True


def test_adoptar_dos_veces_da_conflicto(api_owner):
    api_owner.post("/api/business/alta/adoptar/", {"preset": "mercado"}, format="json")
    segunda = api_owner.post(
        "/api/business/alta/adoptar/", {"preset": "ferreteria"}, format="json"
    )
    assert segunda.status_code == 409


# ==========================================================================
# 5. LA REGLA FUNDAMENTAL
# ==========================================================================
def test_nadie_ramifica_por_sector():
    """
    El test que vigila la regla que sostiene la arquitectura entera.

    En cuanto aparezca un `if perfil.sector == "restaurante"`, añadir un tipo de
    negocio dejará de ser un INSERT y volverá a ser una rama de código — y
    Crynex se habrá convertido en diez aplicaciones dentro de un repositorio,
    que es exactamente lo que no se quiere.

    Se ramifica sobre CAPACIDADES. El sector es una etiqueta para mostrar y
    para puntuar en el alta; nada más.
    """
    raiz = Path(__file__).resolve().parent.parent / "apps"
    hallazgos = subprocess.run(
        ["git", "grep", "-nE", r"sector\s*(==|!=)\s*[\"']", "--", str(raiz)],
        capture_output=True,
        text=True,
        cwd=raiz.parent.parent,
    )
    assert not hallazgos.stdout.strip(), (
        "Alguien está ramificando por sector:\n" + hallazgos.stdout
    )


def test_la_tienda_sabe_si_puede_recibir_pedidos(api, negocio, ferreteria):
    """
    La otra mitad de `acepta_pedidos_online`.

    El servidor ya rechaza el pedido; esto es para que la tienda no llegue a
    ofrecer un boton que va a fallar. Viaja con la configuracion del sitio, que
    la tienda ya pide una vez por pagina.
    """
    antes = api.get("/api/content/site-config/")
    assert antes.data["acepta_pedidos_online"] is True

    servicio.aplicar_preset(negocio, ferreteria)
    despues = api.get("/api/content/site-config/")
    assert despues.data["acepta_pedidos_online"] is False


def test_retirar_un_preset_no_desconfigura_a_quien_lo_adopto(api_plataforma, negocio, ferreteria):
    """
    Retirar archiva; no borra.

    Es el mismo criterio que `Plan`: un preset que alguien adopto ya no es solo
    un molde, es la procedencia de la configuracion de un negocio real.
    Borrarlo pondria `preset_origen` a NULL, el perfil contaria como «sin
    configurar» y el panel le pediria el alta guiada a un cliente que lleva
    meses trabajando.
    """
    perfil = servicio.aplicar_preset(negocio, ferreteria)
    assert perfil.esta_configurado

    respuesta = api_plataforma.delete(f"/api/platform/presets/{ferreteria.slug}/")
    assert respuesta.status_code == 200

    ferreteria.refresh_from_db()
    assert ferreteria.activo is False          # archivado, no borrado
    assert Preset.objects.filter(slug="ferreteria").exists()

    perfil.refresh_from_db()
    assert perfil.esta_configurado             # el cliente no se entera de nada
    assert perfil.puede("controla_stock") is True

    # Y deja de ofrecerse a los negocios nuevos.
    assert all(c["preset"].slug != "ferreteria" for c in seleccion.sugerir({}))


def test_el_perfil_sobrevive_al_borrado_del_preset(negocio, ferreteria):
    """
    La defensa de segunda linea, para el borrado desde el admin de Django.

    `preset_origen` es SET_NULL. La version copiada es un numero y sobrevive,
    asi que el negocio sigue contando como configurado.
    """
    perfil = servicio.aplicar_preset(negocio, ferreteria)
    ferreteria.delete()

    perfil.refresh_from_db()
    assert perfil.preset_origen_id is None
    assert perfil.esta_configurado
