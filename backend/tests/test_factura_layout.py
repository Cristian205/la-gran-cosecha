"""
La factura de un pedido grande cabe en una sola hoja.

Un pedido de 58 artículos salía en dos hojas: 40 eran de categorías
especiales (Salsamentaria, Desechables, Dulcería), que van en una franja
aparte con dos líneas por artículo, y esa franja se comía la hoja entera.
"""
from collections import OrderedDict
from decimal import Decimal

import pytest

from apps.orders.factura_layout import FUENTE_MINIMA_COMODA, planificar


class Cat:
    def __init__(self, nombre):
        self.nombre_categoria = nombre

    def __repr__(self):
        return self.nombre_categoria


def _items(n, prefijo):
    return [
        {
            "articulo": f"{prefijo} {i}",
            "pres": "Común",
            "unidad": "und",
            "cant": Decimal("3"),
            "subtotal": Decimal("45000"),
        }
        for i in range(n)
    ]


def _pedido(normales, especiales):
    cn = OrderedDict(
        (Cat(nombre), _items(n, nombre)) for nombre, n in normales.items()
    )
    ce = OrderedDict(
        (Cat(nombre), _items(n, nombre)) for nombre, n in especiales.items()
    )
    return cn, ce


@pytest.mark.parametrize(
    "normales, especiales",
    [
        ({"Frutas": 5, "Tuberculos": 9, "Verduras": 4}, {"Salsamentaria": 14, "Desechables": 12, "Dulceria": 14}),
        ({"Frutas": 15, "Tuberculos": 15, "Verduras": 10}, {"Salsamentaria": 20, "Desechables": 10, "Dulceria": 10}),
        ({"Frutas": 30, "Tuberculos": 30, "Verduras": 20}, {}),
    ],
    ids=["58-con-40-especiales", "80-mixto", "80-normales"],
)
def test_hasta_80_articulos_caben_en_una_hoja(normales, especiales):
    cn, ce = _pedido(normales, especiales)
    plan = planificar(cn, ce)

    assert plan.cabe_en_una_hoja
    assert not plan.varias_hojas


def test_muchos_especiales_van_en_una_sola_tabla_otros_productos():
    """
    Pedido del cliente: Desechables, Salsamentaria y Dulcería van SIEMPRE
    juntos en "Otros Productos"; las demás categorías, cada una en su tabla.
    """
    cn, ce = _pedido(
        {"Frutas": 5, "Verduras": 4},
        {"Salsamentaria": 20, "Desechables": 10, "Dulceria": 20},
    )
    plan = planificar(cn, ce)

    assert plan.especiales_en_columnas
    secciones = [seccion for columna in plan.columnas for seccion in columna]
    tablas = {str(s.categoria) for s in secciones}
    assert tablas == {"Frutas", "Verduras", "Otros Productos"}
    # Todos los especiales están en "Otros Productos", aunque la tabla se
    # parta entre columnas ("Otros Productos (cont.)").
    otros = [it for s in secciones if str(s.categoria) == "Otros Productos" for it in s.items]
    assert len(otros) == 50


def test_pocos_especiales_siguen_en_su_franja():
    """Con un pedido corto la franja "Otros Productos" se queda como siempre."""
    cn, ce = _pedido({"Frutas": 4, "Verduras": 4}, {"Dulceria": 2})
    plan = planificar(cn, ce)

    assert not plan.especiales_en_columnas
    assert plan.densidad.fuente_pt >= FUENTE_MINIMA_COMODA


def test_el_precio_mas_largo_cabe_entero_en_su_celda():
    """La celda del precio se ajusta a la cifra más ancha del pedido, sin cortarla."""
    from apps.orders.factura_layout import ANCHO_UTIL_PT, _ancho_texto, pad_horizontal_px

    cn, ce = _pedido({"Frutas": 30, "Desechables": 0}, {})
    grande = {"articulo": "Taza", "pres": "Sopera", "unidad": "cj", "cant": Decimal("6"), "subtotal": Decimal("1068000")}
    next(iter(cn.values())).append(grande)
    plan = planificar(cn, ce)

    ancho_celda = ANCHO_UTIL_PT / plan.n_columnas * plan.anchos[2]
    relleno = pad_horizontal_px(plan.densidad.fuente_pt) * 2 * 0.75
    assert _ancho_texto("$ 1,068,000", plan.densidad.fuente_pt, negrita=True) <= ancho_celda - relleno
    assert abs(sum(plan.anchos) - 1) < 1e-6


def test_la_columna_de_precio_cabe_en_el_ancho_real_de_la_tarjeta():
    """
    Pedido 18 (~96 artículos, tres columnas): "$ 170.000" salía "$ 170.0…".

    El reparto suponía tablas de ANCHO_UTIL_PT / n, sin descontar el hueco entre
    columnas ni el borde de cada tarjeta. Se comprueba contra el ancho medido en
    el PDF (146,3pt por tarjeta con tres columnas) que la cifra más ancha cabe.
    """
    from apps.orders.factura_layout import _ancho_texto, _pad_celda_pt, ancho_tabla_pt

    assert ancho_tabla_pt(3) == pytest.approx(146.33 - 1.5, abs=0.1)

    cn, ce = _pedido({"Frutas": 25, "Tuberculos": 25, "Granos": 26, "Verduras": 20}, {})
    for items in cn.values():
        items[0]["subtotal"] = Decimal("170000")
    plan = planificar(cn, ce)

    f_precio = plan.anchos[2]
    contenido = f_precio * ancho_tabla_pt(plan.n_columnas) - _pad_celda_pt(plan.densidad)
    assert contenido >= _ancho_texto("$ 170.000", plan.densidad.fuente_pt, negrita=True)


def test_las_celdas_de_cifras_no_dejan_espacio_al_final():
    """Un salto de línea dentro de la celda se pinta como espacio y no se mide."""
    from pathlib import Path

    plantilla = (
        Path(__file__).resolve().parents[1] / "apps/orders/templates/orders/pdf/_factura_body.html"
    ).read_text(encoding="utf-8")
    assert "intcomma }}</td>" in plantilla
    assert "|lower }}</span></td>" in plantilla
