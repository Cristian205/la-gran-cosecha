"""
El tenant activo de la petición en curso.

Se guarda en un `ContextVar` y no en una variable de módulo o en el hilo por dos
razones: es seguro con vistas asíncronas (cada tarea hereda una copia propia del
contexto) y no se filtra entre peticiones concurrentes bajo gunicorn con hilos.

La distinción importante está entre dos estados que NO son lo mismo:

* `SIN_DEFINIR` — nadie declaró un ámbito. Es el estado por defecto, y los
  managers con ámbito de tenant lo tratan como un error. Fallar cerrado aquí es
  lo que evita que un `Producto.objects.all()` olvidado devuelva el catálogo de
  todos los negocios.
* `None` declarado a propósito mediante `ambito_de_plataforma()` — sí hay una
  decisión, y es "esta operación abarca toda la plataforma". Es lo que usan el
  admin de plataforma, las migraciones y los comandos de gestión.
"""
import contextvars
from contextlib import contextmanager

# Centinela: "nadie ha declarado ámbito todavía". No es None a propósito.
SIN_DEFINIR = object()

_tenant_actual = contextvars.ContextVar("tenant_actual", default=SIN_DEFINIR)


class SinTenantEnContexto(RuntimeError):
    """
    Se consultó un modelo con ámbito de tenant sin haber declarado cuál.

    No es un fallo raro que haya que silenciar: significa que hay código
    accediendo a datos de negocio fuera de una petición resuelta, y que sin
    esta excepción devolvería filas de todos los negocios a la vez.
    """


def obtener_tenant_actual():
    """
    Devuelve el tenant activo, o None si el ámbito es toda la plataforma.

    Lanza `SinTenantEnContexto` si nadie declaró ámbito — ver el módulo.
    """
    valor = _tenant_actual.get()
    if valor is SIN_DEFINIR:
        raise SinTenantEnContexto(
            "No hay tenant en el contexto. Envuelve la operación en "
            "`with usar_tenant(tenant):` o, si de verdad abarca toda la "
            "plataforma, en `with ambito_de_plataforma():`."
        )
    return valor


def hay_ambito_declarado() -> bool:
    """Para el código que quiere preguntar sin arriesgarse a la excepción."""
    return _tenant_actual.get() is not SIN_DEFINIR


def establecer_tenant(tenant):
    """
    Fija el tenant y devuelve el token para restaurarlo.

    Pensado para el middleware, que necesita separar la fijación del reinicio.
    En cualquier otro sitio es preferible `usar_tenant()`, que no puede
    olvidarse de restaurar.
    """
    return _tenant_actual.set(tenant)


def restablecer(token) -> None:
    _tenant_actual.reset(token)


@contextmanager
def usar_tenant(tenant):
    """
    Acota un bloque al tenant indicado.

        with usar_tenant(perfumeria):
            Producto.objects.count()   # solo los suyos
    """
    token = _tenant_actual.set(tenant)
    try:
        yield tenant
    finally:
        _tenant_actual.reset(token)


@contextmanager
def ambito_de_plataforma():
    """
    Declara explícitamente que la operación abarca todos los tenants.

    Es la única forma legítima de leer sin filtro, y se escribe siempre a
    la vista: si aparece dentro de una vista de la API es una señal de alarma
    en revisión de código, no un detalle.
    """
    token = _tenant_actual.set(None)
    try:
        yield None
    finally:
        _tenant_actual.reset(token)


def tenant_por_defecto():
    """
    Puente de la fase 2, no un diseño permanente.

    Mientras solo haya un negocio dado de alta, cualquier camino de código que
    cree una fila sin haber declarado ámbito —el alta de pedido del storefront,
    un comando, el shell— la asigna a ese único negocio, y la aplicación actual
    no se entera de que ahora hay una columna más.

    En cuanto existe un segundo negocio deja de adivinar y devuelve None, de
    modo que la ambigüedad se convierte en un error visible en vez de en una
    fila asignada al negocio equivocado. La fase 3 lo retira del todo.
    """
    from .models import Tenant  # noqa: PLC0415 — evita el import circular

    candidatos = list(Tenant.objects.all()[:2])
    return candidatos[0] if len(candidatos) == 1 else None
