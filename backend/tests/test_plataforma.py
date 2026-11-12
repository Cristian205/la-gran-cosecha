"""
El panel de Kryon X: planes, permisos y negocios.

Es la única parte del sistema que atraviesa negocios a propósito, así que es
también donde más importa comprobar quién entra: administrar un negocio no
puede dar acceso a los planes de todos los clientes.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.billing.models import Plan
from apps.tenancy.models import Tenant

pytestmark = pytest.mark.django_db

RUTAS = [
    "/api/platform/resumen/",
    "/api/platform/tenants/",
    "/api/platform/plans/",
    "/api/platform/permissions/",
]


@pytest.fixture
def staff_plataforma(negocio):
    usuario = get_user_model().objects.create_user(
        email_usuario="kryonx@ejemplo.test",
        nombre_usuario="Equipo Kryon X",
        password="clave-de-prueba-123",
        is_staff=True,
    )
    usuario.es_staff_plataforma = True
    usuario.save(update_fields=["es_staff_plataforma"])

    cliente = APIClient()
    cliente.force_authenticate(user=usuario)
    return cliente


def codenames_visibles(cliente):
    """Los permisos que un negocio puede repartir, aplanados."""
    return {
        permiso["codename"]
        for modulo in cliente.get("/api/auth/permisos-disponibles/").json()
        for permiso in modulo["permisos"]
    }


# ==========================================================================
# QUIÉN ENTRA
# ==========================================================================
@pytest.mark.parametrize("ruta", RUTAS)
def test_el_staff_de_plataforma_entra(staff_plataforma, ruta):
    assert staff_plataforma.get(ruta).status_code == 200


@pytest.mark.parametrize("ruta", RUTAS)
def test_administrar_un_negocio_no_da_acceso_a_la_plataforma(api_owner, ruta):
    """
    La separación del punto 9. `api_owner` es dueña de SU negocio y aun así no
    puede ver los planes de los demás ni cambiarlos.
    """
    assert api_owner.get(ruta).status_code == 403


@pytest.mark.parametrize("ruta", RUTAS)
def test_un_visitante_no_ve_nada(api, ruta):
    assert api.get(ruta).status_code in (401, 403)


def test_ser_superusuario_de_django_no_basta(negocio):
    """
    Deliberado: en esta instalación cuatro de las cinco cuentas son
    superusuarias por herencia, y tocar los planes de todos los clientes tiene
    que ser una decisión explícita, no un efecto secundario de un flag viejo.
    """
    superusuario = get_user_model().objects.create_superuser(
        email_usuario="super@ejemplo.test",
        nombre_usuario="Superusuario heredado",
        password="clave-de-prueba-123",
    )
    cliente = APIClient()
    cliente.force_authenticate(user=superusuario)

    assert cliente.get("/api/platform/plans/").status_code == 403


# ==========================================================================
# LA MATRIZ: PLANES x PERMISOS
# ==========================================================================
def test_el_catalogo_se_sembro_desde_el_que_ya_existia(staff_plataforma):
    """No se inventaron permisos: salen de accounts/permisos.py."""
    from apps.accounts.permisos import TODOS_LOS_CODENAMES

    respuesta = staff_plataforma.get("/api/platform/permissions/").json()
    assert {p["codename"] for p in respuesta} == TODOS_LOS_CODENAMES


def test_los_tres_planes_de_arranque_existen(staff_plataforma):
    planes = staff_plataforma.get("/api/platform/plans/").json()
    assert {p["slug"] for p in planes} == {"starter", "growth", "business"}
    # Exactamente uno recibe a los negocios nuevos.
    assert sum(1 for p in planes if p["es_predeterminado"]) == 1


def test_un_plan_no_puede_conceder_un_permiso_que_no_existe(staff_plataforma):
    """
    Un codename inventado no concedería nada y sería invisible hasta que
    alguien se preguntara por qué un plan no funciona.
    """
    plan = Plan.objects.get(slug="starter")
    respuesta = staff_plataforma.patch(
        f"/api/platform/plans/{plan.id}/",
        {"permisos": ["catalog.view_producto", "modulo.inventado"]},
        format="json",
    )
    assert respuesta.status_code == 400
    assert "modulo.inventado" in str(respuesta.json())


def test_retirar_un_permiso_lo_oculta_en_todos_los_negocios(
    api_owner, negocio, staff_plataforma
):
    """
    El sentido de tener el catálogo en la base: Kryon X desactiva un módulo y
    desaparece de todas las empresas sin tocar ningún plan.
    """
    catalogo = staff_plataforma.get("/api/platform/permissions/").json()
    objetivo = next(p for p in catalogo if p["codename"] == "catalog.view_producto")

    assert "catalog.view_producto" in codenames_visibles(api_owner)

    staff_plataforma.patch(
        f"/api/platform/permissions/{objetivo['id']}/", {"activo": False}, format="json"
    )

    assert "catalog.view_producto" not in codenames_visibles(api_owner)


def test_cada_negocio_ve_solo_lo_que_su_plan_incluye(api_owner, negocio):
    """
    Antes el catálogo era idéntico para todos. Ahora un negocio en Starter no
    ve siquiera la opción de conceder "editar productos".
    """
    negocio.suscripcion.plan = Plan.objects.get(slug="starter")
    negocio.suscripcion.save(update_fields=["plan"])

    codenames = codenames_visibles(api_owner)
    assert "catalog.view_producto" in codenames
    assert "catalog.change_producto" not in codenames


def test_un_negocio_sin_suscripcion_no_reparte_nada(api_owner, negocio):
    """Preferible un panel vacío a repartir permisos que nadie ha contratado."""
    negocio.suscripcion.delete()
    assert api_owner.get("/api/auth/permisos-disponibles/").json() == []


# ==========================================================================
# NEGOCIOS Y PLANES
# ==========================================================================
def test_la_plataforma_ve_todos_los_negocios(staff_plataforma, negocio):
    otro = Tenant.objects.create(slug="otra", nombre="Otra empresa", estado="ACTIVO")

    slugs = {n["slug"] for n in staff_plataforma.get("/api/platform/tenants/").json()}
    assert {negocio.slug, otro.slug} <= slugs


def test_el_listado_trae_el_logo_de_la_tienda(staff_plataforma, negocio):
    """Sin logo subido, `logo_url` es null y el panel pinta la inicial."""
    fila = next(
        n for n in staff_plataforma.get("/api/platform/tenants/").json() if n["id"] == negocio.id
    )
    assert "logo_url" in fila


def test_la_identidad_corporativa_se_edita_donde_la_lee_la_tienda(staff_plataforma, negocio):
    from apps.content.models import StoreSettings

    respuesta = staff_plataforma.patch(
        f"/api/platform/tenants/{negocio.id}/identidad/",
        {
            "nombre_comercial": "La Gran Cosecha",
            "razon_social": "Fready Balaguera",
            "nit": "80.760.871-1",
            "telefono": "3002124562",
            "ciudad": "Soacha",
        },
        format="json",
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["razon_social"] == "Fready Balaguera"

    ajustes = StoreSettings.objects.get(tenant=negocio)
    # El contacto, en la configuración de la tienda; lo legal, en su centro legal.
    assert ajustes.nombre_empresa == "La Gran Cosecha"
    assert ajustes.telefono == "3002124562"
    assert ajustes.legal["empresa"]["razon_social"] == "Fready Balaguera"
    assert ajustes.legal["empresa"]["nit"] == "80.760.871-1"

    leida = staff_plataforma.get(f"/api/platform/tenants/{negocio.id}/identidad/").json()
    assert leida["nit"] == "80.760.871-1"
    assert leida["ciudad"] == "Soacha"


def test_editar_la_identidad_no_borra_el_resto_del_centro_legal(staff_plataforma, negocio):
    from apps.content.models import StoreSettings

    ajustes, _ = StoreSettings.objects.get_or_create(tenant=negocio)
    ajustes.legal = {"empresa": {"matricula_mercantil": "12345"}, "envios": {"horarios": "7am"}}
    ajustes.save(update_fields=["legal"])

    staff_plataforma.patch(
        f"/api/platform/tenants/{negocio.id}/identidad/", {"nit": "900.1"}, format="json"
    )

    ajustes.refresh_from_db()
    assert ajustes.legal["empresa"] == {"matricula_mercantil": "12345", "nit": "900.1"}
    assert ajustes.legal["envios"] == {"horarios": "7am"}


def test_un_negocio_no_edita_la_identidad_desde_la_plataforma(api_owner, negocio):
    respuesta = api_owner.patch(
        f"/api/platform/tenants/{negocio.id}/identidad/", {"nit": "1"}, format="json"
    )
    assert respuesta.status_code in (401, 403)


def test_se_puede_mover_una_empresa_de_plan(staff_plataforma, negocio):
    respuesta = staff_plataforma.post(
        f"/api/platform/tenants/{negocio.id}/cambiar-plan/",
        {"plan": "growth"},
        format="json",
    )
    assert respuesta.status_code == 200

    # Se relee desde la base y no desde la relación en memoria, que sigue
    # apuntando al plan anterior.
    from apps.billing.models import Subscription

    assert Subscription.objects.get(tenant=negocio).plan.slug == "growth"


def test_un_plan_con_empresas_dentro_no_se_borra(staff_plataforma, negocio):
    """
    Borrarlo dejaría a esos negocios sin plan y sin permisos de un golpe. Se
    desactiva, que es lo que de verdad se quiere decir.
    """
    plan = negocio.suscripcion.plan
    staff_plataforma.delete(f"/api/platform/plans/{plan.id}/")

    plan.refresh_from_db()
    assert plan.activo is False


def test_un_negocio_nuevo_nace_con_el_plan_por_defecto(negocio):
    """
    Sin suscripción, una empresa recién dada de alta no podría repartir ni un
    permiso entre su gente, y el alta quedaría a medias sin que nadie
    entendiera por qué.

    (A los negocios que ya existían antes de haber planes los sube al plan más
    alto la migración `billing.0002`: llevaban meses usando el sistema entero y
    recortarles el acceso al desplegar sería quitarles algo que ya tenían.)
    """
    assert negocio.suscripcion.plan.slug == "starter"
    assert negocio.suscripcion.estado == "PRUEBA"


def test_los_limites_se_pueden_pactar_por_empresa(negocio):
    """Evita inventar un plan nuevo para un solo cliente que negoció algo."""
    suscripcion = negocio.suscripcion
    assert suscripcion.limite("max_usuarios") == 2  # lo que da Starter

    suscripcion.limites_extra = {"max_usuarios": 50}
    suscripcion.save(update_fields=["limites_extra"])
    assert suscripcion.limite("max_usuarios") == 50


# ---------------------------------------------------------------- dominios


def _url_dominios(negocio, extra=""):
    return f"/api/platform/tenants/{negocio.pk}/dominios/{extra}"


def test_se_conecta_un_dominio_y_el_primero_es_el_principal(staff_plataforma, negocio):
    from apps.tenancy.models import Domain

    Domain.objects.filter(tenant=negocio).delete()
    r = staff_plataforma.post(_url_dominios(negocio), {"hostname": "https://Tienda.Ejemplo.com/"}, format="json")
    assert r.status_code == 201
    assert r.json()[0]["hostname"] == "tienda.ejemplo.com"
    assert r.json()[0]["es_primario"] is True


def test_no_se_conecta_un_dominio_de_otra_empresa(staff_plataforma, negocio):
    from apps.tenancy.models import Domain, Tenant

    otro = Tenant.objects.create(slug="otra-empresa", nombre="Otra")
    Domain.objects.create(tenant=otro, hostname="ocupado.ejemplo.com", es_primario=True)
    r = staff_plataforma.post(_url_dominios(negocio), {"hostname": "ocupado.ejemplo.com"}, format="json")
    assert r.status_code == 400


def test_un_hostname_invalido_se_rechaza(staff_plataforma, negocio):
    r = staff_plataforma.post(_url_dominios(negocio), {"hostname": "no es un dominio"}, format="json")
    assert r.status_code == 400


def test_hacer_principal_a_otro_dominio_quita_la_marca_al_anterior(staff_plataforma, negocio):
    from apps.tenancy.models import Domain

    Domain.objects.filter(tenant=negocio).delete()
    Domain.objects.create(tenant=negocio, hostname="uno.ejemplo.com", es_primario=True)
    Domain.objects.create(tenant=negocio, hostname="dos.ejemplo.com", es_primario=False)
    r = staff_plataforma.patch(_url_dominios(negocio, "dos.ejemplo.com/"), {"es_primario": True}, format="json")
    assert r.status_code == 200
    principales = [d["hostname"] for d in r.json() if d["es_primario"]]
    assert principales == ["dos.ejemplo.com"]


def test_se_puede_renombrar_un_dominio(staff_plataforma, negocio):
    from apps.tenancy.models import Domain

    Domain.objects.filter(tenant=negocio).delete()
    Domain.objects.create(tenant=negocio, hostname="viejo.ejemplo.com", es_primario=True)
    r = staff_plataforma.patch(_url_dominios(negocio, "viejo.ejemplo.com/"), {"hostname": "nuevo.ejemplo.com"}, format="json")
    assert r.status_code == 200
    assert [d["hostname"] for d in r.json()] == ["nuevo.ejemplo.com"]


def test_quitar_el_principal_promueve_al_siguiente(staff_plataforma, negocio):
    from apps.tenancy.models import Domain

    Domain.objects.filter(tenant=negocio).delete()
    Domain.objects.create(tenant=negocio, hostname="uno.ejemplo.com", es_primario=True)
    Domain.objects.create(tenant=negocio, hostname="dos.ejemplo.com", es_primario=False)
    r = staff_plataforma.post(_url_dominios(negocio, "uno.ejemplo.com/quitar/"), {}, format="json")
    assert r.status_code == 200
    assert r.json() == [{"hostname": "dos.ejemplo.com", "es_primario": True, "verificado": True}]


def test_un_negocio_no_administra_dominios_desde_la_plataforma(api_owner, negocio):
    r = api_owner.post(_url_dominios(negocio), {"hostname": "x.ejemplo.com"}, format="json")
    assert r.status_code in (401, 403)


def test_borrar_la_empresa_sigue_sin_poder(staff_plataforma, negocio):
    r = staff_plataforma.delete(f"/api/platform/tenants/{negocio.pk}/")
    assert r.status_code == 405


# ------------------------------------------------------------ integraciones


def test_el_estado_de_integraciones_no_expone_ningun_valor(staff_plataforma, settings):
    settings.BREVO_API_KEY = "clave-super-secreta-123"
    r = staff_plataforma.get("/api/platform/integrations/")
    assert r.status_code == 200
    ids = [i["id"] for i in r.json()]
    assert ids == ["base_datos", "almacenamiento", "correo", "whatsapp"]
    assert "clave-super-secreta-123" not in r.content.decode()
    brevo = next(v for i in r.json() if i["id"] == "correo" for v in i["variables"] if v["nombre"] == "BREVO_API_KEY")
    assert brevo["definida"] is True


def test_la_base_de_datos_se_prueba_de_verdad(staff_plataforma):
    r = staff_plataforma.post("/api/platform/integrations/base_datos/probar/", {}, format="json")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_whatsapp_no_tiene_prueba_unica(staff_plataforma):
    r = staff_plataforma.post("/api/platform/integrations/whatsapp/probar/", {}, format="json")
    assert r.status_code == 400


def test_un_negocio_no_ve_las_integraciones_de_la_plataforma(api_owner):
    assert api_owner.get("/api/platform/integrations/").status_code in (401, 403)
    assert api_owner.post("/api/platform/integrations/base_datos/probar/", {}, format="json").status_code in (401, 403)


def test_se_guarda_una_credencial_cifrada_y_nunca_vuelve(staff_plataforma, settings):
    from apps.billing.models import ConfiguracionIntegracion

    settings.BREVO_API_KEY = ""
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    r = staff_plataforma.patch(
        "/api/platform/integrations/correo/", {"valores": {"BREVO_API_KEY": "xkeysib-secreto-999"}}, format="json"
    )
    assert r.status_code == 200
    assert "xkeysib-secreto-999" not in r.content.decode()
    fila = ConfiguracionIntegracion.objects.get(clave="BREVO_API_KEY")
    assert "xkeysib-secreto-999" not in fila.valor_cifrado  # en la base va cifrada
    variable = next(v for v in r.json()["variables"] if v["nombre"] == "BREVO_API_KEY")
    assert variable["definida"] is True and variable["origen"] == "panel" and variable["secreta"] is True
    assert "valor" not in variable
    # ...y se aplicó donde el código la lee
    assert settings.BREVO_API_KEY == "xkeysib-secreto-999"


def test_un_valor_no_secreto_si_precarga_el_formulario(staff_plataforma, settings):
    settings.R2_BUCKET_NAME = ""
    r = staff_plataforma.patch(
        "/api/platform/integrations/almacenamiento/", {"valores": {"R2_BUCKET_NAME": "mi-bucket"}}, format="json"
    )
    assert r.status_code == 200
    assert r.json()["requiere_reinicio"] is True
    variable = next(v for v in r.json()["variables"] if v["nombre"] == "R2_BUCKET_NAME")
    assert variable["valor"] == "mi-bucket"


def test_quitar_el_valor_devuelve_el_control_al_entorno(staff_plataforma, settings):
    from apps.billing.models import ConfiguracionIntegracion

    settings.TWILIO_ACCOUNT_SID = ""
    staff_plataforma.patch("/api/platform/integrations/whatsapp/", {"valores": {"TWILIO_ACCOUNT_SID": "ACabc"}}, format="json")
    assert ConfiguracionIntegracion.objects.filter(clave="TWILIO_ACCOUNT_SID").exists()
    r = staff_plataforma.patch("/api/platform/integrations/whatsapp/", {"valores": {"TWILIO_ACCOUNT_SID": ""}}, format="json")
    assert r.status_code == 200
    assert not ConfiguracionIntegracion.objects.filter(clave="TWILIO_ACCOUNT_SID").exists()


def test_no_se_aceptan_variables_ajenas_ni_la_base_de_datos(staff_plataforma):
    r = staff_plataforma.patch("/api/platform/integrations/correo/", {"valores": {"SECRET_KEY": "x"}}, format="json")
    assert r.status_code == 400
    r = staff_plataforma.patch("/api/platform/integrations/base_datos/", {"valores": {"DATABASE_URL": "x"}}, format="json")
    assert r.status_code == 400


def test_se_valida_el_formato_de_lo_que_se_guarda(staff_plataforma):
    r = staff_plataforma.patch("/api/platform/integrations/correo/", {"valores": {"DEFAULT_FROM_EMAIL": "sin arroba"}}, format="json")
    assert r.status_code == 400
    assert "DEFAULT_FROM_EMAIL" in r.json()["valores"]


def test_un_negocio_no_guarda_credenciales_de_la_plataforma(api_owner):
    r = api_owner.patch("/api/platform/integrations/correo/", {"valores": {"BREVO_API_KEY": "x"}}, format="json")
    assert r.status_code in (401, 403)


def test_el_cifrado_es_reversible_y_no_deja_el_valor_a_la_vista():
    from apps.billing import secretos

    token = secretos.cifrar("mi-secreto")
    assert "mi-secreto" not in token
    assert secretos.descifrar(token) == "mi-secreto"
    assert secretos.descifrar("basura") is None
