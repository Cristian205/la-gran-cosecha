"""
Lo que este módulo le aporta a la caja.

Es la segunda vez que se escribe este archivo, y esa es toda su gracia. La
primera —`reservations/paneles.py`— demostró que el mecanismo de
`pos/paneles.py` funcionaba con un módulo; con uno funciona cualquier cosa. La
pregunta de esta fase era si aguanta DOS a la vez, y la respuesta se lee en el
diff: `apps.pos` sigue sin mencionar un domicilio, y aquí no hay nada que no
hubiera en el módulo anterior.

Lo que sí hizo falta cambiar está un piso más arriba, en
`business/perfil_pos.py`: `panel_lateral` era una CADENA, así que un
restaurante que atiende mesas y además reparte tenía que elegir cuál de sus dos
módulos ver. No era un fallo del registro sino del sitio donde el negocio dice
cuáles quiere, y con un solo panel no había forma de notarlo. Ahora es una
lista.

# La diferencia con reservas, y por qué importa

El panel de reservas ELIGE algo que ya existe: la reserva se creó ayer por
teléfono y el cajero la busca. Este panel CREA: el domicilio nace en el momento
en que se timbra la venta, con su dirección y su zona. Los dos usan el mismo
contrato sin ampliarlo —`aporte` viaja a `Venta.contexto`, y `alAbrirVenta`
hace la llamada propia del módulo—, y que dos formas de trabajar tan distintas
quepan sin tocar el mecanismo es la evidencia que se buscaba.

Lo que el panel aporta al contexto de la venta es la dirección y la zona, no el
`envio_id`: cuando la venta se abre el envío todavía no existe. El vínculo lo
guarda `Envio.venta`, que es la dirección correcta —de aquí hacia el POS, nunca
al revés— y por la que el histórico se puede recorrer sin que la caja sepa nada.
"""
from apps.pos.paneles import Panel, registrar

#: El slug de este módulo en el catálogo comercial de `billing`. Es la misma
#: cadena que mira `views.ExigeModuloDomicilios`, y de ahí que esté nombrada una
#: sola vez: dos literales iguales en dos sitios son un módulo contratado y
#: apagado a la vez esperando a que alguien renombre uno.
MODULO = "domicilios"

DOMICILIO = registrar(
    Panel(
        clave="domicilio",
        nombre="Domicilio",
        descripcion="Manda esta venta a una dirección: la zona, el contacto y la tarifa.",
        modulo=MODULO,
        # Lo que mete en `Venta.contexto`. Se declara ENTERO —incluido el
        # teléfono— y no solo la parte bonita: el contrato dice que `aporte`
        # viaja tal cual al contexto, y una declaración incompleta convertiría
        # este campo en documentación que miente. Que ahí acabe un dato
        # personal es real y hay que verlo, no esconderlo: es el mismo que ya
        # queda congelado en el `Envio`, y las dos tablas están bajo RLS.
        #
        # `envio_id` NO está aquí, y eso sí es a propósito: cuando la venta se
        # abre el envío todavía no existe. El vínculo lo guarda `Envio.venta`.
        aporta=(
            "zona_id",
            "zona_nombre",
            "direccion",
            "referencia",
            "nombre_contacto",
            "telefono_contacto",
            "tarifa",
        ),
    )
)
