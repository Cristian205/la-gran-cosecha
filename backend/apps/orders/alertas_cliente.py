"""
Las alertas que la plataforma puede enviarle a un cliente, y si las quiere.

Dos familias:

- **Utilidad**: los avisos de WhatsApp sobre SUS pedidos. Cada una es un
  evento real de `apps.mensajeria.eventos` y su código es el mismo: apagarla
  aquí hace que ese aviso no se le envíe (lo comprueba
  `mensajeria.servicio.puede_escribir_a`). Vienen encendidas.
- **Marketing**: ofertas y novedades por WhatsApp o por correo. Por ahora la
  plataforma no envía campañas: se guarda la preferencia para cuando las
  haya. Vienen APAGADAS: el marketing exige que el cliente lo haya pedido
  (Ley 1581 de 2012), así que nada se le promociona por defecto.

Por encima de todo sigue el consentimiento de WhatsApp (`acepta_whatsapp`):
sin él no sale ningún mensaje por ese canal, esté o no encendida la alerta.
"""

WHATSAPP = "WHATSAPP"
CORREO = "CORREO"
UTILIDAD = "UTILIDAD"
MARKETING = "MARKETING"

ALERTAS = [
    # ------------------------------------------------------------ utilidad
    {
        "codigo": "PEDIDO_RECIBIDO", "tipo": UTILIDAD, "canal": WHATSAPP, "por_defecto": True,
        "nombre": "Recibimos tu pedido",
        "descripcion": "Apenas llega el pedido, con su valor estimado.",
    },
    {
        "codigo": "PEDIDO_AJUSTADO", "tipo": UTILIDAD, "canal": WHATSAPP, "por_defecto": True,
        "nombre": "Pedido ajustado",
        "descripcion": "Si cambia por disponibilidad o precio del día, con el valor nuevo.",
    },
    {
        "codigo": "PEDIDO_CONFIRMADO", "tipo": UTILIDAD, "canal": WHATSAPP, "por_defecto": True,
        "nombre": "Pedido confirmado",
        "descripcion": "Cuando queda confirmado y entra a preparación.",
    },
    {
        "codigo": "PEDIDO_EN_CAMINO", "tipo": UTILIDAD, "canal": WHATSAPP, "por_defecto": True,
        "nombre": "Pedido en camino",
        "descripcion": "Cuando sale a ruta para entregarlo, con el nombre de quien lo lleva.",
    },
    {
        "codigo": "PEDIDO_ENTREGADO", "tipo": UTILIDAD, "canal": WHATSAPP, "por_defecto": True,
        "nombre": "Pedido entregado",
        "descripcion": "La confirmación de entrega y el canal para reportar novedades.",
    },
    # ----------------------------------------------------------- marketing
    {
        "codigo": "MKT_WA_OFERTAS", "tipo": MARKETING, "canal": WHATSAPP, "por_defecto": False,
        "nombre": "Ofertas y precios del día",
        "descripcion": "Promociones y productos en precio especial.",
    },
    {
        "codigo": "MKT_WA_TEMPORADA", "tipo": MARKETING, "canal": WHATSAPP, "por_defecto": False,
        "nombre": "Productos de temporada",
        "descripcion": "Lo que llega fresco cada semana y las cosechas del momento.",
    },
    {
        "codigo": "MKT_WA_RECORDATORIO", "tipo": MARKETING, "canal": WHATSAPP, "por_defecto": False,
        "nombre": "Recordatorio para volver a pedir",
        "descripcion": "Un aviso cuando se acerca su día habitual de compra.",
    },
    {
        "codigo": "MKT_CORREO_BOLETIN", "tipo": MARKETING, "canal": CORREO, "por_defecto": False,
        "nombre": "Boletín de ofertas",
        "descripcion": "Un resumen periódico de ofertas y novedades.",
    },
    {
        "codigo": "MKT_CORREO_LANZAMIENTOS", "tipo": MARKETING, "canal": CORREO, "por_defecto": False,
        "nombre": "Nuevos productos y categorías",
        "descripcion": "Cuando el catálogo suma productos o líneas nuevas.",
    },
]

POR_CODIGO = {a["codigo"]: a for a in ALERTAS}


def activa(preferencias: dict | None, codigo: str) -> bool:
    """¿Está encendida? Lo guardado manda; si no hay nada, el valor por defecto."""
    alerta = POR_CODIGO.get(codigo)
    if alerta is None:
        return True  # un evento que no es alerta de cliente no se filtra aquí
    valor = (preferencias or {}).get(codigo)
    return alerta["por_defecto"] if valor is None else bool(valor)


def efectivas(preferencias: dict | None) -> dict[str, bool]:
    """Todas las alertas resueltas: lo guardado o, si no, su valor por defecto."""
    return {a["codigo"]: activa(preferencias, a["codigo"]) for a in ALERTAS}
