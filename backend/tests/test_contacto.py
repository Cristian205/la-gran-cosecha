"""
/contacto como conversión (migraciones storefront/0048 y contact/0007).

Protege cuatro promesas: la composición es válida para el motor, cada bloque
existe en el registro del frontend, cada enlace a un camino del selector
(`#cotizar`…) existe de verdad, y una solicitud llega a la bandeja con su
motivo aunque el cliente solo deje el teléfono — pero nunca sin forma de
responderle.
"""
import importlib
import json
import re
from pathlib import Path

import pytest

RAIZ_TIENDA = Path(__file__).resolve().parents[2] / "frontend" / "tienda"
URL_MENSAJES = "/api/contact/messages/"


def _migracion():
    return importlib.import_module("apps.storefront.migrations.0048_contacto_conversion")


def _enlaces_del_selector():
    """Los enlaces que abren un camino, leídos de `contacto/intenciones.ts`."""
    fuente = (RAIZ_TIENDA / "src" / "bloques" / "contacto" / "intenciones.ts").read_text(encoding="utf-8")
    bloque = fuente[fuente.index("ENLACE_DE") : fuente.index("};", fuente.index("ENLACE_DE"))]
    return dict(re.findall(r'(\w+):\s*"(#[\w-]+)"', bloque))


def test_la_composicion_de_contacto_es_valida(db):
    from apps.storefront import composicion

    contacto = _migracion().CONTACTO
    assert len(composicion.validar(contacto)) == len(contacto)


def test_cada_bloque_de_contacto_esta_en_el_registro_del_frontend():
    registro = (RAIZ_TIENDA / "src" / "bloques" / "registro.tsx").read_text(encoding="utf-8")
    for b in _migracion().CONTACTO:
        assert f'"{b["tipo"]}"' in registro, f"«{b['tipo']}» no está en registro.tsx"


def test_los_cuatro_caminos_estan_en_el_selector():
    enlaces = _enlaces_del_selector()
    selector = next(b for b in _migracion().CONTACTO if b["tipo"] == "contacto-intenciones")
    claves = [o["clave"] for o in selector["props"]["opciones"]]
    assert claves == ["pedido", "cotizacion", "producto", "hablar"]
    assert set(claves) == set(enlaces)


def test_cada_enlace_interno_abre_un_camino_que_existe():
    validos = set(_enlaces_del_selector().values())
    usados = re.findall(r'"(#[\w-]+)"', json.dumps(_migracion().CONTACTO))
    assert usados, "La página debería enlazar a sus caminos"
    for enlace in usados:
        assert enlace in validos, f"«{enlace}» no abre ningún camino del selector"


def test_los_textos_no_inventan_cifras_ni_horarios():
    # Solo los VALORES visibles: sin URLs, enfoques ni ids (que sí llevan
    # números) y sin los nombres de campo (`cta2_texto`).
    def textos(nodo, clave=""):
        if isinstance(nodo, dict):
            for k, v in nodo.items():
                yield from textos(v, k)
        elif isinstance(nodo, list):
            for v in nodo:
                yield from textos(v, clave)
        elif isinstance(nodo, str) and not re.match(r"(imagen|video|poster|enfoque|id$)", clave):
            yield nodo

    visibles = " ".join(textos(_migracion().CONTACTO))
    assert not re.search(r"\d", visibles), "Un texto de /contacto afirma una cifra o un número"
    assert "horario" not in visibles.lower()


# --------------------------------------------------------------- la bandeja
def test_una_cotizacion_solo_con_telefono_llega_con_su_motivo(api, negocio):
    from apps.contact.models import MensajeContacto

    r = api.post(
        URL_MENSAJES,
        {
            "nombre": "Restaurante La Esquina",
            "telefono": "300 000 0000",
            "mensaje": "Solicitud de cotización (pedido grande)\nCantidad aproximada: dos bultos",
            "motivo": "COTIZACION",
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    mensaje = MensajeContacto.objects.get()
    assert mensaje.motivo == "COTIZACION"
    assert mensaje.email == ""


def test_sin_telefono_ni_correo_no_hay_a_quien_responder(api, negocio):
    r = api.post(URL_MENSAJES, {"nombre": "Ana", "mensaje": "Hola", "motivo": "CONSULTA"}, format="json")
    assert r.status_code == 400
    assert "telefono" in r.data


def test_el_formulario_de_siempre_sigue_funcionando(api, negocio):
    from apps.contact.models import MensajeContacto

    r = api.post(
        URL_MENSAJES,
        {"nombre": "Ana", "email": "ana@correo.com", "mensaje": "Hola"},
        format="json",
    )
    assert r.status_code == 201, r.data
    assert MensajeContacto.objects.get().motivo == "CONSULTA"


def test_un_motivo_desconocido_se_rechaza(api, negocio):
    r = api.post(
        URL_MENSAJES,
        {"nombre": "Ana", "telefono": "3000000000", "mensaje": "Hola", "motivo": "OTRA_COSA"},
        format="json",
    )
    assert r.status_code == 400
    assert "motivo" in r.data


@pytest.mark.parametrize("tipo", ["contacto-hero", "contacto-escenarios"])
def test_los_espacios_de_foto_admiten_video(db, tipo):
    from apps.storefront.models import Bloque

    esquema = Bloque.objects.get(codigo=tipo).esquema_props["properties"]
    if tipo == "contacto-escenarios":
        esquema = esquema["escenarios"]["items"]["properties"]
    for campo in ("imagen", "imagen_movil", "video_url", "video_movil_url"):
        assert campo in esquema
