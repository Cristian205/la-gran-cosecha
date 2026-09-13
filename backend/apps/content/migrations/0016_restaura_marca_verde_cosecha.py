"""
Restaura el color corporativo de La Gran Cosecha, que estaba en rosa.

Al revisar por qué las secciones nuevas del Home no se veían del verde
esperado, apareció que `StoreSettings.color_primario` de este tenant estaba
en `#c2687e` (rosa) y no vacío. No es un valor que ninguna migración de este
rediseño haya escrito — ya estaba así en la base — y por el color y por los
tokens de navbar/pie que lo acompañaban (fondo blanco, texto marrón, pie
marrón en vez del verde oscuro de siempre), todo apunta a una prueba de la
paleta que quedó puesta encima, probablemente del propio trabajo en el motor
de temas del panel.

# Por qué "vaciar" y no "escribir el verde a mano"

`frontend/tienda/src/lib/tema.ts` ya resuelve esto: si `color_primario` no es
un hex válido, `escala()` no genera ninguna variable y el `:root` de
`global.css` — la paleta verde/ámbar, documentada ahí mismo como "los valores
por defecto... son los de aquella tienda", la primera del motor — se aplica
tal cual. Vaciar el campo es pedirle al sistema el estado de "sin personalizar
todavía", que es exactamente lo que corresponde: nadie decidió el rosa a
propósito, así que no hay un verde "correcto" que adivinar y escribir en su
lugar.

Los tokens de `color-borde`, `footer-fondo`, `footer-texto`, `navbar-fondo`,
`navbar-texto` y `navbar-fondo-2` se retiran del diccionario por la misma
razón y con el mismo efecto: sin la clave, `tema.resolver()` cae al
`valor_por_defecto` del catálogo (el navbar y el pie verde oscuro con texto
blanco). Los demás tokens (densidad, radio de tarjeta, fuerza de sombra,
opacidad y desenfoque del navbar) no se tocan: son decisiones de maqueta, no
de color, y no hay indicio de que también sean parte de la prueba.

Solo toca al tenant "la-gran-cosecha". Es reversible de verdad —guarda los
valores previos en el propio código de la migración— por si el rosa resulta
ser una decisión real y no una prueba olvidada.
"""
from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"

#: Los valores encontrados antes de esta migración, para poder revertir de
#: verdad y no con un no-op: si el rosa era intencional, `migrate ... 0015`
#: los devuelve tal cual estaban.
CAMPOS_DE_MARCA_PREVIOS = {
    "color_primario": "#c2687e",
    "color_primario_texto": "#ffffff",
    "color_secundario": "#e9b8c6",
    "color_secundario_texto": "#3d2b31",
    "color_fondo": "#fdf5f7",
    "color_superficie": "#ffffff",
    "color_texto": "#3d2b31",
}

TOKENS_PREVIOS = {
    "color-borde": "#f2dfe5",
    "footer-fondo": "#4a2f38",
    "footer-texto": "#ffffff",
    "navbar-fondo": "#ffffff",
    "navbar-texto": "#3d2b31",
    "navbar-fondo-2": "#ffffff",
}


def aplicar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    StoreSettings = apps.get_model("content", "StoreSettings")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    config = StoreSettings.objects.filter(tenant=tenant).first()
    if config is None:
        return

    for campo in CAMPOS_DE_MARCA_PREVIOS:
        setattr(config, campo, "")

    tokens = dict(config.tokens or {})
    for clave in TOKENS_PREVIOS:
        tokens.pop(clave, None)
    config.tokens = tokens

    config.save(update_fields=[*CAMPOS_DE_MARCA_PREVIOS.keys(), "tokens"])


def revertir(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    StoreSettings = apps.get_model("content", "StoreSettings")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    config = StoreSettings.objects.filter(tenant=tenant).first()
    if config is None:
        return

    for campo, valor in CAMPOS_DE_MARCA_PREVIOS.items():
        setattr(config, campo, valor)

    tokens = dict(config.tokens or {})
    tokens.update(TOKENS_PREVIOS)
    config.tokens = tokens

    config.save(update_fields=[*CAMPOS_DE_MARCA_PREVIOS.keys(), "tokens"])


class Migration(migrations.Migration):

    dependencies = [("content", "0015_siembra_anuncios_cosecha")]

    operations = [migrations.RunPython(aplicar, revertir)]
