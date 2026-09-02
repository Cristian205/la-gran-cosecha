"""
El tercer preset, y la prueba de que anadir un tipo de negocio es un alta.

La 0002 lo dejo dicho: «si esos dos caben sin ramificar por sector, los ocho
restantes son filas que se dan de alta desde el panel». Esto es el cobro de esa
promesa, y por eso conviene mirar lo que NO hay en el diff de esta fase:

    cero condiciones sobre `sector` en todo el backend
    cero componentes nuevos en la tienda
    cero ramas dentro de `apps.pos`

Un restaurante es, para Crynex, cuatro cosas dichas con datos: cobra en
mostrador, atiende en mesas, no vende por internet y no lleva inventario
estricto de cada ingrediente. Eso es todo. La palabra «restaurante» solo
aparece como etiqueta que se muestra en pantalla.

# La senal que llevaba dos fases sin consumidor

`tiene_mesas` existe en `PREGUNTAS_DEL_ALTA` desde la fase 9 y hasta hoy no la
miraba ningun preset: se preguntaba y la respuesta no cambiaba nada. Era
exactamente la deuda contra la que avisa `capacidades.py` —una bandera que
nadie lee promete una configurabilidad que no se cumple— y este preset la salda.
Con peso 3, el mas alto de la plataforma, porque es la senal que de verdad
delata: quien atiende en mesas no es un mercado ni una ferreteria.

# Por que este preset SI pide reservas y el POS

Es el primero que pide dos modulos de pago a la vez, y esa es la situacion que
`PENALIZACION_MODULO` existe para manejar: si el plan del cliente no cubre
ninguno de los dos, la sugerencia baja en el orden pero SIGUE reconociendolo
como restaurante, y la pantalla dice que le faltan. Es la diferencia entre
«esto no eres tu» y «esto eres tu, y te falta contratar dos cosas».
"""
from django.db import migrations

PRESET = {
    "slug": "restaurante",
    "nombre": "Restaurante y cafeteria",
    "descripcion": "Atiende en mesas, cobra en el mostrador y reserva por telefono.",
    "sector": "Restaurantes",
    "icono": "utensils",
    "orden": 30,
    "es_predeterminado": False,
    "modulos": ["catalogo", "clientes", "pos", "reservas", "contenido"],
    "capacidades": {
        # Su canal es el salon, no la web. La tienda le sirve de carta que se
        # puede ver, y eso es justo lo que `acepta_pedidos_online` en falso
        # significa: catalogo si, carrito no.
        "acepta_pedidos_online": False,
        # Un restaurante no lleva existencias de cada plato: lleva de
        # ingredientes, que es otro problema y no es este. Contarlas mal es
        # peor que no contarlas.
        "controla_stock": False,
        "vende_por_peso": False,
    },
    "politica_stock": {"permite_negativo": True},
    # Sin ejes de atributos: un plato no viene en tallas. La variante real
    # —«sin cebolla»— es texto libre, y para eso esta la nota por linea.
    "esquema_atributos": [],
    "perfil_pos": {
        # Rejilla por categorias con foto: el mesero busca «Entradas» y toca.
        # Un campo de codigo de barras aqui no serviria de nada.
        "busqueda": "categorias",
        "muestra_imagenes": True,
        "pide_atributos_en_linea": False,
        # La nota por linea es lo que hace usable la caja en un restaurante:
        # «termino medio», «sin picante». Es el unico ajuste del perfil que
        # este sector necesita distinto de los otros dos.
        "permite_nota_por_linea": True,
        # Y aqui esta el pago de la fase 10: el panel lateral se elige por
        # NOMBRE, y el nombre lo aporta un modulo que entonces no existia.
        "panel_lateral": "reserva",
    },
    "dashboard": ["ventas_dia", "reservas_hoy", "productos_top"],
    "senales": {
        "tiene_mesas": 3,
        "cobra_en_mostrador": 2,
    },
}


def sembrar(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")
    Preset.objects.get_or_create(
        slug=PRESET["slug"], defaults={k: v for k, v in PRESET.items() if k != "slug"}
    )


def retirar(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")
    # Se desactiva en vez de borrarse. `Preset` es SET_NULL en el perfil, asi
    # que borrarlo dejaria a los negocios nacidos de el sin decir de donde
    # salieron —el fallo que costo la version en `esta_configurado`— y ademas
    # los sacaria del historial sin que nadie se enterara.
    Preset.objects.filter(slug=PRESET["slug"]).update(activo=False)


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0004_row_level_security"),
        ("billing", "0008_producto_reservas"),
    ]

    operations = [migrations.RunPython(sembrar, retirar)]
