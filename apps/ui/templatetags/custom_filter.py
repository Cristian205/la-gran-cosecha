from django import template
from fractions import Fraction

register = template.Library()

@register.filter
def fraction(value):
    try:
        value = float(value)

        # Si es entero, mostrar normal
        if value.is_integer():
            return str(int(value))

        # Convertir a fracción simple
        frac = Fraction(value).limit_denominator()

        return f"{frac.numerator}/{frac.denominator}"

    except:
        return value