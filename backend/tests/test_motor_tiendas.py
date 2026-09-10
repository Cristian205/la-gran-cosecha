"""
El motor de tiendas: composición, versiones y aislamiento.

Lo que se comprueba no es que los modelos guarden JSON, sino las tres promesas
del diseño: que la estructura visual vive en datos, que publicar y deshacer no
pueden estropear lo que el visitante está viendo, y que la tienda de un negocio
no se cruza jamás con la de otro.
"""
import re
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.storefront import composicion as servicio
from apps.storefront.models import Bloque, Pagina, Plantilla, VersionPagina
from apps.tenancy.context import ambito_de_plataforma, usar_tenant
from apps.tenancy.models import Domain, Membership, Tenant

pytestmark = pytest.mark.django_db


@pytest.fixture
def home(negocio):
    """La página de inicio que dejó la siembra al migrar."""
    return Pagina.objects.get(ruta="/")


@pytest.fixture
def api_staff(negocio):
    usuario = get_user_model().objects.create_user(
        email_usuario="tienda@ejemplo.test",
        nombre_usuario="Editor",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    Membership.objects.create(
        usuario=usuario, tenant=negocio, rol="OWNER", activo=True
    )
    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


# ==========================================================================
# EL TRASLADO: LA HOME DEJÓ DE ESTAR EN CÓDIGO
# ==========================================================================
def test_cada_negocio_nace_con_su_home_publicada(home):
    """
    Antes el inicio salía de `HomePage.tsx` y aparecía solo. Ahora es un dato,
    y un dato que nadie crea no existe: la tienda saldría en blanco.
    """
    publicada = home.publicada
    assert publicada is not None
    assert publicada.estado == VersionPagina.Estado.PUBLICADA
    assert len(publicada.composicion) == 12


def test_los_textos_de_la_home_viven_en_los_bloques(home):
    """
    Los doce campos de copy que vivían en columnas de `StoreSettings` son ahora
    propiedades del bloque que los usa. Es lo que hace que un cuarto paso sea
    un elemento en una lista y no una migración.

    Este negocio nace de la plantilla, así que trae los textos por defecto de
    Crynex. Los negocios que ya existían al migrar reciben los SUYOS: la 0002
    los copia de su configuración a las propiedades de sus bloques.
    """
    bloques = {b["tipo"]: b for b in home.publicada.composicion}

    pasos = bloques["como-funciona"]["props"]["pasos"]
    assert len(pasos) == 3
    assert all(p["titulo"] and p["texto"] for p in pasos)
    assert bloques["cta-banda"]["props"]["titulo"]
    assert bloques["cotizacion-rapida"]["props"]["texto"]


def test_los_pasos_ya_no_son_tres_fijos(home, api_staff):
    """
    El modelo lo decía: «siempre 3 pasos fijos, por eso son campos directos».
    Con seis columnas, un cuarto paso era una migración; ahora es un elemento
    más en una lista.
    """
    composicion = list(home.publicada.composicion)
    for bloque in composicion:
        if bloque["tipo"] == "como-funciona":
            bloque["props"]["pasos"].append(
                {"titulo": "Paga como prefieras", "texto": "Contra entrega o transferencia.", "icono": "shield"}
            )

    respuesta = api_staff.patch(
        f"/api/content/paginas/{home.id}/borrador/",
        {"composicion": composicion},
        format="json",
    )
    assert respuesta.status_code == 200
    guardados = {b["tipo"]: b for b in respuesta.json()["composicion"]}
    assert len(guardados["como-funciona"]["props"]["pasos"]) == 4


def test_un_bloque_nuevo_no_necesita_migracion(home, api_staff):
    """
    La prueba de fuego del motor: reordenar y añadir una sección es guardar
    JSON. Con la home en código, esto era un despliegue.
    """
    composicion = list(home.publicada.composicion)
    composicion.insert(
        0,
        {
            "id": "cta-arriba",
            "tipo": "cta-banda",
            "props": {"titulo": "Envío gratis esta semana"},
        },
    )

    respuesta = api_staff.patch(
        f"/api/content/paginas/{home.id}/borrador/",
        {"composicion": composicion},
        format="json",
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["composicion"][0]["tipo"] == "cta-banda"
    # Lo publicado no se movió: sigue habiendo doce y el primero es el carrusel.
    assert home.publicada.composicion[0]["tipo"] == "carrusel-promociones"


# ==========================================================================
# VALIDACIÓN: LO QUE NO SE DEJA GUARDAR
# ==========================================================================
def test_un_bloque_inexistente_se_rechaza():
    """
    Un tipo mal escrito se guardaría sin queja y la sección desaparecería de la
    tienda sin que nadie supiera por qué.
    """
    with pytest.raises(Exception, match="no existe en el catálogo"):
        servicio.validar([{"tipo": "seccion-inventada"}])


def test_un_bloque_unico_no_se_puede_repetir():
    """Dos carruseles de promociones son un JSON válido y una tienda rota."""
    with pytest.raises(Exception, match="una vez"):
        servicio.validar(
            [{"tipo": "carrusel-promociones"}, {"tipo": "carrusel-promociones"}]
        )


def test_dos_bloques_con_el_mismo_id_se_rechazan():
    """Si el id se repite, arrastrar un bloque en el editor movería dos."""
    with pytest.raises(Exception, match="identificador"):
        servicio.validar(
            [
                {"id": "x", "tipo": "testimonios"},
                {"id": "x", "tipo": "estadisticas"},
            ]
        )


def test_una_variante_que_el_bloque_no_tiene_se_rechaza():
    with pytest.raises(Exception, match="variante"):
        servicio.validar(
            [{"tipo": "productos-destacados", "variante": "espiral"}]
        )


def test_la_composicion_se_normaliza_al_validar():
    """
    El lienzo asume que todo bloque trae id, props y visible. Normalizar aquí
    es lo que le evita defenderse en cada punto de un JSON escrito a mano.
    """
    [bloque] = servicio.validar([{"tipo": "testimonios"}])
    assert bloque["id"]
    assert bloque["props"] == {}
    assert bloque["visible"] == {"movil": True, "tablet": True, "escritorio": True}


# ==========================================================================
# BORRADOR, PUBLICAR, DESHACER
# ==========================================================================
def test_el_borrador_nace_copiando_lo_publicado(home):
    """Quien entra a editar quiere retocar su tienda, no empezar de cero."""
    borrador = servicio.obtener_borrador(home)
    assert borrador.composicion == home.publicada.composicion
    assert borrador.numero > home.publicada.numero


def test_publicar_archiva_la_anterior_y_deja_una_sola_viva(home, api_staff):
    anterior = home.publicada
    servicio.obtener_borrador(home)

    respuesta = api_staff.post(f"/api/content/paginas/{home.id}/publicar/")
    assert respuesta.status_code == 200

    anterior.refresh_from_db()
    assert anterior.estado == VersionPagina.Estado.ARCHIVADA
    assert home.versiones.filter(estado=VersionPagina.Estado.PUBLICADA).count() == 1
    assert home.borrador is None


def test_restaurar_no_toca_lo_que_ven_los_visitantes(home, api_staff):
    """
    Deshacer trae la versión vieja al BORRADOR. Publicarla es otra decisión, y
    tiene que serlo: restaurar no puede cambiar la tienda en vivo de un clic.
    """
    original = list(home.publicada.composicion)
    numero_original = home.publicada.numero

    borrador = servicio.obtener_borrador(home)
    borrador.composicion = servicio.validar([{"tipo": "testimonios"}])
    borrador.save(update_fields=["composicion"])
    servicio.publicar(home)

    respuesta = api_staff.post(
        f"/api/content/paginas/{home.id}/restaurar/{numero_original}/"
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == VersionPagina.Estado.BORRADOR
    assert home.borrador.composicion == original
    # Lo publicado sigue siendo la versión corta.
    assert len(home.publicada.composicion) == 1


def test_el_flujo_completo_del_constructor(home, api_staff):
    """
    Lo que hace el cliente de principio a fin, tal como lo llama la pantalla.

    Componer, guardar, previsualizar, publicar, arrepentirse y recuperar. Cada
    paso es una llamada distinta y el orden importa: el fallo que esto vigila
    es que publicar o restaurar toquen lo que no deben.
    """
    # 1. Abre el constructor: el borrador nace copiando lo publicado.
    borrador = api_staff.get(f"/api/content/paginas/{home.id}/borrador/").json()
    assert len(borrador["composicion"]) == 12

    # 2. Recorta su página y la guarda. Nadie lo ve todavía.
    recortada = borrador["composicion"][:3]
    guardado = api_staff.patch(
        f"/api/content/paginas/{home.id}/borrador/",
        {"composicion": recortada},
        format="json",
    )
    assert guardado.status_code == 200
    assert len(home.publicada.composicion) == 12  # la tienda sigue entera

    # 3. La vista previa sí enseña el borrador a quien puede editarlo.
    previa = api_staff.get("/api/storefront/pagina/?ruta=/&borrador=1").json()
    assert len(previa["bloques"]) == 3

    # 4. Publica.
    assert api_staff.post(f"/api/content/paginas/{home.id}/publicar/").status_code == 200
    assert len(home.publicada.composicion) == 3

    # 5. Se arrepiente: el historial conserva la versión larga archivada.
    historial = api_staff.get(f"/api/content/paginas/{home.id}/versiones/").json()
    larga = next(v for v in historial if len(v["composicion"]) == 12)
    assert larga["estado"] == "ARCHIVADA"

    # 6. La recupera. Vuelve al BORRADOR, no a la tienda en vivo.
    vuelta = api_staff.post(
        f"/api/content/paginas/{home.id}/restaurar/{larga['numero']}/"
    ).json()
    assert vuelta["estado"] == "BORRADOR"
    assert len(vuelta["composicion"]) == 12
    assert len(home.publicada.composicion) == 3


# ==========================================================================
# LA TIENDA PÚBLICA
# ==========================================================================
def test_el_visitante_recibe_lo_publicado_y_nunca_el_borrador(api, home):
    borrador = servicio.obtener_borrador(home)
    borrador.composicion = servicio.validar([{"tipo": "testimonios"}])
    borrador.save(update_fields=["composicion"])

    datos = api.get("/api/storefront/pagina/?ruta=/").json()
    assert len(datos["bloques"]) == 12
    assert datos["version"]["estado"] == VersionPagina.Estado.PUBLICADA


def test_pedir_el_borrador_sin_permiso_devuelve_lo_publicado(api, home):
    """
    Sin esta comprobación, cualquiera leería los cambios sin publicar de
    cualquier tienda cambiando un parámetro de la URL.
    """
    borrador = servicio.obtener_borrador(home)
    borrador.composicion = servicio.validar([{"tipo": "testimonios"}])
    borrador.save(update_fields=["composicion"])

    datos = api.get("/api/storefront/pagina/?ruta=/&borrador=1").json()
    assert len(datos["bloques"]) == 12


def test_la_respuesta_publica_dice_que_bloques_van_a_sangre(api, home):
    """
    `a_sangre` sale del catálogo y no de la composición guardada: si se hubiera
    copiado al JSON, cambiar un bloque de ancho obligaría a reescribir las mil
    composiciones que lo usan.
    """
    bloques = api.get("/api/storefront/pagina/?ruta=/").json()["bloques"]
    assert bloques[0]["tipo"] == "carrusel-promociones"
    assert bloques[0]["a_sangre"] is True
    assert bloques[1]["a_sangre"] is False


def test_una_ruta_que_no_existe_da_404(api):
    assert api.get("/api/storefront/pagina/?ruta=/inventada").status_code == 404


# ==========================================================================
# MULTI-TENANT: NINGUNA TIENDA VE LA DE OTRA
# ==========================================================================
def test_dos_negocios_tienen_su_propia_home(negocio):
    """
    Es la promesa que sostiene todo: la misma aplicación de React sirve las
    dos, y lo único que las distingue son sus datos.
    """
    otro = Tenant.objects.create(
        slug="perfumeria", nombre="Perfumería Luna", estado="ACTIVO"
    )
    Domain.objects.create(tenant=otro, hostname="perfumeria.test", es_primario=True)

    with usar_tenant(otro):
        suya = Pagina.objects.get(ruta="/")
        assert suya.tenant_id == otro.id
        assert suya.publicada is not None

        suya_borrador = servicio.obtener_borrador(suya)
        suya_borrador.composicion = servicio.validar([{"tipo": "testimonios"}])
        suya_borrador.save(update_fields=["composicion"])
        servicio.publicar(suya)

    # La del negocio original no se movió.
    with usar_tenant(negocio):
        assert len(Pagina.objects.get(ruta="/").publicada.composicion) == 12


def test_el_staff_de_un_negocio_no_alcanza_las_paginas_de_otro(api_staff):
    """
    El listado va acotado por el mixin de tenancy. Sin eso, editar una tienda
    daría acceso a la de cualquier otro cliente.
    """
    otro = Tenant.objects.create(slug="ajena", nombre="Ajena", estado="ACTIVO")
    with usar_tenant(otro):
        ajena = Pagina.objects.get(ruta="/")

    respuesta = api_staff.get("/api/content/paginas/")
    cuerpo = respuesta.json()
    ids = {p["id"] for p in cuerpo.get("results", cuerpo)}
    assert ajena.id not in ids
    assert api_staff.get(f"/api/content/paginas/{ajena.id}/").status_code == 404


def test_administrar_una_tienda_no_da_acceso_al_catalogo_de_crynex(api_staff):
    """Los bloques y las plantillas son de la plataforma, no de un cliente."""
    for ruta in ("blocks", "themes", "templates"):
        assert api_staff.get(f"/api/platform/{ruta}/").status_code == 403


# ==========================================================================
# EL ALTA DE UN CLIENTE, DESDE EL CONTROL CENTER
# ==========================================================================
@pytest.fixture
def api_crynex(negocio):
    usuario = get_user_model().objects.create_user(
        email_usuario="alta@ejemplo.test",
        nombre_usuario="Equipo Crynex",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    usuario.es_staff_plataforma = True
    usuario.save(update_fields=["es_staff_plataforma"])
    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


def test_dar_de_alta_una_empresa_la_deja_lista_para_vender(api_crynex):
    """
    Un cliente nuevo nace entero: con dominio, plan y tienda publicada.

    Es un flujo y no un `create` de ModelViewSet porque tres señales distintas
    montan las piezas. Lo que esta prueba vigila es que no falte ninguna: una
    empresa con plan pero sin tienda, o con tienda pero sin dominio, es peor que
    no haberla creado.
    """
    respuesta = api_crynex.post(
        "/api/platform/tenants/",
        {
            "nombre": "Perfumería Luna",
            "slug": "perfumeria-luna",
            "dominio": "luna.ejemplo.test",
            "plan": "growth",
            "plantilla": "mercado",
            "estado": "ACTIVO",
        },
        format="json",
    )
    assert respuesta.status_code == 201

    with ambito_de_plataforma():
        nueva = Tenant.objects.get(slug="perfumeria-luna")
        assert [d.hostname for d in nueva.dominios.all()] == ["luna.ejemplo.test"]
        assert nueva.suscripcion.plan.slug == "growth"

    with usar_tenant(nueva):
        assert Pagina.objects.get(ruta="/").publicada is not None


def test_no_se_pueden_dar_de_alta_dos_empresas_con_el_mismo_identificador(
    api_crynex, negocio
):
    respuesta = api_crynex.post(
        "/api/platform/tenants/",
        {"nombre": "Otra", "slug": negocio.slug},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "identificador" in str(respuesta.json())


def test_un_dominio_no_puede_apuntar_a_dos_empresas(api_crynex, negocio):
    """Dos negocios en el mismo host harían imposible resolver cuál atiende."""
    respuesta = api_crynex.post(
        "/api/platform/tenants/",
        {"nombre": "Otra", "slug": "otra", "dominio": "testserver"},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "dominio" in str(respuesta.json()).lower()


def test_el_alta_es_atomica(api_crynex):
    """
    Un dominio repetido no puede dejar la empresa a medias.

    Sin la transacción, el `Tenant` quedaría creado —con sus señales ya
    disparadas— y el alta habría fallado: un cliente fantasma en la lista.
    """
    api_crynex.post(
        "/api/platform/tenants/",
        {"nombre": "Primera", "slug": "primera", "dominio": "repetido.test"},
        format="json",
    )
    respuesta = api_crynex.post(
        "/api/platform/tenants/",
        {"nombre": "Segunda", "slug": "segunda", "dominio": "repetido.test"},
        format="json",
    )
    assert respuesta.status_code == 400
    with ambito_de_plataforma():
        assert not Tenant.objects.filter(slug="segunda").exists()


def test_crynex_puede_asignar_una_plantilla_a_un_cliente(api_crynex, home):
    """
    La misma operación que hace el cliente desde su panel, pero por él.

    Por defecto no publica: deja el borrador para que alguien lo revise antes
    de que lo vean los visitantes.
    """
    respuesta = api_crynex.post(
        f"/api/platform/tenants/{home.tenant_id}/aplicar-plantilla/",
        {"plantilla": "mercado", "publicar": False},
        format="json",
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["publicadas"] is False
    assert home.borrador is not None


def test_administrar_un_negocio_no_permite_dar_de_alta_empresas(api_staff):
    """Crear clientes es de Crynex, no de un cliente."""
    respuesta = api_staff.post(
        "/api/platform/tenants/",
        {"nombre": "Colada", "slug": "colada"},
        format="json",
    )
    assert respuesta.status_code == 403


# ==========================================================================
# PLANTILLAS
# ==========================================================================
def test_adoptar_una_plantilla_no_pisa_lo_publicado(negocio, home):
    """
    Se copia al borrador, nunca encima de la tienda en vivo. Cambiar de
    plantilla tiene que poder revisarse antes de que lo vea nadie.
    """
    plantilla = Plantilla.objects.get(slug="mercado")
    plantilla.paginas = {"/": servicio.validar([{"tipo": "testimonios"}])}
    plantilla.save(update_fields=["paginas"])

    servicio.adoptar_plantilla(negocio, plantilla)

    assert len(home.borrador.composicion) == 1
    assert len(home.publicada.composicion) == 12


def test_la_plantilla_se_copia_y_no_se_referencia(negocio, home):
    """
    Si la página apuntara a la plantilla, que Crynex retocara «Mercado»
    reescribiría la tienda publicada de todos los clientes que la usan.
    """
    plantilla = Plantilla.objects.get(slug="mercado")
    servicio.adoptar_plantilla(negocio, plantilla, publicar_ya=True)
    antes = list(home.publicada.composicion)

    plantilla.paginas = {"/": servicio.validar([{"tipo": "estadisticas"}])}
    plantilla.save(update_fields=["paginas"])

    home.refresh_from_db()
    assert home.publicada.composicion == antes


# ==========================================================================
# EL CONTRATO ENTRE EL CATÁLOGO Y EL FRONTEND
# ==========================================================================
#
# Estas dos pruebas leen ficheros del frontend desde Python, que no es lo
# habitual. Se hace porque el fallo que evitan ya ocurrió: la siembra declaró
# variantes que ningún componente implementaba, así que el catálogo prometía
# un desplegable que no cambiaba nada. Ese desajuste no lo detecta ninguna
# prueba de Django ni de TypeScript por separado —cada lado es correcto por su
# cuenta—, solo una que mire los dos a la vez.

RAIZ_TIENDA = Path(__file__).resolve().parents[2] / "frontend" / "tienda"


def test_cada_bloque_del_catalogo_tiene_componente_en_el_registro():
    """
    Un `codigo` sin entrada en el registro no pinta nada: el lienzo lo salta en
    silencio y la sección desaparece de la tienda.
    """
    registro = (RAIZ_TIENDA / "src" / "bloques" / "registro.tsx").read_text(
        encoding="utf-8"
    )
    # Las claves del objeto REGISTRO, con o sin comillas.
    declarados = set(re.findall(r'^\s+"?([a-z0-9-]+)"?:\s+\w+ as Bloque,', registro, re.M))

    faltan = set(Bloque.objects.values_list("codigo", flat=True)) - declarados
    assert not faltan, f"bloques sin componente: {sorted(faltan)}"


def test_cada_variante_declarada_tiene_estilo_que_la_aplique():
    """
    Una variante sin CSS es un desplegable que no hace nada.

    La convención es `<rejilla>--<variante>`: el componente compone la clase
    con `claseDeVariante()` y la hoja de estilos la define. La variante por
    defecto de cada bloque no necesita regla —no cambia nada— así que solo se
    exige la primera.
    """
    css = (RAIZ_TIENDA / "src" / "app" / "global.css").read_text(encoding="utf-8")

    sin_estilo = []
    for bloque in Bloque.objects.exclude(variantes=[]):
        # La primera es la de por defecto y se ve sin regla propia.
        for variante in bloque.codigos_de_variante() - {
            bloque.variantes[0]["codigo"]
        }:
            if f"--{variante}" not in css:
                sin_estilo.append(f"{bloque.codigo}:{variante}")

    assert not sin_estilo, f"variantes sin estilo: {sorted(sin_estilo)}"


def test_el_catalogo_declara_bloques_que_el_frontend_conoce():
    """
    Cada fila del catálogo nombra un componente del registro de React.

    Se lee el REGISTRO de verdad, no una lista copiada aquí. La diferencia
    importa: una lista escrita a mano hay que acordarse de actualizarla, y de
    eso justamente no se acuerda nadie — así que el test acabaría midiendo si
    alguien tocó el test, no si el contrato se cumple.

    Una fila sin componente detrás es una sección que se puede colocar desde el
    constructor y que no pinta nada. Es el fallo más difícil de diagnosticar del
    motor, porque no da ningún error: solo falta un trozo de la página.
    """
    registro = (RAIZ_TIENDA / "src" / "bloques" / "registro.tsx").read_text(
        encoding="utf-8"
    )
    # Las claves del mapa: `"codigo": Componente as Bloque,`. Las comillas son
    # opcionales en JS cuando la clave no lleva guiones, y el archivo usa las
    # dos formas: exigirlas daria un falso positivo en `testimonios`.
    conocidos = set(
        re.findall(r'^\s*"?([a-z0-9-]+)"?:\s*\w+ as Bloque,', registro, re.M)
    )

    declarados = set(Bloque.objects.values_list("codigo", flat=True))

    sin_componente = declarados - conocidos
    assert not sin_componente, (
        f"El catálogo ofrece bloques que React no sabe pintar: {sorted(sin_componente)}"
    )

    # Al revés solo se avisa: el backend y el frontend se despliegan por
    # separado, así que un componente puede llegar antes que su fila.
    sin_declarar = conocidos - declarados
    assert not sin_declarar, (
        f"Hay componentes que nadie puede colocar: {sorted(sin_declarar)}"
    )


def test_toda_plantilla_sembrada_es_una_composicion_valida():
    """
    Una plantilla con un bloque mal escrito se adopta y deja la pagina coja.

    `adoptar_plantilla` valida al copiar, asi que el fallo no aparece al sembrar
    sino la primera vez que un negocio la elige — y para entonces ya esta en
    produccion. Esto lo mueve al momento de escribirla.

    Cubre todas, no solo la ultima: la comprobacion vale igual para la que venga
    despues, y una lista de nombres habria que acordarse de ampliarla.
    """
    from apps.storefront.composicion import validar
    from apps.storefront.models import Plantilla

    for plantilla in Plantilla.objects.all():
        for ruta, composicion in (plantilla.paginas or {}).items():
            try:
                validar(composicion)
            except Exception as error:  # noqa: BLE001
                pytest.fail(f"«{plantilla.slug}» en «{ruta}»: {error}")


def test_la_plantilla_de_la_gran_cosecha_compone_el_diseno():
    """
    Las cinco piezas del diseno, en orden, y ninguna escrita en codigo.

    Es la prueba de que el reparto esta bien puesto: de una portada entera, lo
    unico que hubo que programar son dos componentes; el titular, los cuatro
    publicos y los cuatro pasos son datos.
    """
    from apps.storefront.models import Plantilla

    plantilla = Plantilla.objects.get(slug="la-gran-cosecha")
    home = plantilla.paginas["/"]
    tipos = [b["tipo"] for b in home]

    assert tipos[:4] == [
        "portada",
        "publicos-objetivo",
        "como-funciona",
        "insignias-confianza",
    ]
    # No es la de arranque: un negocio nuevo no deberia estrenar la portada
    # pensada para un mayorista concreto.
    assert plantilla.es_predeterminada is False

    portada = home[0]["props"]
    assert len(portada["ventajas"]) == 4
    assert home[1]["props"]["publicos"][0]["titulo"] == "Restaurantes"
    # Los pasos van en fila y numerados: es una variante, no un bloque nuevo.
    assert home[2]["variante"] == "linea"
    assert len(home[2]["props"]["pasos"]) == 4


# ==========================================================================
# EL ARMAZON: LA CABECERA Y EL PIE, EDITABLES
# ==========================================================================
def test_el_armazon_no_es_una_ruta_visitable(api, negocio):
    """
    `/_layout` es una composicion, no una pagina.

    Si entrara en el listado de rutas publicas, Next generaria una pagina con
    la cabecera y el pie sueltos, y el buscador acabaria indexandola.
    """
    from apps.storefront.models import Pagina

    assert Pagina.objects.filter(ruta="/_layout", tipo="LAYOUT").exists()

    respuesta = api.get("/api/storefront/rutas/")
    assert respuesta.status_code == 200
    assert "/_layout" not in respuesta.data["rutas"]

    # Pero SI se puede pedir por su ruta: es lo que hace el layout de Next.
    composicion = api.get("/api/storefront/pagina/?ruta=/_layout")
    assert composicion.status_code == 200
    assert [b["tipo"] for b in composicion.data["bloques"]] == ["cabecera", "pie"]


def test_todo_negocio_hereda_el_menu_que_estaba_en_codigo(negocio):
    """
    Los enlaces vivian en `lib/navegacion.ts` como una constante de cuatro
    entradas. Ahora son datos, y lo primero que hay que garantizar es que
    nadie note el cambio: la tienda de ayer se ve igual hoy.
    """
    from apps.storefront.models import Pagina

    armazon = Pagina.objects.get(ruta="/_layout")
    bloques = armazon.publicada.composicion
    cabecera = next(b for b in bloques if b["tipo"] == "cabecera")

    assert [e["href"] for e in cabecera["props"]["enlaces"]] == [
        "/", "/tienda", "/nosotros", "/contacto",
    ]


def test_adoptar_una_plantilla_marca_bien_el_armazon(negocio):
    """
    El fallo que se colaba: `adoptar_plantilla` daba tipo LIBRE a todo lo que
    no fuera «/», y entonces `/_layout` acababa en las rutas publicas.
    """
    from apps.storefront.composicion import adoptar_plantilla
    from apps.storefront.models import Pagina, Plantilla

    Pagina.objects.filter(ruta="/_layout").delete()
    adoptar_plantilla(negocio, Plantilla.objects.get(slug="la-gran-cosecha"))

    assert Pagina.objects.get(ruta="/_layout").tipo == "LAYOUT"


def test_la_plantilla_de_la_gran_cosecha_trae_todas_sus_paginas():
    """Una plantilla que solo compone la home deja el resto sin administrar."""
    from apps.storefront.models import Plantilla

    plantilla = Plantilla.objects.get(slug="la-gran-cosecha")
    assert set(plantilla.paginas) == {"/", "/_layout", "/nosotros", "/contacto"}

    armazon = [b["tipo"] for b in plantilla.paginas["/_layout"]]
    assert armazon == ["cabecera", "pie"]


def test_todo_bloque_se_puede_ocultar_por_dispositivo():
    """
    La visibilidad es del bloque, no del tipo de bloque.

    Incluye la cabecera y el pie: un negocio puede querer el buscador solo en
    escritorio, o esconder la llamada final en movil, donde ya hay barra de
    navegacion abajo.
    """
    from apps.storefront.composicion import validar

    salida = validar([
        {"tipo": "cabecera", "visible": {"movil": False, "tablet": True, "escritorio": True}},
        {"tipo": "pie"},
    ])
    assert salida[0]["visible"] == {"movil": False, "tablet": True, "escritorio": True}
    # Lo que no se declara se rellena: el lienzo asume que las tres claves estan.
    assert salida[1]["visible"] == {"movil": True, "tablet": True, "escritorio": True}


def test_todo_aspecto_de_tarjeta_esta_dibujado():
    """
    Un aspecto sin CSS es un desplegable que no hace nada.

    Es el mismo guardia que ya protege las variantes de bloque, un nivel mas
    abajo: los datos NOMBRAN el aspecto y la hoja lo dibuja. La opcion por
    defecto no necesita reglas propias —es lo que la tarjeta ya es— asi que se
    exige desde la segunda.

    Sin esto, anadir «premium» al token seria una linea que se ve en Apariencia,
    se puede elegir, se guarda... y no cambia nada. Que es peor que no ofrecerla.
    """
    from apps.storefront.models import TokenTema

    token = TokenTema.objects.filter(codigo="estilo-tarjeta").first()
    assert token is not None, "El token del estilo de tarjeta no esta sembrado"

    css = (RAIZ_TIENDA / "src" / "app" / "global.css").read_text(encoding="utf-8")
    valores = [o["valor"] for o in token.opciones]
    assert valores[0] == token.valor_por_defecto

    sin_dibujar = [
        valor for valor in valores[1:] if f'[data-tarjeta="{valor}"]' not in css
    ]
    assert not sin_dibujar, f"aspectos de tarjeta sin estilo: {sin_dibujar}"


def test_el_frontend_conoce_los_mismos_aspectos_que_el_catalogo():
    """
    La lista vive en dos sitios —el token en la base y `ESTILOS_DE_TARJETA` en
    `tema.ts`— porque el frontend tiene que poder rechazar un valor que no sabe
    dibujar. Lo que no puede es que las dos listas se separen: un aspecto que el
    negocio elige y el frontend descarta cae al estandar en silencio.
    """
    import re

    from apps.storefront.models import TokenTema

    token = TokenTema.objects.get(codigo="estilo-tarjeta")
    fuente = (RAIZ_TIENDA / "src" / "lib" / "tema.ts").read_text(encoding="utf-8")

    bloque = re.search(
        r"const ESTILOS_DE_TARJETA = \[(.*?)\]", fuente, re.S
    )
    assert bloque, "No se encontro ESTILOS_DE_TARJETA en tema.ts"
    conocidos = set(re.findall(r'"([a-z-]+)"', bloque.group(1)))

    assert conocidos == {o["valor"] for o in token.opciones}


def test_el_negocio_elige_el_aspecto_de_sus_tarjetas(api_staff, negocio):
    """
    El eslabon que faltaba.

    El token existia, la hoja lo dibujaba y el endpoint mandaba el catalogo,
    pero el panel del negocio no tenia donde elegirlo: solo Crynex podia, y
    solo desde una plantilla. Una opcion a la que nadie llega no esta entregada.
    """
    from apps.content.models import StoreSettings

    catalogo = api_staff.get("/api/content/constructor/")
    assert catalogo.status_code == 200
    codigos = {t["codigo"] for t in catalogo.data["tokens"]}
    assert "estilo-tarjeta" in codigos

    guardado = api_staff.patch(
        "/api/content/site-config/",
        {"tokens": {"estilo-tarjeta": "editorial"}},
        format="json",
    )
    assert guardado.status_code == 200

    config = StoreSettings.objects.get(tenant=negocio)
    assert config.tokens["estilo-tarjeta"] == "editorial"

    # Y llega resuelto a la tienda, que es quien lo estampa en el <body>.
    publico = api_staff.get("/api/content/site-config/")
    assert publico.data["variables_tema"]["--estilo-tarjeta"] == "editorial"


#: Tokens cuya variable CSS no se consume con `var(...)`, y por que.
#:
#: La regla del motor es que un token cuya variable nadie lee se puede
#: configurar y no cambia nada — una perilla suelta que ensena a desconfiar del
#: resto del panel. Cada excepcion es una decision, no un olvido.
TOKENS_SIN_VARIABLE = {
    "estilo-tarjeta": (
        "Nombra un ASPECTO, no un valor. Una variable CSS no puede decidir "
        "donde va el precio ni si hay foto, asi que el valor resuelto viaja "
        "como atributo `data-tarjeta` en el <body> y la hoja define los cinco. "
        "Lo cubre `test_todo_aspecto_de_tarjeta_esta_dibujado`."
    ),
    "caja-disposicion": (
        "Lo mismo un piso mas abajo: nombra una MAQUETA —donde va el carrito— "
        "y una variable CSS no mueve un panel de sitio. Viaja como atributo "
        "`data-caja` y la hoja del panel define los tres repartos. Lo cubre "
        "`test_todo_reparto_de_la_caja_esta_dibujado`."
    ),
}

#: Las hojas donde un token puede consumirse. Son dos porque el tema del
#: negocio viste DOS superficies: su tienda y su caja. Que el catalogo sea uno
#: solo es deliberado —un negocio tiene una identidad, no dos— y esta explicado
#: en `TokenTema.Grupo.CAJA`.
HOJAS = (
    RAIZ_TIENDA / "src" / "app" / "global.css",
    RAIZ_TIENDA.parent / "admin-panel" / "src" / "index.css",
)


def test_todo_token_del_tema_lo_consume_la_hoja():
    """
    Un token cuya variable nadie lee es una perilla que no hace nada.

    Es la regla que el propio motor documenta —«crear un token obliga a usarlo
    alli»— y hasta ahora no la comprobaba nadie. Con el panel de Apariencia ya
    en manos del negocio pesa mas: cada token es una fila que alguien va a
    mover esperando ver algo.
    """
    from apps.storefront.models import TokenTema

    css = "".join(h.read_text(encoding="utf-8") for h in HOJAS)

    huerfanos = sorted(
        f"{t.codigo} ({t.variable_css})"
        for t in TokenTema.objects.filter(activo=True)
        if t.codigo not in TOKENS_SIN_VARIABLE
        and f"var({t.variable_css}" not in css
    )
    assert not huerfanos, (
        "Estos tokens se pueden configurar y no cambian nada: "
        f"{huerfanos}. Consumelos en la hoja de la tienda o en la del panel, "
        "o declaralos en TOKENS_SIN_VARIABLE con la razon."
    )


def test_todo_reparto_de_la_caja_esta_dibujado():
    """
    Un reparto que la hoja del panel no conoce deja la caja sin maquetar.

    Es el gemelo de `test_todo_aspecto_de_tarjeta_esta_dibujado`, y existe por
    lo mismo: `caja-disposicion` no viaja como variable sino como atributo, asi
    que el guardia de los tokens no lo alcanza. Sin esto, anadir un cuarto
    reparto al catalogo daria una opcion elegible que no cambia nada.
    """
    from apps.pos.aspecto import DISPOSICIONES
    from apps.storefront.models import TokenTema

    css = (RAIZ_TIENDA.parent / "admin-panel" / "src" / "index.css").read_text(
        encoding="utf-8"
    )

    token = TokenTema.objects.filter(codigo="caja-disposicion", activo=True).first()
    assert token is not None, "El catalogo perdio `caja-disposicion`."

    ofrecidos = {o["valor"] for o in (token.opciones or [])}
    # Lo que el catalogo ofrece tiene que estar en la lista blanca del servidor,
    # o el valor se descartaria en silencio y la caja caeria al reparto de
    # siempre sin que nadie entendiera por que.
    assert ofrecidos <= set(DISPOSICIONES), (
        f"El catalogo ofrece repartos que el servidor descarta: "
        f"{sorted(ofrecidos - set(DISPOSICIONES))}"
    )

    # El primero es el de por defecto y no necesita regla propia: es la reja
    # base de `.caja-reparto`. Mismo criterio que las variantes de bloque.
    sin_dibujar = sorted(
        d for d in list(DISPOSICIONES)[1:] if f'data-caja="{d}"' not in css
    )
    assert not sin_dibujar, (
        f"Repartos que se pueden elegir y no cambian nada: {sin_dibujar}"
    )


def test_ninguna_excepcion_de_token_sobra():
    """Una excepcion que ya no aplica hace creer que hay una decision detras."""
    from apps.storefront.models import TokenTema

    codigos = set(TokenTema.objects.values_list("codigo", flat=True))
    sobran = sorted(set(TOKENS_SIN_VARIABLE) - codigos)
    assert not sobran, f"Excepciones de tokens que ya no existen: {sobran}"


# ==========================================================================
# EL ENLACE DE PRUEBA
# ==========================================================================
def test_el_enlace_de_prueba_no_escribe_nada_en_el_negocio(negocio):
    """
    La promesa entera de esta funcion, y la que se rompe sola en cuanto alguien
    la "optimice" asignando la plantilla para poder mirarla.

    Ensenar algo no puede costar modificarlo: si la previa escribiera, cada vez
    que Crynex quisiera ensenarle una plantilla a un cliente le crearia
    borradores en cada ruta y le cambiaria el color de marca, y deshacerlo
    despues no devuelve el estado anterior.
    """
    from apps.storefront import vista_previa
    from apps.storefront.models import Pagina, Plantilla

    plantilla = Plantilla.objects.filter(slug="belleza").first()
    assert plantilla is not None, "La 0015 dejo de sembrar «belleza»."

    antes_paginas = Pagina.all_tenants.filter(tenant=negocio).count()

    testigo = vista_previa.firmar(tenant_id=negocio.pk, plantilla_slug="belleza")
    assert vista_previa.abrir(testigo, tenant_id=negocio.pk) == "belleza"

    assert Pagina.all_tenants.filter(tenant=negocio).count() == antes_paginas


def test_un_testigo_no_vale_para_otro_negocio():
    """
    Sin esta comprobacion, un enlace valido para una empresa serviria para
    forzar la maqueta en cualquier otra cambiando el dominio. El enlace acaba en
    chats y correos: hay que asumir que lo lee quien no deberia.
    """
    from apps.storefront import vista_previa

    testigo = vista_previa.firmar(tenant_id=1, plantilla_slug="belleza")
    assert vista_previa.abrir(testigo, tenant_id=2) is None


def test_un_testigo_manipulado_no_abre_nada():
    """Falla cerrado y sin lanzar: quien abre un enlace roto ve la tienda
    normal, no una pagina de error que no sabria interpretar."""
    from apps.storefront import vista_previa

    assert vista_previa.abrir("no-es-un-testigo", tenant_id=1) is None
    assert vista_previa.abrir("", tenant_id=1) is None


# ==========================================================================
# EL VOCABULARIO DE DISENO NO LLEVA EL NOMBRE DE NINGUN CLIENTE
# ==========================================================================
def _reglas_de_la_hoja() -> str:
    """
    La hoja de la tienda SIN sus comentarios.

    Mismo motivo que `tests/inspeccion.py` con los docstrings de Python: los
    dos guardias de aqui abajo buscan patrones que la propia hoja explica en
    prosa —cuenta por que la escala ya no se llama `--verde-*`— y sin recortar
    los comentarios se denunciarian a si mismos. Un guardia que denuncia de mas
    se acaba desactivando, que es peor que no tenerlo.
    """
    hoja = (
        Path(__file__).resolve().parents[2]
        / "frontend" / "tienda" / "src" / "app" / "global.css"
    )
    fuente = hoja.read_text(encoding="utf-8")
    # CSS solo tiene comentarios de bloque, asi que basta con este recorte.
    return re.sub(r"/\*.*?\*/", "", fuente, flags=re.S)


def test_la_hoja_de_la_tienda_no_nombra_colores_concretos():
    """
    El guardia del paso 1 del rediseno del motor.

    Hasta la fase 12 la escala de marca se llamaba `--verde-*` y la secundaria
    `--ambar-*`, porque la primera tienda del sistema era una empresa agricola.
    Nada fallaba: el rosa de una boutique se guardaba, se resolvia y se pintaba
    bien. Pero se guardaba en una variable llamada «verde», y `global.css`
    tenia que dedicar un parrafo a explicar que ese nombre no significaba lo
    que decia.

    Un nombre que hay que desmentir con un comentario es un nombre equivocado,
    y ademas marcaba el rumbo: cada plantilla nueva heredaba el vocabulario de
    la primera, que es la forma mas sutil del acoplamiento entre tiendas.

    Este test existe porque el fallo es facil de reintroducir sin querer: quien
    anada `--rosa-500` para la boutique lo hara con la mejor intencion y con el
    mismo resultado. Los nombres del sistema dicen que PAPEL cumple el color
    —marca, acento, superficie—, nunca de que color es.
    """
    colores = "verde|rojo|azul|amarillo|rosa|naranja|morado|violeta|ambar|turquesa"
    hallazgos = sorted(
        set(re.findall(rf"--(?:{colores})-[a-z0-9]+", _reglas_de_la_hoja()))
    )

    assert not hallazgos, (
        "Hay variables de tema nombradas por su color en vez de por su papel: "
        + ", ".join(hallazgos)
    )


def test_la_hoja_de_la_tienda_no_tiene_sombras_de_un_color_escrito():
    """
    El mismo defecto un piso mas abajo, y este se habia colado quince veces.

    Las sombras estaban escritas como `rgba(6, 46, 26, ...)` —un verde muy
    oscuro— en quince sitios, asi que toda tienda del motor proyectaba sombras
    verdes sin que nadie lo hubiera decidido. Ahora salen de `--sombra-tinte`,
    que conserva ese mismo valor por defecto: no cambia como se ve ninguna
    tienda, pero deja de ser una decision inamovible.
    """
    reglas = _reglas_de_la_hoja()

    assert "--sombra-tinte" in reglas, "Desaparecio el tinte de sombra configurable."
    assert "rgba(6, 46, 26" not in reglas, (
        "Volvio a escribirse el verde de La Gran Cosecha dentro de una sombra."
    )


# ==========================================================================
# EL ESTILO POR BLOQUE
# ==========================================================================
def _bloque_con(tipo, estilo):
    return [{"id": "b1", "tipo": tipo, "props": {}, "estilo": estilo}]


def test_un_bloque_puede_traer_su_propio_aspecto():
    """
    Lo que desbloquea el paso 2: hasta la fase 12 el aspecto era una decision
    de la tienda ENTERA —un unico `:root`— asi que un pie oscuro sobre una
    pagina clara no era una configuracion, era un despliegue.
    """
    salida = servicio.validar(_bloque_con("testimonios", {"bloque-fondo": "#101010"}))
    assert salida[0]["estilo"] == {"bloque-fondo": "#101010"}


def test_un_token_que_el_bloque_no_admite_se_descarta_sin_romper():
    """
    Se DESCARTA, no se rechaza. Es el mismo criterio que `tema.resolver()` con
    un token retirado, y aqui importa mas: quitarle un token a un bloque —o
    retirarlo del catalogo— no puede impedir guardar una pagina que lo tenia
    puesto de antes. Un 400 dejaria al negocio sin poder editar su tienda por
    una decision que tomo la plataforma.
    """
    salida = servicio.validar(
        _bloque_con("testimonios", {"bloque-fondo": "#101010", "caja-columnas": "6"})
    )
    assert salida[0]["estilo"] == {"bloque-fondo": "#101010"}


def test_un_valor_vacio_significa_heredado_y_no_se_guarda():
    """
    Vacio es «que mande el tema del negocio», no «vacio». Guardarlo como cadena
    escribiria `--bloque-fondo:` en el HTML, que invalida la declaracion entera,
    y ademas dejaria la seccion clavada sin poder volver a seguir a la tienda.
    """
    salida = servicio.validar(_bloque_con("testimonios", {"bloque-fondo": ""}))
    assert salida[0]["estilo"] == {}


def test_los_bloques_de_siempre_siguen_sin_estilo():
    """Una composicion escrita antes de que esto existiera no cambia de aspecto."""
    salida = servicio.validar([{"id": "b1", "tipo": "testimonios", "props": {}}])
    assert salida[0]["estilo"] == {}


def test_la_tienda_recibe_el_estilo_ya_como_variables_css():
    """
    Se GUARDA por codigo y se SIRVE por variable. La correspondencia vive en un
    solo sitio —`tema.a_variables`— porque tenerla en el editor y en la tienda
    a la vez es como acaban hablando dos idiomas.
    """
    listos = servicio.para_la_tienda(
        servicio.validar(_bloque_con("testimonios", {"bloque-fondo": "#101010"}))
    )
    assert listos[0]["estilo"] == {"--bloque-fondo": "#101010"}


def test_la_unidad_se_pone_al_servir_y_no_al_guardar():
    """Guardar «3» y guardar «3rem» en una medida tienen que dar lo mismo."""
    from apps.storefront.models import TokenTema

    token = TokenTema.objects.get(codigo="seccion-espacio")
    listos = servicio.para_la_tienda(
        servicio.validar(_bloque_con("testimonios", {"seccion-espacio": "3"}))
    )
    esperado = f"3{token.unidad}" if token.unidad else "3"
    assert listos[0]["estilo"][token.variable_css] == esperado


def test_la_previa_de_una_plantilla_tambien_dice_que_va_a_sangre(api, negocio):
    """
    Un fallo que llevaba desde el enlace de prueba y que solo se veia mirando.

    La pagina publicada pasaba por el serializer, que anade `a_sangre`; la
    previa de una plantilla devolvia la composicion EN CRUDO. Asi que en la
    pantalla que existe para juzgar una plantilla, una portada a sangre se
    pintaba dentro del contenedor. No daba error: la plantilla simplemente se
    veia peor de lo que era.
    """
    from apps.storefront import vista_previa

    plantilla = Plantilla.objects.filter(slug="belleza").first()
    assert plantilla is not None

    testigo = vista_previa.firmar(tenant_id=negocio.pk, plantilla_slug="belleza")
    respuesta = api.get(f"/api/storefront/pagina/?ruta=/&{vista_previa.PARAMETRO}={testigo}")

    assert respuesta.status_code == 200
    assert respuesta.data["bloques"], "La plantilla «belleza» dejo de componer la home."
    for bloque in respuesta.data["bloques"]:
        assert "a_sangre" in bloque, "La previa sigue sirviendo la composicion en crudo."
        assert "estilo" in bloque


# ==========================================================================
# LA BIBLIOTECA: LOS BLOQUES QUE LLEGARON CON EL PASO 3
# ==========================================================================
def test_los_bloques_que_el_encargo_pedia_tienen_dos_formas():
    """
    El encargo lo dijo con nombre y apellido: al menos dos variantes en
    cabecera, portada, carruseles y pie. Los tres primeros las tenian; el pie
    llevaba CERO desde el principio, asi que toda tienda del motor —incluida la
    boutique de ocho productos— llevaba el mismo pie de cuatro columnas.

    Se comprueba el numero y no los codigos: que se llamen «minimo» o
    «compacto» es una decision de diseño que puede cambiar; que haya donde
    elegir es la promesa.
    """
    for codigo in ("cabecera", "portada", "carrusel-promociones", "pie"):
        bloque = Bloque.objects.get(codigo=codigo)
        assert len(bloque.variantes) >= 2, f"«{codigo}» sigue teniendo una sola forma"


def test_ningun_bloque_importa_el_mecanismo_de_variantes_sin_usarlo():
    """
    `estadisticas` y `por-que-elegirnos` IMPORTABAN `claseDeVariante` y no lo
    llamaban: estaba escrito el mecanismo y no habia ninguna variante que
    elegir. Es peor que no tenerlo, porque quien lee el componente cree que la
    pieza es configurable.
    """
    sospechosos = []
    for archivo in (RAIZ_TIENDA / "src").rglob("*.tsx"):
        fuente = archivo.read_text(encoding="utf-8")
        if "claseDeVariante" not in fuente:
            continue
        # `Seccion.tsx` es quien lo DEFINE, no quien lo consume.
        if "export function claseDeVariante" in fuente:
            continue
        # Importarlo cuenta una vez; usarlo, otra. Con una sola aparicion, se
        # importo y no se llama.
        if fuente.count("claseDeVariante") < 2:
            sospechosos.append(archivo.name)

    assert not sospechosos, (
        "Importan el mecanismo de variantes y no lo usan: " + ", ".join(sorted(sospechosos))
    )


def test_el_bloque_de_boletin_tiene_donde_guardar_los_correos():
    """
    El guardia del unico bloque nuevo que necesito una tabla.

    Se podia haber escrito mandando un mensaje de contacto con el texto
    «suscripcion», o sin enviar nada: en los dos casos el visitante veria
    «gracias» y no estaria apuntado en ninguna parte. Un formulario que recoge
    correos y no los guarda es peor que no tener el formulario.
    """
    from apps.contact.models import Suscriptor  # noqa: PLC0415

    assert Bloque.objects.filter(codigo="boletin", activo=True).exists()
    assert Suscriptor._meta.db_table == "contact_suscriptor"


# ==========================================================================
# LA LISTA DE CORREO
# ==========================================================================
def test_cualquiera_puede_suscribirse_desde_la_tienda(api, negocio):
    respuesta = api.post(
        "/api/contact/subscribers/", {"email": "ana@ejemplo.test"}, format="json"
    )
    assert respuesta.status_code == 201
    assert respuesta.data["email"] == "ana@ejemplo.test"


def test_apuntarse_dos_veces_no_es_un_error(api, negocio):
    """
    Quien no esta seguro de si funciono vuelve a pulsar. Devolverle un 400 por
    correo repetido le dice que algo se rompio cuando en realidad ya estaba
    dentro, y ademas le revela que ese correo esta en la lista de este negocio.
    """
    from apps.contact.models import Suscriptor

    primero = api.post(
        "/api/contact/subscribers/", {"email": "ana@ejemplo.test"}, format="json"
    )
    segundo = api.post(
        "/api/contact/subscribers/", {"email": "ana@ejemplo.test"}, format="json"
    )

    assert primero.status_code == 201
    assert segundo.status_code == 200
    with usar_tenant(negocio):
        assert Suscriptor.objects.filter(email="ana@ejemplo.test").count() == 1


def test_volver_a_apuntarse_reactiva_la_suscripcion(api, negocio):
    """Darse de baja es archivar; volver a apuntarse es lo que la persona acaba
    de pedir, asi que se reactiva en vez de dejarla de baja en silencio."""
    from apps.contact.models import Suscriptor

    api.post("/api/contact/subscribers/", {"email": "ana@ejemplo.test"}, format="json")
    with usar_tenant(negocio):
        Suscriptor.objects.filter(email="ana@ejemplo.test").update(activo=False)

    api.post("/api/contact/subscribers/", {"email": "ana@ejemplo.test"}, format="json")
    with usar_tenant(negocio):
        assert Suscriptor.objects.get(email="ana@ejemplo.test").activo is True


def test_la_lista_de_correo_no_se_lee_sin_permiso(api, negocio):
    """
    Apuntarse es publico; LEER la lista, no. Es lo mas sensible que guarda el
    motor de tiendas: los correos de los clientes de un negocio.
    """
    assert api.get("/api/contact/subscribers/").status_code in (401, 403)


def test_la_lista_de_un_negocio_no_se_ve_desde_otro(api, negocio, tenant_b):
    from apps.contact.models import Suscriptor

    api.post("/api/contact/subscribers/", {"email": "ana@ejemplo.test"}, format="json")

    with usar_tenant(tenant_b):
        assert Suscriptor.objects.count() == 0


def test_la_misma_persona_puede_seguir_a_dos_tiendas(negocio, tenant_b):
    """
    Unico POR NEGOCIO y no global. La misma persona puede comprar en dos
    tiendas de la plataforma, y son dos suscripciones distintas — una de las
    cuales puede darse de baja sin tocar la otra.
    """
    from apps.contact.models import Suscriptor

    with usar_tenant(negocio):
        Suscriptor.objects.create(email="ana@ejemplo.test")
    with usar_tenant(tenant_b):
        Suscriptor.objects.create(email="ana@ejemplo.test")

    assert Suscriptor.all_tenants.filter(email="ana@ejemplo.test").count() == 2


# ==========================================================================
# UN SOLO CONSTRUCTOR
# ==========================================================================
RAIZ_FRONT = Path(__file__).resolve().parents[2] / "frontend"

#: Los dos paneles que construyen tiendas. El de Crynex edita plantillas; el del
#: negocio edita su propia tienda. Manipulan la MISMA estructura.
PANELES = [
    RAIZ_FRONT / "panel-crynex" / "src",
    RAIZ_FRONT / "admin-panel" / "src",
]


def test_los_tipos_de_una_composicion_se_declaran_una_sola_vez():
    """
    El guardia del paso 4, y existe porque la duplicacion ya habia divergido.

    Los dos paneles tenian declarados por su cuenta `Bloque`, `BloqueColocado`,
    `TokenTema` y compania. Ninguno estaba mal —cada uno era correcto por su
    cuenta— y precisamente por eso se habian separado sin que nada avisara: el
    del negocio no declaraba `activo`, `id` ni `orden` en `TokenTema`, aunque el
    servidor los manda, ni `icono` en `Bloque`.

    Esa es la forma peligrosa de la duplicacion. No falla: diverge. Y el dia que
    alguien arregla algo, lo arregla en uno.

    Ahora viven en `frontend/constructor/src/tipos.ts` y los paneles los
    REEXPORTAN. Volver a declararlos localmente compilaria igual y volveria a
    abrir la puerta, asi que se vigila.
    """
    compartidos = [
        "BloqueColocado",
        "CampoEsquema",
        "CategoriaBloque",
        "TokenTema",
        "GrupoToken",
    ]

    reincidentes = []
    for raiz in PANELES:
        for archivo in raiz.rglob("*.ts"):
            fuente = archivo.read_text(encoding="utf-8")
            for nombre in compartidos:
                # `export interface X {` o `export type X =` es declarar.
                # `export type { X } from` es reexportar, que es lo correcto.
                if re.search(rf"^export (interface {nombre} \{{|type {nombre} =)", fuente, re.M):
                    reincidentes.append(f"{archivo.name}:{nombre}")

    assert not reincidentes, (
        "Estos tipos vuelven a estar declarados en un panel en vez de venir de "
        "`@constructor`: " + ", ".join(sorted(reincidentes))
    )


def test_las_operaciones_de_composicion_no_se_reescriben_en_los_paneles():
    """
    Duplicar, quitar y actualizar viven en `@constructor`.

    Los dos editores las tenian escritas a mano, y las dos versiones de duplicar
    hacian una copia SUPERFICIAL —`{ ...bloque, id: nuevo }`—, que comparte el
    objeto de propiedades con el original. Hoy no rompe nada porque los
    formularios reemplazan en vez de mutar; el dia que alguien escriba un
    `push()` en un editor de listas, duplicar una seccion empezaria a editar las
    dos a la vez.

    Que el MISMO descuido apareciera en los dos sitios es el argumento entero de
    este paso: no es que uno estuviera mal, es que hay que arreglarlo dos veces.
    """
    reincidentes = []
    for raiz in PANELES:
        for archivo in raiz.rglob("*.tsx"):
            fuente = archivo.read_text(encoding="utf-8")
            if re.search(r"\{ \.\.\.bloque, id: nuevoId\(", fuente):
                reincidentes.append(archivo.name)

    assert not reincidentes, (
        "Vuelven a duplicar bloques a mano, con copia superficial: "
        + ", ".join(sorted(reincidentes))
    )


def test_el_modulo_compartido_no_tiene_pantalla():
    """
    En `@constructor` va lo que DECIDE, no lo que se ve.

    Es la linea que hace que compartir no obligue a unificar el diseño: los dos
    paneles tienen hojas de estilos distintas a proposito, asi que meter JSX
    aqui significaria imponerle a uno el vocabulario de clases del otro.

    Ademas hay una razon mecanica: el directorio no tiene `node_modules`, asi
    que React no resuelve desde el. Un `.tsx` aqui no compilaria — pero fallaria
    con un error de modulo no encontrado, que no explica nada. Este test si.
    """
    compartido = RAIZ_FRONT / "constructor" / "src"
    assert compartido.is_dir(), "Desaparecio el modulo compartido del constructor."

    con_pantalla = [a.name for a in compartido.rglob("*.tsx")]
    assert not con_pantalla, (
        "Hay componentes en el modulo compartido: " + ", ".join(sorted(con_pantalla))
    )
