"""
El puente entre el contexto de Python y la Row-Level Security de PostgreSQL.

El manager filtra en Python; la política de RLS filtra en la base. Para que la
segunda sepa de qué negocio se trata hay que decírselo por conexión, y eso es
lo único que hace este módulo.

`SET LOCAL` y no `SET`: el ajuste dura hasta el final de la transacción y no se
queda pegado a la conexión. Con `CONN_MAX_AGE` alto las conexiones se reutilizan
entre peticiones, y un `SET` normal filtraría el negocio de una petición a la
siguiente — exactamente la fuga que la RLS viene a impedir.
"""
from django.db import connection, transaction

AJUSTE = "app.current_tenant"


def declarar_tenant_en_la_base(tenant) -> None:
    """
    Declara el negocio activo para la transacción en curso.

    Sin transacción abierta `SET LOCAL` no tendría efecto, así que se abre una:
    `ATOMIC_REQUESTS` no está activo en este proyecto y no conviene activarlo
    solo por esto.
    """
    if connection.vendor != "postgresql":
        return

    valor = "" if tenant is None else str(tenant.pk)
    with transaction.atomic():
        with connection.cursor() as cursor:
            # El parámetro va como literal porque SET LOCAL no admite
            # marcadores; `valor` es siempre una cadena vacía o un entero
            # convertido por nosotros, nunca texto de quien llama.
            cursor.execute(f"SET LOCAL {AJUSTE} = '{valor}'")


def tenant_declarado_en_la_base():
    """El negocio que la conexión tiene declarado. Para diagnóstico y tests."""
    if connection.vendor != "postgresql":
        return None
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT current_setting('{AJUSTE}', true)")
        valor = cursor.fetchone()[0]
    return int(valor) if valor else None
