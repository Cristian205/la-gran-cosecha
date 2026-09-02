"""
Los titulares pueden tener su propia tipografia.

Es el token que hace que la plantilla «Belleza» no se parezca a La Gran Cosecha
por dentro y no solo por fuera. Hasta ahora la tienda elegia UNA familia para
todo, asi que dos negocios con maquetas opuestas seguian sonando igual: el
titular de una boutique y el de una distribuidora de abastos salian con la
misma Poppins en negrita.

Un titular en serif sobre un cuerpo en sans es la decision de diseno mas barata
que existe y la que mas cambia el caracter de una tienda. Escribirla como token
—en vez de como una hoja de estilos por plantilla— es lo que la deja al alcance
de cualquier negocio desde su pestana de Apariencia.

# Por que el valor es una CLAVE y no la pila de familias

Guardar `"Playfair Display", Georgia, serif` en el token seria pedirle al
negocio que escriba CSS en un campo de texto, y ademas nadie podria CARGAR esa
fuente: la etiqueta de Google necesita el nombre de la familia, no la pila. Asi
que el token guarda `playfair` y `lib/tema.ts` traduce, exactamente igual que
hace con `estilo-tarjeta`.

`heredada` es el valor por defecto y no carga nada. Ninguna tienda de las que ya
existen cambia de tipografia al aplicar esta migracion; lo que cambia es que
ahora pueden.
"""
from django.db import migrations

TOKEN = {
    "codigo": "fuente-titulos",
    "nombre": "Tipografia de los titulos",
    "descripcion": "Distinta de la del texto. «Heredada» usa la misma para todo.",
    "grupo": "TIPOGRAFIA",
    "tipo": "OPCION",
    "variable_css": "--fuente-titulos",
    "valor_por_defecto": "heredada",
    "unidad": "",
    "orden": 5,
    "opciones": [
        {"valor": "heredada", "nombre": "La misma del texto"},
        {"valor": "playfair", "nombre": "Playfair Display — serif elegante"},
        {"valor": "cormorant", "nombre": "Cormorant Garamond — serif fina"},
        {"valor": "dm-serif", "nombre": "DM Serif Display — serif con peso"},
        {"valor": "fraunces", "nombre": "Fraunces — serif con caracter"},
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
    # Se desactiva en vez de borrarse: `tema.resolver()` ignora lo que no esta
    # en el catalogo, asi que apagarlo ya devuelve todas las tiendas a una sola
    # tipografia sin tocar lo que cada negocio guardo.
    TokenTema.objects.filter(codigo=TOKEN["codigo"]).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0017_tokens_de_caja")]

    operations = [migrations.RunPython(sembrar, retirar)]
