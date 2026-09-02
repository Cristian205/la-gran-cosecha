"""
Buscar un patron en el CODIGO, sin tropezar con la prosa que lo explica.

Existe por un fallo que estuvo escondido tres fases y que conviene contar
entero, porque el modo de fallo se repite.

Dos guardias del proyecto —«nadie ramifica por sector» y «el POS no sabe que
existen las reservas»— buscaban su patron con `git grep`. Eso tenia dos
agujeros a la vez:

1. `git grep` solo mira archivos SEGUIDOS. Mientras `apps/pos` y
   `apps/reservations` estuvieron sin comitear, los dos tests pasaban sin
   buscar en ninguna parte. Un guardia que pasa por no encontrar los archivos
   es peor que no tenerlo: da la confianza sin dar la comprobacion.

2. En cuanto se comitearon, saltaron — contra los DOCSTRINGS que explican
   justamente la regla. `capacidades.py` dice «en cuanto alguien escriba
   `if sector == "ferreteria"`…» y eso no es una rama: es la frase que pide no
   escribirla.

Asi que aqui se lee del disco —seguido o no— y se salta lo que es prosa: los
docstrings y los comentarios. Lo que queda es codigo, y un patron que aparezca
ahi si es una violacion.
"""
import ast
import re
from pathlib import Path


def _rangos_de_prosa(arbol) -> list[tuple[int, int]]:
    """
    Las lineas que ocupan los docstrings y las cadenas sueltas.

    Un docstring es, para el arbol, una sentencia cuya expresion es una cadena
    y nada mas. Se detectan asi y no por comillas al principio de la linea
    porque los de este proyecto son largos: lo que hay que saltar es el bloque
    entero, no su primera linea.
    """
    rangos = []
    for nodo in ast.walk(arbol):
        if (
            isinstance(nodo, ast.Expr)
            and isinstance(nodo.value, ast.Constant)
            and isinstance(nodo.value.value, str)
        ):
            rangos.append((nodo.lineno, nodo.end_lineno or nodo.lineno))
    return rangos


def buscar_en_codigo(raiz, patron: str) -> list[str]:
    """
    Las lineas de codigo real que casan con el patron.

    Los comentarios se recortan partiendo por la primera almohadilla. Es
    aproximado —una almohadilla dentro de una cadena recorta de mas— y el error
    cae del lado de no denunciar. Se acepta a proposito: la alternativa es
    tokenizar cada archivo para distinguir las dos, y un guardia que se pierda
    el caso de `x = "#reservas"` sigue cazando todos los que importan.
    """
    regex = re.compile(patron)
    hallazgos = []

    for archivo in sorted(Path(raiz).rglob("*.py")):
        if "__pycache__" in archivo.parts:
            continue

        fuente = archivo.read_text(encoding="utf-8")
        try:
            prosa = _rangos_de_prosa(ast.parse(fuente))
        except SyntaxError:  # pragma: no cover — un archivo a medias de editar
            prosa = []

        for numero, linea in enumerate(fuente.splitlines(), start=1):
            if any(desde <= numero <= hasta for desde, hasta in prosa):
                continue
            if regex.search(linea.split("#", 1)[0]):
                hallazgos.append(f"{archivo}:{numero}: {linea.strip()}")

    return hallazgos
