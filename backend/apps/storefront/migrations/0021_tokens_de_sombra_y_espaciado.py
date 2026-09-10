"""
Dos grupos nuevos de tokens, un token nuevo y tres que se mudan de sitio.

# El token nuevo: el tinte de la sombra

`--sombra-tinte` es el color de la penumbra. Hasta la fase 12 no existia:
las sombras estaban escritas quince veces en `global.css` como
`rgba(6, 46, 26, ...)`, un verde muy oscuro que era el de la primera tienda del
sistema. Toda tienda del motor proyectaba sombras verdes sin que nadie lo
hubiera decidido, y ninguna podia dejar de hacerlo.

Es el mismo defecto que tenia el nombre de la escala de marca —un valor de un
cliente colado en el vocabulario comun— solo que en el valor y no en el nombre,
que es donde peor se ve porque no hay ninguna palabra que delate el problema.

Su valor por defecto es exactamente el de antes, asi que esta migracion NO
cambia como se ve ninguna tienda. Solo la deja poder cambiarlo.

Va como tripleta —«6, 46, 26»— y no como color porque cada uso le pone su
propia opacidad. Es el mismo truco que `--superficie-rgb`.

# Los grupos nuevos

`SOMBRA` y `ESPACIADO`. Los tres tokens que se mudan ya existian y no cambian
de variable ni de valor: solo estaban en `FORMA`, que se habia convertido en el
cajon de todo lo que no era color ni tipografia.

El reagrupado importa mas de lo que parece ahora que hay estilo POR BLOQUE: el
panel de diseno de un bloque lista sus tokens agrupados, y «espaciado» y
«sombras» son justo las dos cosas que se retocan seccion a seccion. Tenerlas
mezcladas con los radios obligaba a buscarlas.

Mudar un token es seguro porque `StoreSettings.tokens` guarda CODIGOS, no
grupos: ningun negocio pierde lo que tenia configurado.
"""
from django.db import migrations

#: (codigo, grupo nuevo). Los tres ya existen; solo cambian de cajon.
MUDANZAS = [
    ("sombra-fuerza", "SOMBRA"),
    ("seccion-espacio", "ESPACIADO"),
    ("contenedor-ancho", "ESPACIADO"),
]

GRUPOS_VIEJOS = {
    "sombra-fuerza": "FORMA",
    "seccion-espacio": "FORMA",
    "contenedor-ancho": "FORMA",
}

NUEVOS = [
    {
        "codigo": "sombra-tinte",
        "nombre": "Color de la sombra",
        "descripcion": (
            "De que color es la penumbra, en rojo/verde/azul. Un gris neutro "
            "—«0, 0, 0»— para una tienda sobria; el tono de la marca para una "
            "sombra que tiña."
        ),
        "grupo": "SOMBRA",
        "tipo": "TEXTO",
        "variable_css": "--sombra-tinte",
        "valor_por_defecto": "6, 46, 26",
        "unidad": "",
        "orden": 10,
    },
    {
        "codigo": "bloque-fondo",
        "nombre": "Fondo de la seccion",
        "descripcion": (
            "El color detras de esta seccion. Solo tiene sentido bloque a "
            "bloque: en el tema del negocio ya existe «color de fondo»."
        ),
        "grupo": "SUPERFICIE",
        "tipo": "COLOR",
        "variable_css": "--bloque-fondo",
        "valor_por_defecto": "",
        "unidad": "",
        "orden": 70,
    },
]


def aplicar(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")

    for codigo, grupo in MUDANZAS:
        TokenTema.objects.filter(codigo=codigo).update(grupo=grupo)

    for datos in NUEVOS:
        TokenTema.objects.update_or_create(
            codigo=datos["codigo"],
            defaults={k: v for k, v in datos.items() if k != "codigo"},
        )


def revertir(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")

    for codigo, grupo in GRUPOS_VIEJOS.items():
        TokenTema.objects.filter(codigo=codigo).update(grupo=grupo)

    # `bloque-fondo` se borra: sin el, el estilo por bloque que lo usara se
    # descartaria solo al validar, que es el comportamiento correcto para un
    # token retirado. `sombra-tinte` tambien, y la hoja cae a su valor escrito.
    TokenTema.objects.filter(codigo__in=[d["codigo"] for d in NUEVOS]).delete()


class Migration(migrations.Migration):

    dependencies = [("storefront", "0020_estilo_por_bloque")]

    operations = [migrations.RunPython(aplicar, revertir)]
