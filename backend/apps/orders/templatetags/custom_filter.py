from fractions import Fraction

from django import template

register = template.Library()


@register.filter
def fraction(value):
    """Muestra un decimal como fracción simple (ej: 0.5 -> 1/2). Portado del proyecto original."""
    try:
        value = float(value)

        if value.is_integer():
            return str(int(value))

        frac = Fraction(value).limit_denominator()
        return f"{frac.numerator}/{frac.denominator}"

    except (TypeError, ValueError):
        return value
