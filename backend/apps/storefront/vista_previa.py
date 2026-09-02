"""
Ver una plantilla en una empresa de verdad, sin tocarle nada.

Es la pregunta que no se puede contestar con el editor: alli una plantilla se ve
con datos inventados y en un marco de 900 pixeles. Lo que decide si un molde
sirve es verlo con el catalogo real de un negocio, sus fotos, sus categorias y
sus precios, en una pantalla entera.

    Se podria haber resuelto asignandola y mirando. No: eso ESCRIBE en el
    negocio —crea borradores en cada ruta y le cambia el color de marca— y
    deshacerlo despues no devuelve el estado anterior. Enseñar algo no puede
    costar modificarlo.

Asi que el enlace no escribe nada. Lleva un testigo firmado que dice «pinta ESTA
plantilla para ESTE negocio», y la vista publica compone al vuelo: la plantilla
pone la maqueta y el aspecto, el negocio pone los datos. Lo publicado sigue
intacto y lo sigue viendo cualquier visitante que entre por la puerta normal.

# Por que firmado y con caducidad

El enlace se pega en un chat o en un correo, asi que va a acabar en sitios que
nadie controla. Firmado, nadie puede fabricar uno para un negocio que no le
toca; caducado, el que se filtro deja de valer solo.

Lo que enseña, ademas, es lo que la tienda ya enseña en publico —su catalogo—
con otra maqueta encima. No abre nada que estuviera cerrado.
"""
from django.conf import settings
from django.core import signing

#: El espacio de nombres de la firma. Un testigo de aqui no vale en ningun otro
#: sitio del sistema aunque comparta la SECRET_KEY.
SAL = "crynex.storefront.vista-previa"

#: Cuanto vale un enlace. Dos dias cubre «te lo mando y lo miras manana» sin
#: convertirse en una puerta permanente que nadie recuerda haber abierto.
VIGENCIA = 60 * 60 * 48

#: El nombre del parametro en la URL y de la cabecera con que el servidor de la
#: tienda lo reenvia. Estan aqui los dos para que renombrarlo sea un sitio.
PARAMETRO = "vista"
CABECERA = "X-Crynex-Vista"


def firmar(*, tenant_id: int, plantilla_slug: str) -> str:
    """El testigo que va en el enlace."""
    return signing.dumps(
        {"t": int(tenant_id), "p": plantilla_slug}, salt=SAL, compress=True
    )


def abrir(testigo: str, *, tenant_id: int):
    """
    El slug de la plantilla que este testigo autoriza para ESTE negocio.

    Devuelve `None` ante cualquier problema —firma invalida, caducado, o de otro
    negocio— y nunca lanza. Un enlace viejo tiene que enseñar la tienda normal,
    no una pagina de error: quien lo abre casi siempre es alguien a quien se lo
    pasaron, y no sabe nada de testigos.

    La comprobacion del negocio es la que importa: sin ella, un testigo valido
    para una empresa serviria para forzar la maqueta en cualquier otra con solo
    cambiar el dominio.
    """
    if not testigo:
        return None
    try:
        datos = signing.loads(testigo, salt=SAL, max_age=VIGENCIA)
    except signing.BadSignature:
        return None
    if not isinstance(datos, dict) or datos.get("t") != int(tenant_id):
        return None
    return datos.get("p") or None


def enlace(*, dominio: str, testigo: str, ruta: str = "/") -> str:
    """
    La URL que se copia y se pega.

    El esquema sale de la configuracion y no se adivina: en desarrollo la tienda
    va por http y un enlace con https no abriria.
    """
    esquema = "http" if getattr(settings, "DEBUG", False) else "https"
    separador = "&" if "?" in ruta else "?"
    return f"{esquema}://{dominio}{ruta}{separador}{PARAMETRO}={testigo}"
