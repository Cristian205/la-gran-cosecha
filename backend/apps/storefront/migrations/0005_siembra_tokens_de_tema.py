"""
El catalogo de lo que se puede ajustar del aspecto de una tienda.

Cada token de aqui nombra una variable CSS que la hoja de estilos de la tienda
consume de verdad. Esa es la regla y conviene decirla: un token cuya variable
nadie lee se puede configurar y no cambia nada, que es exactamente la clase de
promesa incumplida que ya cazamos con las variantes de bloque.

Los valores por defecto son los que la tienda tenia escritos a mano. Al aplicar
esta migracion, ninguna tienda cambia de aspecto: lo que cambia es que ahora se
pueden mover.
"""
from django.db import migrations


def token(codigo, nombre, variable, defecto, **extra):
    return {
        "codigo": codigo,
        "nombre": nombre,
        "variable_css": variable,
        "valor_por_defecto": defecto,
        "descripcion": extra.get("descripcion", ""),
        "grupo": extra.get("grupo", "MARCA"),
        "tipo": extra.get("tipo", "COLOR"),
        "opciones": extra.get("opciones", []),
        "unidad": extra.get("unidad", ""),
        "orden": extra.get("orden", 0),
    }


def medida(codigo, nombre, variable, defecto, unidad, orden, grupo, ayuda=""):
    return token(
        codigo, nombre, variable, defecto,
        grupo=grupo, tipo="MEDIDA", unidad=unidad, orden=orden, descripcion=ayuda,
    )


TOKENS = [
    # --- Navegacion -----------------------------------------------------
    # La navbar tenia el degradado escrito a mano en `global.css`. Ahora son
    # dos colores y una opacidad, que es lo que se pide poder cambiar.
    token(
        "navbar-fondo", "Fondo de la barra", "--navbar-fondo", "#062e1a",
        grupo="NAVEGACION", orden=10,
        descripcion="Color base de la barra superior.",
    ),
    token(
        "navbar-fondo-2", "Fondo de la barra (degradado)", "--navbar-fondo-2", "#0a3d23",
        grupo="NAVEGACION", orden=20,
        descripcion="El segundo color del degradado. Igual al primero para un color plano.",
    ),
    token(
        "navbar-texto", "Texto de la barra", "--navbar-texto", "#ffffff",
        grupo="NAVEGACION", orden=30,
    ),
    medida(
        "navbar-opacidad", "Transparencia de la barra", "--navbar-opacidad", "0.62",
        "", 40, "NAVEGACION",
        "De 0 a 1. Por debajo de 1 se ve la pagina a traves.",
    ),
    medida(
        "navbar-desenfoque", "Desenfoque del fondo", "--navbar-desenfoque", "18",
        "px", 50, "NAVEGACION",
    ),
    medida(
        "navbar-alto", "Alto de la barra", "--navbar-alto", "62", "px", 60, "NAVEGACION",
        "Lo usa la barra de filtros para quedar pegada justo debajo.",
    ),

    # --- Tipografia ------------------------------------------------------
    token(
        "fuente-escala", "Tamano del texto", "--fuente-escala", "1",
        grupo="TIPOGRAFIA", tipo="OPCION", orden=10,
        descripcion="Multiplica todo el texto de la tienda a la vez.",
        opciones=[
            {"valor": "0.92", "nombre": "Compacto"},
            {"valor": "1", "nombre": "Normal"},
            {"valor": "1.08", "nombre": "Grande"},
            {"valor": "1.16", "nombre": "Muy grande"},
        ],
    ),
    medida(
        "fuente-base", "Tamano base", "--fuente-base", "16", "px", 20, "TIPOGRAFIA",
        "El tamano del texto normal. La escala se aplica encima.",
    ),
    token(
        "titulo-peso", "Grosor de los titulos", "--titulo-peso", "800",
        grupo="TIPOGRAFIA", tipo="OPCION", orden=30,
        opciones=[
            {"valor": "600", "nombre": "Ligero"},
            {"valor": "700", "nombre": "Medio"},
            {"valor": "800", "nombre": "Grueso"},
            {"valor": "900", "nombre": "Muy grueso"},
        ],
    ),
    medida(
        "titulo-escala", "Tamano de los titulos", "--titulo-escala", "1",
        "", 40, "TIPOGRAFIA",
        "Multiplica solo los titulos, encima de la escala general.",
    ),

    # --- Superficies -----------------------------------------------------
    token("color-fondo", "Fondo de la pagina", "--fondo", "#f6faf7",
          grupo="SUPERFICIE", orden=10),
    token("color-superficie", "Fondo de las tarjetas", "--superficie", "#ffffff",
          grupo="SUPERFICIE", orden=20),
    token("color-borde", "Color de los bordes", "--borde", "#e5e9ec",
          grupo="SUPERFICIE", orden=30),
    token("color-texto", "Color del texto", "--gris-900", "#0f172a",
          grupo="SUPERFICIE", orden=40),
    token("footer-fondo", "Fondo del pie", "--footer-fondo", "#0b1f17",
          grupo="SUPERFICIE", orden=50),
    token("footer-texto", "Texto del pie", "--footer-texto", "#ffffff",
          grupo="SUPERFICIE", orden=60),

    # --- Formas y espacios ------------------------------------------------
    medida("radio-tarjeta", "Redondeo de las tarjetas", "--radio", "20", "px", 10, "FORMA"),
    medida("radio-boton", "Redondeo de los botones", "--btn-radio", "999", "px", 20, "FORMA",
           "999 los deja completamente redondos."),
    medida("seccion-espacio", "Espacio entre secciones", "--seccion-espacio", "2.5",
           "rem", 30, "FORMA"),
    medida("contenedor-ancho", "Ancho del contenido", "--contenedor-ancho", "1200",
           "px", 40, "FORMA",
           "Cuanto ocupa la parte central en pantallas grandes."),
    token(
        "sombra-fuerza", "Intensidad de las sombras", "--sombra-fuerza", "1",
        grupo="FORMA", tipo="OPCION", orden=50,
        opciones=[
            {"valor": "0", "nombre": "Sin sombras"},
            {"valor": "0.5", "nombre": "Suaves"},
            {"valor": "1", "nombre": "Normales"},
            {"valor": "1.5", "nombre": "Marcadas"},
        ],
    ),
]


def sembrar(apps, schema_editor):
    TokenTema = apps.get_model("storefront", "TokenTema")
    for datos in TOKENS:
        TokenTema.objects.get_or_create(codigo=datos["codigo"], defaults=datos)


def revertir(apps, schema_editor):
    apps.get_model("storefront", "TokenTema").objects.filter(
        codigo__in=[t["codigo"] for t in TOKENS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("storefront", "0004_tokens_de_tema_esquema")]

    operations = [migrations.RunPython(sembrar, revertir)]
