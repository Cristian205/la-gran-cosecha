"""
El estilo de la tarjeta de producto, como token del tema.

Es el ejemplo literal del encargo —`ProductCard → fashion / restaurant /
hardware / minimal`— y lo interesante no es que existan cinco aspectos, sino de
donde sale cual se usa. Hubo tres candidatos:

1. Una propiedad del BLOQUE. Se descarta: la tarjeta aparece en la home, en las
   ofertas, en los mas vendidos y en el catalogo, y el catalogo no es un bloque.
   El mismo producto se veria de tres formas distintas en la misma tienda.

2. Una variante de cada bloque que la usa. Peor: habria que elegir el mismo
   aspecto en cuatro sitios y mantenerlos sincronizados a mano.

3. Un TOKEN DEL TEMA. Es lo que es: una decision de identidad visual del
   negocio, igual que su color o su tipografia, y tiene que valer en toda la
   tienda a la vez. Se elige una vez, en Apariencia, y manda en todas partes.

# Como se aplica algo que no es un valor

Los demas tokens son valores —un color, una medida— y viajan como variables CSS.
Este no: nombra un ASPECTO, y una variable CSS no puede cambiar donde va el
precio ni si hay foto. Asi que el valor resuelto viaja tambien como atributo en
el `<body>` (`data-tarjeta`), y la hoja de estilos define los cinco aspectos.

Es el mismo contrato que `Bloque.variantes`, un nivel mas abajo: los datos
NOMBRAN el aspecto, el codigo lo dibuja. Un valor que la hoja no conozca cae al
estandar en vez de dejar la tarjeta sin maquetar.
"""
from django.db import migrations

TOKEN = {
    "codigo": "estilo-tarjeta",
    "nombre": "Estilo de las tarjetas",
    "descripcion": "Como se ven los productos en toda la tienda.",
    "grupo": "FORMA",
    "tipo": "OPCION",
    "variable_css": "--estilo-tarjeta",
    "valor_por_defecto": "estandar",
    "unidad": "",
    "orden": 5,
    "opciones": [
        {"valor": "estandar", "nombre": "Estandar"},
        {"valor": "editorial", "nombre": "Editorial — moda y boutique"},
        {"valor": "gastronomico", "nombre": "Gastronomico — comida"},
        {"valor": "tecnico", "nombre": "Tecnico — ferreteria y repuestos"},
        {"valor": "minimo", "nombre": "Minimo — sin foto"},
    ],
}


def sembrar(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")
    TokenTema.objects.get_or_create(
        codigo=TOKEN["codigo"],
        defaults={k: v for k, v in TOKEN.items() if k != "codigo"},
    )


def retirar(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")
    # Se desactiva en vez de borrarse: puede haber negocios con un valor
    # elegido, y `tema.resolver()` ignora los tokens que no estan en el
    # catalogo — asi que apagarlo ya devuelve todas las tiendas al estandar.
    TokenTema.objects.filter(codigo=TOKEN["codigo"]).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0010_row_level_security")]

    operations = [migrations.RunPython(sembrar, retirar)]
