"""
Cómo se le pregunta al perfil desde el resto de la plataforma.

Tres funciones y una regla: quien quiera saber si un negocio hace algo pregunta
POR LA CAPACIDAD, nunca por el sector. `perfil.sector` es una etiqueta para
mostrar; en cuanto alguien escriba `if perfil.sector == "ferreteria"`, añadir un
tipo de negocio dejará de ser un alta y volverá a ser una rama de código.

Todas fallan hacia el comportamiento de siempre. Un negocio sin perfil —los
dados de alta antes de que esta app existiera, o uno recién creado dentro de una
migración— se comporta como se comportaba la plataforma antes de que el perfil
existiera. Encender una funcionalidad no puede cambiarle el sistema a nadie sin
que lo pida.
"""
from .capacidades import normalizar, normalizar_politica
from .perfil_pos import normalizar as normalizar_pos


def perfil_de(tenant):
    """El perfil del negocio, o None si todavía no tiene."""
    if tenant is None:
        return None
    from .models import PerfilNegocio  # noqa: PLC0415

    return PerfilNegocio.objects.filter(tenant=tenant).first()


def puede(tenant, capacidad: str) -> bool:
    """
    ¿Este negocio hace esto?

    Sin perfil se responde con el valor por defecto de la capacidad, que es el
    comportamiento histórico. Nunca se lanza: esto se consulta en mitad de una
    petición pública y un `KeyError` ahí sería una tienda caída por un dato de
    configuración que falta.
    """
    perfil = perfil_de(tenant)
    valores = normalizar(perfil.capacidades if perfil else None)
    return bool(valores.get(capacidad, False))


def politica_stock(tenant) -> dict:
    """Los ajustes de existencias del negocio, completos y con sus defectos."""
    perfil = perfil_de(tenant)
    return normalizar_politica(perfil.politica_stock if perfil else None)


def perfil_pos(tenant) -> dict:
    """
    Cómo se comporta la caja de este negocio, completa y con sus defectos.

    Igual que `politica_stock`: nunca lanza y siempre devuelve todas las
    claves, para que la pantalla del POS pueda leerlas sin defenderse de cada
    una por separado.
    """
    perfil = perfil_de(tenant)
    return normalizar_pos(perfil.perfil_pos if perfil else None)
