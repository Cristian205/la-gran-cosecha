from decimal import Decimal, InvalidOperation


def convertir_texto_a_decimal(texto):
    """
    Convierte un texto proveniente de un formulario a Decimal de forma tolerante.
    Portado de la lógica original (`convertir_texto_a_decimal` en views.py).
    Acepta coma o punto como separador decimal y devuelve Decimal("0") ante error.
    """
    if texto is None:
        return Decimal("0")

    if isinstance(texto, (int, float, Decimal)):
        try:
            return Decimal(str(texto))
        except InvalidOperation:
            return Decimal("0")

    texto = str(texto).strip().replace(",", ".")
    if not texto:
        return Decimal("0")

    try:
        return Decimal(texto)
    except InvalidOperation:
        return Decimal("0")
