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


@pytest.mark.media_por_tenant
def test_los_archivos_subidos_llevan_el_prefijo_de_su_tenant(api_tenant_a, tenant_a):
    """
    Sección 11: la clave en R2 se construye con el UUID, no con el slug.

    ESTE ES DE LA FASE 6, no de la 3. El aislamiento de la biblioteca ya está
    —un negocio no ve ni lista los archivos de otro—; lo que falta es que las
    rutas dentro del bucket también estén separadas, para que un negocio no
    pueda sobrescribir el fichero de otro conociendo su nombre.
    """
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
