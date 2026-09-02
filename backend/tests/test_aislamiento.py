"""
Aislamiento entre tenants — la definición ejecutable del punto 7 del plan.

TODO ESTE ARCHIVO FALLA HOY, Y ES SU FUNCIÓN. Describe el comportamiento que
las fases 1 a 3 tienen que construir. Se ejecuta aparte de la suite verde:

    pytest -m "not tenancy"    # regresión: debe estar en verde siempre
    pytest -m tenancy          # objetivo: pasa cuando la fase 3 cierra

La regla de la sección 14 de la auditoría depende de este archivo: no se da de
alta un segundo negocio real hasta que pase entero.
"""
import pytest

pytestmark = [pytest.mark.django_db, pytest.mark.tenancy]


def respuesta_json_de(respuesta):
    """Devuelve la lista de resultados, esté paginada o no."""
    cuerpo = respuesta.json()
    return cuerpo["results"] if isinstance(cuerpo, dict) else cuerpo


# Cada recurso con ámbito de tenant y la clave del fixture que lo crea en B.
RECURSOS = [
    ("/api/catalog/products/", "producto"),
    ("/api/catalog/categories/", "categoria"),
    ("/api/orders/", "pedido"),
    ("/api/clients/", "cliente"),
]


# ==========================================================================
# 1. LECTURA — lo que un tenant puede ver
# ==========================================================================
@pytest.mark.parametrize("ruta,clave", RECURSOS)
def test_listar_no_incluye_objetos_de_otro_tenant(
    api_tenant_a, recursos_del_tenant_b, ruta, clave
):
    respuesta = api_tenant_a.get(ruta)
    assert respuesta.status_code == 200

    ajeno = recursos_del_tenant_b[clave]
    ids = {fila["id"] for fila in respuesta.json()["results"]}
    assert ajeno.id not in ids, f"{ruta} filtró un objeto del tenant B"


@pytest.mark.parametrize("ruta,clave", RECURSOS)
def test_el_detalle_de_otro_tenant_responde_404(
    api_tenant_a, recursos_del_tenant_b, ruta, clave
):
    """
    404 y no 403: un 403 confirma que el recurso existe, y eso ya es
    información que el tenant A no debería obtener.
    """
    ajeno = recursos_del_tenant_b[clave]
    assert api_tenant_a.get(f"{ruta}{ajeno.id}/").status_code == 404


# ==========================================================================
# 2. ESCRITURA — lo que un tenant puede modificar
# ==========================================================================
@pytest.mark.parametrize("ruta,clave", RECURSOS)
def test_no_se_puede_modificar_un_objeto_de_otro_tenant(
    api_tenant_a, recursos_del_tenant_b, ruta, clave
):
    ajeno = recursos_del_tenant_b[clave]
    respuesta = api_tenant_a.patch(f"{ruta}{ajeno.id}/", {}, format="json")
    assert respuesta.status_code == 404


@pytest.mark.parametrize("ruta,clave", RECURSOS)
def test_no_se_puede_borrar_un_objeto_de_otro_tenant(
    api_tenant_a, recursos_del_tenant_b, ruta, clave
):
    ajeno = recursos_del_tenant_b[clave]
    assert api_tenant_a.delete(f"{ruta}{ajeno.id}/").status_code == 404


def test_no_se_puede_forzar_el_tenant_desde_el_cuerpo(
    api_tenant_a, tenant_a, tenant_b, categoria
):
    """
    Asignación masiva: el intento más obvio de escribir en el vecino.
    El tenant se toma del contexto de la petición, nunca del payload.
    """
    respuesta = api_tenant_a.post(
        "/api/catalog/categories/",
        {"nombre_categoria": "Infiltrada", "abreviatura": "INF", "tenant": tenant_b.id},
        format="json",
    )

    if respuesta.status_code == 201:
        from apps.catalog.models import Categoria

        creada = Categoria.all_tenants.get(id=respuesta.json()["id"])
        assert creada.tenant_id == tenant_a.id, "El cuerpo pudo elegir el tenant"


def test_un_pedido_no_puede_referenciar_una_presentacion_ajena(
    api, tenant_a, recursos_del_tenant_b
):
    """
    Vector concreto del código actual: `ItemCatalogoSerializer.presentacion_id`
    resuelve contra `PresentacionProducto.objects.all()`. Sin ámbito, la tienda
    del tenant A acepta un pedido de un producto del tenant B — y le calcula
    el precio del vecino.
    """
    ajena = recursos_del_tenant_b["presentacion"]

    respuesta = api.post(
        "/api/orders/",
        {
            "cliente": {"nombre": "Cliente del tenant A"},
            "items": [{"presentacion_id": ajena.id, "cantidad": "1"}],
        },
        format="json",
        HTTP_HOST="la-gran-cosecha.plataforma.test",
    )
    assert respuesta.status_code == 400, "Se aceptó un producto de otro tenant"


# ==========================================================================
# 3. RESOLUCIÓN POR DOMINIO — la tienda pública, sin usuario autenticado
# ==========================================================================
def test_la_tienda_publica_solo_muestra_el_catalogo_de_su_dominio(
    api, tenant_a, tenant_b, recursos_del_tenant_b, producto_de_a
):
    """Los dominios de cada negocio ya los registran los fixtures."""
    respuesta = api.get(
        "/api/catalog/products/", HTTP_HOST="la-gran-cosecha.plataforma.test"
    )
    nombres = {p["nombre_producto"] for p in respuesta.json()["results"]}

    assert "Perfume floral" not in nombres
    assert "Mango de La Gran Cosecha" in nombres


def test_un_host_desconocido_no_expone_ningun_catalogo(api, presentacion):
    """
    Falla cerrado: sin dominio reconocido no hay tenant, y sin tenant no se
    devuelven datos. El fallo abierto es lo que produce las fugas.
    """
    respuesta = api.get("/api/catalog/products/", HTTP_HOST="dominio-inventado.test")
    assert respuesta.status_code in (400, 404)


def test_cada_tenant_tiene_su_propia_configuracion_de_tienda(api, tenant_a, tenant_b):
    """
    El fin del singleton `SiteConfig` forzado a pk=1.

    Cada negocio tiene su identidad visual, y la tienda sirve la que
    corresponde al dominio por el que entra el visitante.
    """
    tenant_a.settings.color_primario = "#16a34a"
    tenant_a.settings.save()
    tenant_b.settings.color_primario = "#9333ea"
    tenant_b.settings.save()

    color_a = api.get(
        "/api/content/site-config/", HTTP_HOST="la-gran-cosecha.plataforma.test"
    )
    color_b = api.get(
        "/api/content/site-config/", HTTP_HOST="perfumeria.plataforma.test"
    )

    assert color_a.json()["color_primario"] == "#16a34a"
    assert color_b.json()["color_primario"] == "#9333ea"


# ==========================================================================
# 4. UNICIDAD — el bloqueo garantizado del tenant #2
# ==========================================================================
@pytest.mark.parametrize(
    "modelo_ruta,campos",
    [
        ("apps.catalog.models.Categoria", {"nombre_categoria": "Ofertas", "abreviatura": "OFE"}),
        ("apps.catalog.models.UnidadMedida", {"nombre_unidad": "Kilogramo", "abreviatura_unidad": "kg"}),
        ("apps.orders.models.Cliente", {"nombre_cliente": "Juan Pérez"}),
    ],
)
def test_dos_tenants_pueden_repetir_el_mismo_nombre(
    tenant_a, tenant_b, modelo_ruta, campos
):
    """
    Hoy estos campos son `unique=True` global: dos negocios no pueden tener
    ambos una categoría "Ofertas" ni un cliente "Juan Pérez". La unicidad tiene
    que pasar a ser (tenant, nombre).
    """
    import importlib

    ruta, nombre_clase = modelo_ruta.rsplit(".", 1)
    modelo = getattr(importlib.import_module(ruta), nombre_clase)

    # `all_tenants` porque este test construye a propósito datos de dos
    # negocios a la vez, que es justo el caso para el que existe la escotilla.
    modelo.all_tenants.create(tenant=tenant_a, **campos)
    modelo.all_tenants.create(tenant=tenant_b, **campos)  # no debe reventar

    assert modelo.all_tenants.filter(**campos).count() == 2


def test_el_codigo_de_producto_es_por_tenant(tenant_a, tenant_b):
    """La secuencia de `Producto.save()` deja de ser un barrido global."""
    from apps.catalog.models import Categoria, Producto

    cat_a = Categoria.all_tenants.create(
        tenant=tenant_a, nombre_categoria="Frutas", abreviatura="FRU"
    )
    cat_b = Categoria.all_tenants.create(
        tenant=tenant_b, nombre_categoria="Fragancias", abreviatura="FRU"
    )

    primero_a = Producto.all_tenants.create(
        tenant=tenant_a, nombre_producto="Mango", categoria=cat_a
    )
    primero_b = Producto.all_tenants.create(
        tenant=tenant_b, nombre_producto="Perfume", categoria=cat_b
    )

    # Cada negocio empieza su propia numeración desde 001.
    assert primero_a.codigo_producto == "FRU-001"
    assert primero_b.codigo_producto == "FRU-001"


# ==========================================================================
# 5. USUARIOS Y PERTENENCIA
# ==========================================================================
def test_un_usuario_sin_pertenencia_no_entra(api_tenant_a, tenant_b, tenancy):
    """El agujero real del código actual: `is_staff` bastaba para todo."""
    api_tenant_a.credentials(HTTP_X_TENANT=tenant_b.slug)
    assert api_tenant_a.get("/api/catalog/products/").status_code in (403, 404)


def test_los_usuarios_listados_son_solo_los_del_tenant(
    api_tenant_a, api_tenant_b, tenant_b
):
    cuerpo = respuesta_json_de(api_tenant_a.get("/api/auth/users/"))
    correos = {u["email_usuario"] for u in cuerpo}
    assert "staff-b@ejemplo.test" not in correos


def test_una_persona_puede_pertenecer_a_dos_negocios(tenancy, tenant_a, tenant_b):
    """Decisión B aprobada: Usuario global + Membership N:M."""
    from django.contrib.auth import get_user_model

    usuario = get_user_model().objects.create_user(
        email_usuario="contadora@ejemplo.test",
        nombre_usuario="Contadora externa",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    tenancy.models.Membership.objects.create(usuario=usuario, tenant=tenant_a, rol="STAFF")
    tenancy.models.Membership.objects.create(usuario=usuario, tenant=tenant_b, rol="STAFF")

    assert usuario.memberships.count() == 2


def test_el_admin_de_plataforma_no_es_un_rol_de_tenant(api_tenant_a):
    """
    La separación del punto 9: el panel de plataforma vive aparte.

    OJO — hoy pasa por el motivo equivocado: la ruta todavía no existe y
    devuelve 404. No es cobertura real hasta la fase 10, cuando el panel de
    plataforma exista y el 404 pase a significar "existe pero no es tuyo".
    """
    assert api_tenant_a.get("/api/platform/tenants/").status_code in (403, 404)


# ==========================================================================
# 6. NOTIFICACIONES Y ARCHIVOS
# ==========================================================================
def test_las_notificaciones_no_se_mezclan(api_tenant_a, tenant_b):
    """Hoy `Notificacion` es global por diseño explícito en su docstring."""
    from apps.notifications.models import Notificacion

    Notificacion.all_tenants.create(
        tenant=tenant_b, tipo="PEDIDO_NUEVO", titulo="Pedido de la perfumería"
    )

    titulos = {n["titulo"] for n in api_tenant_a.get("/api/notifications/").json()["results"]}
    assert "Pedido de la perfumería" not in titulos


def test_los_archivos_subidos_llevan_el_prefijo_de_su_tenant(api_tenant_a, tenant_a):
    """Sección 11: la clave en R2 se construye con el UUID, no con el slug."""
    from django.core.files.uploadedfile import SimpleUploadedFile

    png = SimpleUploadedFile(
        "prueba.png",
        b"\x89PNG\r\n\x1a\n" + b"\x00" * 64,
        content_type="image/png",
    )
    respuesta = api_tenant_a.post(
        "/api/media/archivos/", {"archivo": png}, format="multipart"
    )
    assert respuesta.status_code == 201

    from apps.media.models import Archivo

    archivo = Archivo.all_tenants.get(id=respuesta.json()["id"])
    assert archivo.archivo.name.startswith(f"tenants/{tenant_a.uuid}/")


def test_la_biblioteca_no_lista_archivos_ajenos(api_tenant_a, tenant_b):
    from apps.media.models import Archivo

    ajeno = Archivo.all_tenants.create(
        tenant=tenant_b,
        archivo="tenants/otro/biblioteca/secreto.png",
        nombre_original="secreto.png",
        tipo="IMAGEN",
        content_type="image/png",
        tamano=100,
    )

    ids = {a["id"] for a in api_tenant_a.get("/api/media/archivos/").json()["results"]}
    assert ajeno.id not in ids


# ==========================================================================
# 6 bis. LAS VISTAS QUE NO SON ModelViewSet
# ==========================================================================
# La mitad de las vistas que tocan datos de negocio no tienen queryset que
# acotar —estadísticas, facturas, productos pendientes, el equipo— y quedaban
# fuera del mixin completo. Estos tests cubren esa mitad.

RUTAS_SIN_QUERYSET = [
    "/api/admin/stats/",
    "/api/orders/productos-mas-vendidos/",
    "/api/orders-productos-pendientes/",
    "/api/auth/users/",
    "/api/content/site-config/",
]


@pytest.mark.parametrize("ruta", RUTAS_SIN_QUERYSET)
def test_sin_negocio_resuelto_no_responden(api_tenant_a, ruta):
    """
    Usuario con sesión válida, pero por una dirección que no es de ningún
    negocio: 404. Sin esto devolverían un 500 con el `SinTenantEnContexto` del
    manager asomando, o —peor— datos.
    """
    # Se retira la cabecera X-Tenant que el fixture deja fijada: aquí se quiere
    # comprobar justo el caso en que nada resuelve el negocio.
    api_tenant_a.credentials()

    respuesta = api_tenant_a.get(ruta, HTTP_HOST="host-inventado.test")
    assert respuesta.status_code == 404


def test_las_estadisticas_solo_cuentan_el_negocio_propio(
    api_tenant_a, tenant_a, recursos_del_tenant_b
):
    """
    Las ventas del vecino no pueden aparecer en el panel de nadie más — ni
    siquiera agregadas, que es la forma en que una fuga pasa desapercibida.
    """
    respuesta = api_tenant_a.get("/api/admin/stats/")
    assert respuesta.status_code == 200

    from apps.orders.models import Pedido

    del_a = Pedido.all_tenants.filter(tenant=tenant_a).count()
    assert respuesta.json().get("total_pedidos", del_a) == del_a


def test_la_factura_de_otro_negocio_no_se_puede_descargar(
    api_tenant_a, recursos_del_tenant_b
):
    """La factura lleva los datos del cliente: es de lo más sensible que hay."""
    ajeno = recursos_del_tenant_b["pedido"]
    assert api_tenant_a.get(f"/api/orders/{ajeno.id}/pdf/").status_code == 404


def test_la_factura_no_se_emite_sin_negocio_resuelto(
    api_tenant_a, tenant_a, recursos_del_tenant_b
):
    """
    Distinto del anterior: aquí el pedido SÍ es suyo, pero la dirección no
    corresponde a ningún negocio. Sin la comprobación, la vista llegaría a
    consultar y reventaría con un 500 en vez de responder 404.
    """
    from apps.orders.models import Pedido

    propio = Pedido.all_tenants.create(tenant=tenant_a, estado="PENDIENTE")
    api_tenant_a.credentials()  # sin la cabecera X-Tenant del fixture

    respuesta = api_tenant_a.get(
        f"/api/orders/{propio.id}/pdf/", HTTP_HOST="host-inventado.test"
    )
    assert respuesta.status_code == 404


def test_los_productos_pendientes_son_los_del_negocio(
    api_tenant_a, tenant_b, recursos_del_tenant_b
):
    """
    Los productos que un cliente escribe a mano y el admin aprueba. Aprobar uno
    del vecino lo metería en el catálogo equivocado.
    """
    from apps.orders.models import DetallePedido

    ajeno = DetallePedido.all_tenants.create(
        tenant=tenant_b,
        pedido=recursos_del_tenant_b["pedido"],
        nombre_personalizado="Esencia de jazmín",
        cantidad=1,
        es_catalogo=False,
    )

    pendientes = respuesta_json_de(api_tenant_a.get("/api/orders-productos-pendientes/"))
    assert ajeno.id not in {p["id"] for p in pendientes}


def test_no_se_puede_aprobar_un_producto_pendiente_ajeno(
    api_tenant_a, tenant_b, recursos_del_tenant_b
):
    from apps.orders.models import DetallePedido

    ajeno = DetallePedido.all_tenants.create(
        tenant=tenant_b,
        pedido=recursos_del_tenant_b["pedido"],
        nombre_personalizado="Esencia de jazmín",
        cantidad=1,
        es_catalogo=False,
    )
    respuesta = api_tenant_a.post(
        f"/api/orders-productos-pendientes/{ajeno.id}/aprobar/", {}, format="json"
    )
    assert respuesta.status_code == 404


# ==========================================================================
# 7. LA CAPA QUE IMPORTA: la base de datos misma
# ==========================================================================
@pytest.mark.postgres
def test_rls_bloquea_incluso_el_sql_crudo(settings, tenant_a, recursos_del_tenant_b):
    """
    La prueba que convierte "creemos que está aislado" en "la base de datos no
    entrega la fila". Se salta el ORM por completo: si esto pasa, ninguna vista
    olvidada, ningún `.raw()` y ningún script de exportación puede filtrar.

    Requiere PostgreSQL y un rol de aplicación SIN BYPASSRLS — el rol
    `postgres` que entrega Supabase por defecto SÍ lo tiene y haría pasar este
    test en falso.
    """
    if not getattr(settings, "USA_POSTGRES_EN_TESTS", False):
        pytest.skip("Necesita TEST_DATABASE_URL apuntando a PostgreSQL")

    from django.db import connection

    ajeno = recursos_del_tenant_b["producto"]

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.current_tenant = %s", [str(tenant_a.uuid)])
        cursor.execute("SELECT id FROM ui_producto WHERE id = %s", [ajeno.id])
        assert cursor.fetchone() is None, "RLS no está activo o el rol lo ignora"


@pytest.mark.postgres
def test_el_rol_de_la_aplicacion_no_puede_saltarse_rls(settings):
    """Verifica la advertencia de Supabase de la sección 4, no el código."""
    if not getattr(settings, "USA_POSTGRES_EN_TESTS", False):
        pytest.skip("Necesita TEST_DATABASE_URL apuntando a PostgreSQL")

    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
        )
        es_superusuario, salta_rls = cursor.fetchone()

    assert not es_superusuario, "El rol de la app es superusuario: RLS no aplica"
    assert not salta_rls, "El rol de la app tiene BYPASSRLS: RLS no aplica"


# ==========================================================================
# 8. LA TIENDA EN NEXT.JS — llamada de servidor a servidor
# ==========================================================================
CLAVE = "clave-compartida-de-prueba"


def test_el_servidor_de_la_tienda_declara_el_negocio_con_su_clave(
    api, settings, tenant_a, producto_de_a, recursos_del_tenant_b
):
    """
    El servidor de Next renderiza la página del visitante y pide el catálogo
    del negocio que toca. Llama desde su propio host, así que el `Host` no lo
    identifica: la clave compartida es lo que distingue esa llamada de una
    hecha desde un navegador.
    """
    settings.TENANCY_CLAVE_SERVIDOR = CLAVE

    respuesta = api.get(
        "/api/catalog/products/",
        HTTP_HOST="tienda-en-next.interno",
        HTTP_X_TENANT="la-gran-cosecha",
        HTTP_X_TENANT_KEY=CLAVE,
    )
    nombres = {p["nombre_producto"] for p in respuesta.json()["results"]}

    assert "Mango de La Gran Cosecha" in nombres
    assert "Perfume floral" not in nombres


def test_sin_la_clave_la_cabecera_no_vale_nada(api, settings, tenant_a, presentacion):
    """Si bastara la cabecera, cualquiera elegiría negocio desde el navegador."""
    settings.TENANCY_CLAVE_SERVIDOR = CLAVE
    settings.TENANCY_ACEPTA_CABECERA = False

    respuesta = api.get(
        "/api/catalog/products/",
        HTTP_HOST="host-inventado.test",
        HTTP_X_TENANT="la-gran-cosecha",
    )
    assert respuesta.status_code == 404


def test_una_clave_equivocada_tampoco(api, settings, tenant_a, presentacion):
    settings.TENANCY_CLAVE_SERVIDOR = CLAVE
    settings.TENANCY_ACEPTA_CABECERA = False

    respuesta = api.get(
        "/api/catalog/products/",
        HTTP_HOST="host-inventado.test",
        HTTP_X_TENANT="la-gran-cosecha",
        HTTP_X_TENANT_KEY="me-la-invento",
    )
    assert respuesta.status_code == 404


def test_sin_clave_configurada_la_via_esta_cerrada(api, settings, tenant_a, presentacion):
    """Vacía = desactivada: una instalación que no use Next no abre esa puerta."""
    settings.TENANCY_CLAVE_SERVIDOR = ""
    settings.TENANCY_ACEPTA_CABECERA = False

    respuesta = api.get(
        "/api/catalog/products/",
        HTTP_HOST="host-inventado.test",
        HTTP_X_TENANT="la-gran-cosecha",
        HTTP_X_TENANT_KEY="",
    )
    assert respuesta.status_code == 404


def test_el_servidor_de_la_tienda_puede_declarar_un_dominio_propio(
    api, settings, tenant_a, producto_de_a
):
    """
    Con dominio propio no hay slug que enviar: el negocio se declara por su
    hostname y el backend lo resuelve contra `Domain`. Va por la misma vía
    acreditada, para no tener que activar `USE_X_FORWARDED_HOST` en todo
    Django, que aflojaría su manejo de hosts para cualquiera.
    """
    settings.TENANCY_CLAVE_SERVIDOR = CLAVE

    respuesta = api.get(
        "/api/catalog/products/",
        HTTP_HOST="tienda-en-next.interno",
        HTTP_X_TENANT_HOST="la-gran-cosecha.plataforma.test",
        HTTP_X_TENANT_KEY=CLAVE,
    )
    nombres = {p["nombre_producto"] for p in respuesta.json()["results"]}
    assert "Mango de La Gran Cosecha" in nombres


def test_un_negocio_inventado_por_el_servidor_no_cae_al_host(
    api, settings, tenant_a, producto_de_a
):
    """
    Regresión de un fallo abierto real, encontrado probando la tienda en Next.

    La tienda pedía el catálogo de un subdominio inventado; Django no
    encontraba ese negocio, caía a resolver por `Host` —que es el suyo propio,
    no el del visitante— y devolvía el catálogo del negocio equivocado con un
    200. Un servidor que se acredita con la clave es autoritativo: si declara
    un negocio que no existe, la respuesta es "ninguno".
    """
    settings.TENANCY_CLAVE_SERVIDOR = CLAVE
    settings.TENANCY_ACEPTA_CABECERA = False

    respuesta = api.get(
        "/api/catalog/products/",
        HTTP_HOST="la-gran-cosecha.plataforma.test",  # un host que SÍ resuelve
        HTTP_X_TENANT="negocio-que-no-existe",
        HTTP_X_TENANT_KEY=CLAVE,
    )
    assert respuesta.status_code == 404


# ==========================================================================
# LA COBERTURA DE LA TERCERA CAPA
# ==========================================================================
#: Tablas con columna de negocio que NO llevan politica de fila, y por que.
#:
#: Cada exencion es una decision, no un olvido — que es exactamente la
#: diferencia que este test existe para mantener visible.
EXENTAS_DE_RLS = {
    "tenancy_domain": (
        "Es la tabla que RESUELVE el negocio a partir del host. Protegerla con "
        "una politica que necesita saber el negocio seria circular: el "
        "middleware no podria averiguar cual es."
    ),
    "tenancy_membership": (
        "Igual: decide a que negocios pertenece quien llama, y se consulta "
        "antes de que haya ambito declarado."
    ),
    "billing_subscription": (
        "Dato comercial de plataforma, no del negocio. El panel de Crynex "
        "compara suscripciones entre clientes, que es su trabajo."
    ),
    "soporte_cosa": "Modelo de la propia suite, no existe en produccion.",
}


def tablas_bajo_rls() -> set:
    """
    Las tablas que alguna migracion de RLS declara.

    Se leen de los propios modulos y no de una lista escrita aqui: una lista a
    mano habria que acordarse de ampliarla, y de eso justamente no se acuerda
    nadie. Es el mismo criterio que el test del registro de bloques.
    """
    import importlib
    import pkgutil

    from django.apps import apps as registro_de_apps

    tablas = set()
    for config in registro_de_apps.get_app_configs():
        if not config.name.startswith("apps."):
            continue
        try:
            paquete = importlib.import_module(f"{config.name}.migrations")
        except ModuleNotFoundError:
            continue
        for info in pkgutil.iter_modules(paquete.__path__):
            if "row_level_security" not in info.name:
                continue
            modulo = importlib.import_module(f"{config.name}.migrations.{info.name}")
            tablas.update(getattr(modulo, "TABLAS", []))
    return tablas


def test_toda_tabla_con_negocio_esta_bajo_rls():
    """
    La tercera capa se activa TABLA POR TABLA.

    `ENABLE ROW LEVEL SECURITY` no se hereda: una app creada despues de
    `tenancy.0003` se queda fuera de la red y nada avisa. Ya paso cuatro veces
    —storefront en la fase 7, business y pos despues— y las dos primeras capas
    tapan el agujero lo suficiente como para que nadie lo note.

    Este test lo convierte en un fallo de la suite en vez de en un hallazgo de
    auditoria. Anadir un modelo con columna de negocio obliga a cubrirlo o a
    escribir por que no.
    """
    from django.apps import apps as registro_de_apps

    cubiertas = tablas_bajo_rls()
    descubiertas = sorted(
        modelo._meta.db_table
        for modelo in registro_de_apps.get_models()
        if any(campo.name == "tenant" for campo in modelo._meta.fields)
        and modelo._meta.db_table not in cubiertas
        and modelo._meta.db_table not in EXENTAS_DE_RLS
    )

    assert not descubiertas, (
        "Estas tablas guardan datos de un negocio y ninguna politica de fila "
        f"las protege: {descubiertas}. Anade la migracion de RLS de su app, o "
        "declaralas en EXENTAS_DE_RLS con la razon."
    )


def test_ninguna_exencion_sobra():
    """
    Una exencion que ya no aplica es peor que no tenerla: hace creer que hay
    una decision detras cuando lo que hay es una linea que nadie borro.
    """
    from django.apps import apps as registro_de_apps

    con_negocio = {
        modelo._meta.db_table
        for modelo in registro_de_apps.get_models()
        if any(campo.name == "tenant" for campo in modelo._meta.fields)
    }
    sobran = sorted(set(EXENTAS_DE_RLS) - con_negocio)
    assert not sobran, f"Exenciones de tablas que ya no existen: {sobran}"
