"""
Lo que este módulo le aporta a la caja.

Este archivo entero es la comprobación de la promesa que `pos/paneles.py` hizo
en la fase 10:

    Cuando llegue el módulo de reservas, aportar las mesas serán tres líneas
    aquí y un componente allá — ni una sola condición nueva dentro de la caja.

Son cuatro, y no hay ninguna condición nueva en `apps.pos`. El POS sigue sin
saber qué es una mesa: sabe que hay un panel registrado, que se pinta al lado
del carrito y que devuelve un diccionario que él guarda tal cual en
`Venta.contexto`.

La dirección de la dependencia es lo importante y va al revés de lo que uno
escribiría sin pensarlo: reservas importa el POS, el POS no importa reservas.
Por eso el módulo se puede desinstalar —o no contratarse— y la caja sigue
entera; al revés, quitar el POS solo apagaría este panel.

El registro ocurre en `ReservationsConfig.ready()`, así que basta con que la app
esté instalada. Que se VEA es otra cosa: `paneles.disponibles()` filtra por lo
que el negocio tiene contratado, y este declara `modulo="reservas"`.
"""
from apps.pos.paneles import Panel, registrar

#: El slug de este módulo en el catálogo comercial de `billing`. Es la misma
#: cadena que mira `views.ExigeModuloReservas`, y de ahí que esté nombrada una
#: sola vez: dos literales iguales en dos sitios son un módulo contratado y
#: apagado a la vez esperando a que alguien renombre uno.
MODULO = "reservas"

RESERVA = registrar(
    Panel(
        clave="reserva",
        nombre="Reserva",
        descripcion="Cobra sobre una reserva de hoy: la mesa, la hora y a quién se esperaba.",
        modulo=MODULO,
        # Lo que mete en `Venta.contexto`. Se declara para que el histórico se
        # pueda leer dentro de dos años sin adivinar de dónde salió cada campo,
        # y para que quien añada el tercer módulo vea el formato del segundo.
        aporta=("reserva_id", "recurso_id", "recurso_nombre"),
    )
)
