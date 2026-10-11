"""
El catálogo de situaciones que el sistema sabe avisar por WhatsApp.

Cada evento dice A QUIÉN va (el cliente del pedido o el equipo del negocio),
qué VARIABLES lleva y en qué orden, y el texto sugerido para registrar la
plantilla en Meta y en Twilio. El orden de `variables` es el contrato con las
plantillas: `{{1}}` es la primera, `{{2}}` la segunda… y es el mismo en los
dos proveedores, que es lo que permite pasar de uno a otro sin reescribir.

Por qué plantillas y no texto libre: WhatsApp solo deja escribir libremente
dentro de las 24 horas siguientes a un mensaje DEL cliente. Una confirmación
de pedido o una alerta las inicia el negocio, y eso exige una plantilla
aprobada previamente por Meta (Twilio lo llama «Content Template»).

`disparador` dice al programador qué lo dispara; `cuando`, lo mismo en
palabras del negocio: es lo que el panel muestra como evento de la regla.

Se añade un evento cuando algo lo dispara. Declarar uno que nadie envía es
prometer un aviso que no llega.
"""

CLIENTE = "cliente"
NEGOCIO = "negocio"

EVENTOS = {
    # ------------------------------------------------------------ cliente
    "PEDIDO_RECIBIDO": {
        "nombre": "Pedido recibido",
        "destinatario": CLIENTE,
        "disparador": "orders.Pedido creado desde la tienda o el panel",
        "cuando": "Se recibe un pedido",
        "variables": ["cliente", "pedido", "total", "negocio"],
        "texto": (
            "Hola {{1}}, recibimos tu pedido #{{2}} por un valor estimado de {{3}}. "
            "En {{4}} lo revisamos y te confirmamos el valor final antes de despacharlo."
        ),
    },
    "PEDIDO_AJUSTADO": {
        "nombre": "Pedido ajustado",
        "destinatario": CLIENTE,
        "disparador": "orders.Pedido pasa a EDITADO",
        "cuando": "Se ajusta un pedido",
        "variables": ["cliente", "pedido", "total"],
        "texto": (
            "Hola {{1}}, ajustamos tu pedido #{{2}} según la disponibilidad y el precio del día. "
            "El nuevo valor es {{3}}. Si tienes alguna duda, responde a este mensaje."
        ),
    },
    "PEDIDO_CONFIRMADO": {
        "nombre": "Pedido confirmado",
        "destinatario": CLIENTE,
        "disparador": "orders.Pedido pasa a CERRADO",
        "cuando": "Se confirma un pedido",
        "variables": ["cliente", "pedido", "total"],
        "texto": (
            "Hola {{1}}, tu pedido #{{2}} quedó confirmado por {{3}} y lo estamos preparando para la entrega."
        ),
    },
    "PEDIDO_EN_CAMINO": {
        "nombre": "Pedido en camino",
        "destinatario": CLIENTE,
        "disparador": "delivery.Envio pasa a EN_RUTA",
        "cuando": "Un envío sale a ruta",
        "variables": ["cliente", "pedido", "repartidor"],
        "texto": "Hola {{1}}, tu pedido #{{2}} va en camino con {{3}}. Ten a mano tu teléfono para recibirlo.",
    },
    "PEDIDO_ENTREGADO": {
        "nombre": "Pedido entregado",
        "destinatario": CLIENTE,
        "disparador": "orders.Pedido pasa a ENTREGADO",
        "cuando": "Se entrega un pedido",
        "variables": ["cliente", "pedido", "negocio"],
        "texto": (
            "Hola {{1}}, entregamos tu pedido #{{2}}. Gracias por comprar en {{3}}. "
            "Si algo no llegó bien, responde a este mensaje y lo solucionamos."
        ),
    },
    # ------------------------------------------------------------ negocio
    "ALERTA_PEDIDO_NUEVO": {
        "nombre": "Alerta: pedido nuevo",
        "destinatario": NEGOCIO,
        "disparador": "orders.Pedido creado",
        "cuando": "Se recibe un pedido",
        "variables": ["pedido", "cliente", "total"],
        "texto": "Nuevo pedido #{{1}} de {{2}} por {{3}}. Revísalo en el panel.",
    },
    "ALERTA_MENSAJE_CONTACTO": {
        "nombre": "Alerta: mensaje de contacto",
        "destinatario": NEGOCIO,
        "disparador": "contact.MensajeContacto creado",
        "cuando": "Llega un mensaje de contacto",
        "variables": ["cliente", "motivo", "telefono"],
        "texto": "Nuevo mensaje de {{1}} ({{2}}). Teléfono: {{3}}. Revísalo en el panel.",
    },
    "ALERTA_ENVIO_DEVUELTO": {
        "nombre": "Alerta: envío devuelto",
        "destinatario": NEGOCIO,
        "disparador": "delivery.Envio pasa a DEVUELTO",
        "cuando": "Un envío se devuelve",
        "variables": ["pedido", "cliente", "nota"],
        "texto": "El envío del pedido #{{1}} de {{2}} volvió sin entregarse. Nota: {{3}}.",
    },
    "ALERTA_GENERAL": {
        "nombre": "Alerta general",
        "destinatario": NEGOCIO,
        "disparador": "mensajeria.servicio.alertar_negocio() desde cualquier parte del sistema",
        "cuando": "El sistema emite una alerta",
        "variables": ["titulo", "detalle"],
        "texto": "{{1}}: {{2}}",
    },
}

CODIGOS = frozenset(EVENTOS)


def variables_de(evento: str) -> list[str]:
    return EVENTOS[evento]["variables"]


def renderizar(texto: str, valores: list[str]) -> str:
    """El texto de la plantilla con sus `{{n}}` resueltos: para el registro y el modo simulado."""
    salida = texto
    for i, valor in enumerate(valores, start=1):
        salida = salida.replace("{{%d}}" % i, str(valor))
    return salida
