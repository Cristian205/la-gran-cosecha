"""
Reglas de cantidad de una presentación: desde cuánto y de cuánto en cuánto
se puede pedir.

Una presentación vende en una secuencia aritmética:

    mínima, mínima + incremento, mínima + 2·incremento, …

con a lo sumo `decimales` cifras decimales. "Kilogramo desde 0,5 de 0,25 en
0,25" admite 0,5 · 0,75 · 1 · 1,25…; "Caja desde 6 de 6 en 6", 6 · 12 · 18.

Vive en un módulo propio, y no dentro del serializer, porque la misma regla la
aplican tres sitios que no pueden discrepar: el alta de la presentación en el
panel, el pedido de la tienda y la copia en TypeScript del panel
(`admin-panel/src/utils/cantidades.ts`) y de la tienda. Todo en `Decimal`: con
`float`, 0,1 + 0,2 no es 0,3 y una cantidad válida acabaría rechazada.

Por qué la mínima tiene que ser múltiplo del incremento: así la secuencia cae
siempre sobre la misma rejilla (0,25 · 0,5 · 0,75 · 1…) y la cantidad que el
cliente escribe a mano se puede validar sin conocer la mínima. "Desde 0,3 de
0,25 en 0,25" daría 0,3 · 0,55 · 0,8, que nadie pesa en un mostrador.
"""
from decimal import Decimal, InvalidOperation

#: El tope lo pone `DetallePedido.cantidad` (dos decimales). Una presentación
#: que admitiera 0,125 kg vendería cantidades que el pedido no puede guardar.
MAX_DECIMALES = 2
#: El mayor valor que cabe en `DecimalField(max_digits=10, decimal_places=2)`.
MAXIMO = Decimal("99999999.99")


def decimales_de(valor: Decimal) -> int:
    """Cifras decimales significativas: 1,50 → 1; 2 → 0; 0,25 → 2."""
    exponente = valor.normalize().as_tuple().exponent
    return -exponente if isinstance(exponente, int) and exponente < 0 else 0


def _como_decimal(valor) -> Decimal | None:
    if valor is None or valor == "":
        return None
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, ValueError):
        return None
    return numero if numero.is_finite() else None


def validar_regla(cantidad_minima, incremento, decimales) -> dict[str, str]:
    """
    Los errores de una regla de cantidad, por campo. Vacío si es válida.

    Devuelve todos los errores a la vez y no el primero: el formulario los
    pinta debajo de cada campo y obligar a corregir de uno en uno es un
    ida y vuelta por campo.
    """
    errores: dict[str, str] = {}

    try:
        decimales = int(decimales)
    except (TypeError, ValueError):
        decimales = None
    if decimales is None or not 0 <= decimales <= MAX_DECIMALES:
        errores["decimales_cantidad"] = (
            f"Elige entre 0 y {MAX_DECIMALES} decimales."
        )
        decimales = MAX_DECIMALES

    minima = _como_decimal(cantidad_minima)
    paso = _como_decimal(incremento)

    for campo, valor, nombre in (
        ("cantidad_minima", minima, "La cantidad mínima"),
        ("incremento_cantidad", paso, "El incremento"),
    ):
        if valor is None:
            errores[campo] = f"{nombre} debe ser un número."
        elif valor <= 0:
            errores[campo] = f"{nombre} debe ser mayor que cero."
        elif valor > MAXIMO:
            errores[campo] = f"{nombre} es demasiado grande."
        elif decimales_de(valor) > decimales:
            errores[campo] = (
                f"{nombre} no puede tener decimales con esta precisión."
                if decimales == 0
                else f"{nombre} admite como máximo {decimales} decimal"
                f"{'es' if decimales > 1 else ''}."
            )

    if "cantidad_minima" not in errores and "incremento_cantidad" not in errores:
        if minima % paso != 0:
            errores["cantidad_minima"] = (
                "La cantidad mínima debe ser múltiplo del incremento "
                f"(por ejemplo {formatear(paso)} o {formatear(paso * 2)})."
            )
    return errores


def cantidad_valida(cantidad, cantidad_minima, incremento, decimales) -> bool:
    """¿Cae `cantidad` en la secuencia mínima, mínima + incremento, …?"""
    valor = _como_decimal(cantidad)
    minima = _como_decimal(cantidad_minima)
    paso = _como_decimal(incremento)
    if valor is None or minima is None or paso is None or paso <= 0:
        return False
    if valor < minima or decimales_de(valor) > int(decimales):
        return False
    return (valor - minima) % paso == 0


def ejemplos(cantidad_minima, incremento, cuantos: int = 5) -> list[Decimal]:
    """Las primeras cantidades válidas, para describir la regla."""
    minima = Decimal(str(cantidad_minima))
    paso = Decimal(str(incremento))
    return [minima + paso * i for i in range(cuantos)]


def formatear(valor) -> str:
    """1.50 → "1,5"; 2.00 → "2". Como se escribe en Colombia."""
    numero = Decimal(str(valor)).normalize()
    texto = format(numero, "f")
    return texto.replace(".", ",")


def describir(presentacion) -> str:
    """"desde 0,5 y de 0,25 en 0,25", para los mensajes de error del pedido."""
    minima = formatear(presentacion.cantidad_minima)
    paso = formatear(presentacion.incremento_cantidad)
    if presentacion.cantidad_minima == presentacion.incremento_cantidad:
        return f"de {paso} en {paso}"
    return f"desde {minima} y de {paso} en {paso}"


def regla_por_defecto(producto) -> dict:
    """
    La regla que tenía el producto antes de que cada presentación tuviera la
    suya (`tipo_cantidad` + `permite_fraccion`).

    La usan la migración que reparte la regla a las presentaciones existentes
    y el alta de presentaciones por clientes viejos que todavía no envían la
    regla: se comportan exactamente como antes.
    """
    if producto is not None and producto.permite_fraccion:
        if producto.tipo_cantidad == "cuarto":
            paso = Decimal("0.25")
        elif producto.tipo_cantidad == "medio":
            paso = Decimal("0.5")
        else:
            paso = Decimal("1")
    else:
        paso = Decimal("1")
    return {
        "cantidad_minima": paso,
        "incremento_cantidad": paso,
        "decimales_cantidad": decimales_de(paso),
    }
