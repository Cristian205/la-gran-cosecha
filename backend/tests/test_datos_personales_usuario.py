"""
Datos personales de los usuarios del panel: teléfono, dirección, tipo y
número de documento.

Al crear son obligatorios y se validan (y limpian) en el backend; al editar
son opcionales, pero si se envían cumplen las mismas reglas. Un documento no
puede identificar a dos usuarios. Las cuentas antiguas, sin estos datos,
siguen funcionando.
"""
import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

URL = "/api/auth/users/"

DATOS = {
    "email": "nueva@ejemplo.test",
    "nombre": "Nueva Persona",
    "rol": "ANALISTA",
    "telefono_usuario": "+57 300 123 4567",
    "direccion_usuario": "Calle 10 # 20-30, Bogotá",
    "tipo_documento": "CC",
    "numero_documento": "1.023.456.789",
}


def test_crear_guarda_los_datos_limpios(api_owner):
    r = api_owner.post(URL, DATOS, format="json")
    assert r.status_code == 201, r.json()
    u = r.json()["usuario"]
    assert u["telefono_usuario"] == "+573001234567"
    assert u["numero_documento"] == "1023456789"
    assert u["tipo_documento"] == "CC"
    assert u["direccion_usuario"] == "Calle 10 # 20-30, Bogotá"


@pytest.mark.parametrize("campo", ["telefono_usuario", "direccion_usuario", "tipo_documento", "numero_documento"])
def test_crear_exige_cada_dato_personal(api_owner, campo):
    datos = {k: v for k, v in DATOS.items() if k != campo}
    r = api_owner.post(URL, datos, format="json")
    assert r.status_code == 400
    assert campo in r.json()


@pytest.mark.parametrize(
    "tipo,numero,valido",
    [
        ("CC", "12345", False),  # muy corta
        ("CC", "12A4567", False),  # letras en una cédula
        ("CC", "1023456789", True),
        ("PA", "ab12345", True),  # pasaporte alfanumérico, se guarda en mayúsculas
        ("TI", "123456789", False),
    ],
)
def test_el_numero_sigue_las_reglas_de_su_tipo(api_owner, tipo, numero, valido):
    r = api_owner.post(URL, {**DATOS, "tipo_documento": tipo, "numero_documento": numero}, format="json")
    assert (r.status_code == 201) is valido, r.json()
    if valido and tipo == "PA":
        assert r.json()["usuario"]["numero_documento"] == "AB12345"


def test_un_telefono_invalido_se_rechaza(api_owner):
    r = api_owner.post(URL, {**DATOS, "telefono_usuario": "12ab"}, format="json")
    assert r.status_code == 400
    assert "telefono_usuario" in r.json()


def test_un_documento_no_identifica_a_dos_usuarios(api_owner):
    assert api_owner.post(URL, DATOS, format="json").status_code == 201
    r = api_owner.post(URL, {**DATOS, "email": "otra@ejemplo.test"}, format="json")
    assert r.status_code == 400
    assert "numero_documento" in r.json()


def test_editar_es_opcional_pero_valida(api_owner, usuario_staff):
    # Una cuenta antigua sin datos se sigue editando sin ellos.
    r = api_owner.patch(f"{URL}{usuario_staff.pk}/", {"nombre_usuario": "Analista Uno"}, format="json")
    assert r.status_code == 200, r.json()

    # Si se envían, cumplen las reglas.
    r = api_owner.patch(f"{URL}{usuario_staff.pk}/", {"tipo_documento": "CC"}, format="json")
    assert r.status_code == 400 and "numero_documento" in r.json()

    r = api_owner.patch(
        f"{URL}{usuario_staff.pk}/",
        {"tipo_documento": "CE", "numero_documento": "e 123456", "telefono_usuario": "3001112233"},
        format="json",
    )
    assert r.status_code == 200, r.json()
    usuario_staff.refresh_from_db()
    assert usuario_staff.numero_documento == "E123456"
    assert usuario_staff.telefono_usuario == "3001112233"


def test_editar_conserva_su_propio_documento(api_owner, usuario_staff):
    get_user_model().objects.filter(pk=usuario_staff.pk).update(tipo_documento="CC", numero_documento="1023456789")
    # Reenviar el mismo documento no choca consigo mismo.
    r = api_owner.patch(
        f"{URL}{usuario_staff.pk}/", {"tipo_documento": "CC", "numero_documento": "1023456789"}, format="json"
    )
    assert r.status_code == 200, r.json()
