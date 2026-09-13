"""
El bloque «anuncios-carrusel».

Reemplaza, en el Home de La Gran Cosecha, al hueco que ocupaba
`productos-destacados` bajo "Lo más pedido": ese encargo pedía que esa
sección dejara de sentirse como una fila más de catálogo y pasara a ser un
espacio de marketing — una pieza publicitaria grande, con su propio carrusel
de campañas, y no una cuarta rejilla de tarjetas de producto.

Es un bloque nuevo y no una variante de `carrusel-promociones` porque el dato
de detrás también es nuevo: `content.Anuncio`, una tabla separada de
`content.PromoBanner` a propósito (ver el docstring del modelo). Sin props de
contenido —igual que `testimonios` o `insignias-confianza`, lee su propia
lista del backend en el navegador— y con dos perillas de comportamiento nada
más: si rota sola y cada cuánto.
"""
from django.db import migrations


def numero(titulo, defecto=None, minimo=1, maximo=None, ayuda=""):
    campo = {"tipo": "number", "titulo": titulo, "minimo": minimo}
    if defecto is not None:
        campo["default"] = defecto
    if maximo is not None:
        campo["maximo"] = maximo
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def bandera(titulo, defecto=False, ayuda=""):
    campo = {"tipo": "boolean", "titulo": titulo, "default": defecto}
    if ayuda:
        campo["ayuda"] = ayuda
    return campo


def objeto(**propiedades):
    return {"tipo": "object", "properties": propiedades}


ANUNCIOS_CARRUSEL = {
    "nombre": "Carrusel de anuncios",
    "descripcion": "Campañas rotativas a pantalla completa: el espacio de marketing del cuerpo del Home.",
    "categoria": "CONVERSION",
    "icono": "megaphone",
    "esquema_props": objeto(
        autoplay=bandera("Rotar solo", True),
        segundos=numero(
            "Segundos por anuncio", 7, minimo=2, maximo=30,
            ayuda="Se pausa en cuanto alguien interactúa con las flechas o los puntos.",
        ),
    ),
    "variantes": [],
    "tokens_admitidos": ["bloque-fondo", "seccion-espacio"],
    "a_sangre": False,
    "requiere_datos": False,
    "orden": 37,
}


def aplicar(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.update_or_create(codigo="anuncios-carrusel", defaults=ANUNCIOS_CARRUSEL)


def revertir(apps, schema_editor):
    Bloque = apps.get_model("storefront", "Bloque")
    Bloque.objects.filter(codigo="anuncios-carrusel").update(activo=False)


class Migration(migrations.Migration):

    dependencies = [("storefront", "0028_home_landing_comercial")]

    operations = [migrations.RunPython(aplicar, revertir)]
