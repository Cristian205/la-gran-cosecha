"""
Teléfonos a formato E.164 (+573001234567), que es lo único que aceptan Meta y
Twilio.

La tienda guarda lo que el cliente escribió: "+57 300 123 4567", "3001234567",
"(300) 123-4567", "573001234567". Todos son el mismo número. Lo que no se
puede interpretar sin adivinar se devuelve vacío y el mensaje no se encola:
mandar una confirmación de pedido a un número equivocado es peor que no
mandarla.
"""
import re

from django.conf import settings

#: Indicativo por defecto para números locales. La Gran Cosecha opera en
#: Colombia; un negocio de otro país lo cambia con WHATSAPP_INDICATIVO_PAIS.
def _indicativo() -> str:
    return str(getattr(settings, "WHATSAPP_INDICATIVO_PAIS", "57")).lstrip("+")


def normalizar_e164(bruto: str | None) -> str:
    if not bruto:
        return ""
    texto = str(bruto).strip()
    if texto.lower().startswith("whatsapp:"):
        texto = texto[len("whatsapp:"):]
    tenia_mas = texto.startswith("+") or texto.startswith("00")
    digitos = re.sub(r"\D", "", texto)
    if texto.startswith("00"):
        digitos = digitos[2:]

    indicativo = _indicativo()
    if tenia_mas:
        candidato = digitos
    elif indicativo == "57" and len(digitos) == 10 and digitos.startswith("3"):
        # Celular colombiano escrito sin indicativo.
        candidato = indicativo + digitos
    elif digitos.startswith(indicativo) and len(digitos) > len(indicativo) + 6:
        candidato = digitos
    elif indicativo != "57" and 7 <= len(digitos) <= 11:
        candidato = indicativo + digitos
    else:
        return ""

    # E.164: hasta 15 dígitos; menos de 8 no es un número de nadie.
    if not 8 <= len(candidato) <= 15:
        return ""
    return "+" + candidato
