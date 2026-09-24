"""
La historia de /nosotros (migración 0047).

Protege tres promesas: la composición es válida para el motor, cada bloque
que usa existe en el registro del frontend, y los textos no afirman cifras
que el negocio no ha dado (años, clientes, toneladas, porcentajes).
"""
import importlib
import json
import re
from pathlib import Path

import pytest

RAIZ_TIENDA = Path(__file__).resolve().parents[2] / "frontend" / "tienda"


def _migracion():
    return importlib.import_module("apps.storefront.migrations.0047_nosotros_storytelling")


def test_la_composicion_de_nosotros_es_valida(db):
    from apps.storefront import composicion

    nosotros = _migracion().NOSOTROS
    assert len(composicion.validar(nosotros)) == len(nosotros)


def test_cada_bloque_de_nosotros_esta_en_el_registro_del_frontend():
    registro = (RAIZ_TIENDA / "src" / "bloques" / "registro.tsx").read_text(encoding="utf-8")
    for b in _migracion().NOSOTROS:
        assert f'"{b["tipo"]}"' in registro, f"«{b['tipo']}» no está en registro.tsx"


def test_los_textos_no_inventan_cifras():
    # Todo lo visible, sin las URLs (que sí llevan números).
    textos = []
    for b in _migracion().NOSOTROS:
        for clave, valor in b["props"].items():
            if "url" in clave or clave in ("imagen", "imagen_movil", "enfoque", "enfoque_movil"):
                continue
            textos.append(json.dumps(valor, ensure_ascii=False))
    todo = re.sub(r'"(imagen|video_url|alt|enfoque)":\s*"[^"]*"', "", " ".join(textos))
    assert not re.search(r"\d", todo), "Un texto de /nosotros afirma una cifra"


def test_las_cifras_quedan_como_espacio_vacio():
    origen = next(b for b in _migracion().NOSOTROS if b["tipo"] == "nosotros-origen")
    assert origen["props"]["datos"] == []


@pytest.mark.parametrize("tipo", ["nosotros-proceso", "nosotros-equipo", "nosotros-negocios"])
def test_cada_escena_admite_foto_y_video(db, tipo):
    from apps.storefront.models import Bloque

    esquema = Bloque.objects.get(codigo=tipo).esquema_props["properties"]
    items = next(v for v in esquema.values() if v.get("tipo") == "array")["items"]["properties"]
    for campo in ("imagen", "imagen_movil", "video_url", "video_movil_url"):
        assert campo in items
