"""
Los paneles laterales que los módulos aportan a la caja.

Es la pieza que hace verdad la promesa del encargo: un POS genérico al que se
le añade un tipo de negocio sin volver a tocarlo.

    El POS NO sabe qué es una mesa.

Sabe que hay un panel registrado bajo la clave `mesas`, que se pinta al lado del
carrito y que al elegir algo devuelve un diccionario. Ese diccionario se guarda
tal cual en `Venta.contexto`. Cuando llegue el módulo de reservas, aportar las
mesas serán tres líneas aquí y un componente allá — ni una sola condición nueva
dentro de la caja.

Es el mismo contrato que ya usa el motor de tiendas entre `Bloque` (la fila que
declara) y `registro.tsx` (el componente que pinta): los datos NOMBRAN, el
código PINTA. Un panel declarado sin componente no aparece, y un componente sin
declarar no se puede elegir.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Panel:
    """
    Lo que un módulo declara para aparecer al lado del carrito.

    `clave` es la llave del registro de React, igual que `Bloque.codigo`.
    `modulo` es el slug de `billing.Producto` que hay que tener contratado; un
    panel sin módulo —como el de clientes— viene con el POS y siempre está.
    """

    clave: str
    nombre: str
    descripcion: str = ""
    modulo: str | None = None
    #: Qué claves mete en `Venta.contexto` al elegir algo. Se declara para que
    #: se pueda leer el histórico sin adivinar de dónde salió cada campo.
    aporta: tuple = field(default_factory=tuple)


_REGISTRO: dict[str, Panel] = {}


def registrar(panel: Panel) -> Panel:
    """
    Da de alta un panel. Lo llama cada módulo desde su `AppConfig.ready()`.

    Se sobrescribe sin quejarse si la clave ya existe: en desarrollo Django
    recarga los módulos y un `ready()` puede correr dos veces, y fallar por eso
    solo rompería el arranque sin proteger nada.
    """
    _REGISTRO[panel.clave] = panel
    return panel


def disponibles(modulos_activos) -> list:
    """
    Los paneles que este negocio puede usar, según lo que tenga contratado.

    Se filtra aquí y no en el frontend porque el módulo contratado es
    información del servidor: mandar la lista entera y confiar en que la
    pantalla oculte lo que no toca es cómo se filtra una funcionalidad que no
    se ha pagado.
    """
    activos = set(modulos_activos or [])
    return [p for p in _REGISTRO.values() if p.modulo is None or p.modulo in activos]


def obtener(clave):
    return _REGISTRO.get(clave)


# ==========================================================================
# EL PANEL QUE TRAE EL PROPIO POS
# ==========================================================================
#: Elegir a quién se le vende. No necesita módulo: los clientes son del núcleo,
#: y poner nombre a una venta es algo que hace cualquier mostrador.
#:
#: Existe además por una razón de diseño: un registro con cero entradas es una
#: promesa sin verificar. Con este dentro, el mecanismo está probado el día que
#: reservas llegue a añadir el suyo.
CLIENTE = registrar(
    Panel(
        clave="cliente",
        nombre="Cliente",
        descripcion="Asocia la venta a un cliente registrado.",
        modulo=None,
        aporta=("cliente_id",),
    )
)
