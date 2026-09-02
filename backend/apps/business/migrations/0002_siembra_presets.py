"""
Los dos primeros presets, y el perfil de los negocios que ya existian.

DOS, no diez. Escribir de golpe los diez tipos de negocio de la propuesta seria
escribir diez hipotesis sin verificar: la abstraccion se demuestra con el
SEGUNDO negocio real, no con el decimo imaginado. Asi que van el que ya
funciona y uno deliberadamente lejano.

    mercado      lo que hace hoy La Gran Cosecha: pedidos por internet,
                 venta por peso, sin caja, catalogo con foto.
    ferreteria   lo contrario en casi todo: codigo de barras, cobro en
                 mostrador, inventario estricto, catalogo grande y sin fotos.

Si esos dos caben sin ramificar por sector, los ocho restantes son filas que se
dan de alta desde el panel. Si no caben, es much mejor descubrirlo ahora con
dos que dentro de tres meses con diez.

El tercer paso crea el perfil de los negocios dados de alta ANTES de que esta
app existiera: para ellos la senal nunca corrio. Nacen con las capacidades por
defecto y SIN preset, que es exactamente como se comportaban hasta hoy — nadie
se entera de nada, que es lo que tiene que pasar.
"""
from django.db import migrations

PRESETS = [
    {
        "slug": "mercado",
        "nombre": "Mercado y alimentos",
        "descripcion": "Vende por peso, recibe pedidos por internet y entrega a domicilio.",
        "sector": "Alimentos",
        "icono": "shopping-basket",
        "orden": 10,
        "es_predeterminado": True,
        "modulos": ["catalogo", "pedidos", "clientes", "contenido"],
        "capacidades": {
            "acepta_pedidos_online": True,
            "controla_stock": False,
            "vende_por_peso": True,
        },
        "politica_stock": {"permite_negativo": False},
        "esquema_atributos": [],
        "dashboard": ["pedidos_dia", "productos_top", "clientes_nuevos"],
        # Lo que espera de las respuestas del alta. El peso 2 en
        # `vende_por_peso` es lo que lo separa de una tienda cualquiera.
        "senales": {
            "vende_por_peso": 2,
            "acepta_pedidos_online": 2,
            "controla_stock": 1,
        },
    },
    {
        "slug": "ferreteria",
        "nombre": "Ferreteria",
        "descripcion": "Catalogo grande con codigo de barras, cobro en mostrador e inventario estricto.",
        "sector": "Ferreteria",
        "icono": "wrench",
        "orden": 20,
        "es_predeterminado": False,
        "modulos": ["catalogo", "pedidos", "clientes", "inventario"],
        "capacidades": {
            # No vende por internet: el mostrador es el canal. Es justo lo que
            # `acepta_pedidos_online` existe para poder decir.
            "acepta_pedidos_online": False,
            "controla_stock": True,
            "vende_por_peso": False,
        },
        # Una ferreteria prefiere vender y cuadrar despues; una farmacia, no.
        # Es una decision de negocio, no una preferencia tecnica.
        "politica_stock": {"permite_negativo": True},
        "esquema_atributos": [
            {
                "codigo": "empaque",
                "nombre": "Empaque",
                "tipo": "TEXTO",
                "opciones": [],
                "obligatorio": False,
                "usar_en_pos": True,
                "usar_en_filtros": False,
            },
            {
                "codigo": "medida",
                "nombre": "Medida",
                "tipo": "TEXTO",
                "opciones": [],
                "obligatorio": False,
                "usar_en_pos": True,
                "usar_en_filtros": True,
            },
        ],
        "dashboard": ["ventas_dia", "sin_stock", "productos_top"],
        "senales": {
            "usa_codigo_barras": 2,
            "cobra_en_mostrador": 2,
            "controla_stock": 2,
            "catalogo_grande": 1,
        },
    },
]


def sembrar(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")
    PerfilNegocio = apps.get_model("business", "PerfilNegocio")
    Tenant = apps.get_model("tenancy", "Tenant")

    for datos in PRESETS:
        Preset.objects.get_or_create(
            slug=datos["slug"], defaults={k: v for k, v in datos.items() if k != "slug"}
        )

    # Los negocios que ya existian. Capacidades por defecto y sin preset: se
    # comportan hoy igual que ayer, y el panel les ofrecera el alta guiada.
    for tenant in Tenant.objects.all():
        PerfilNegocio.objects.get_or_create(
            tenant=tenant,
            defaults={
                "capacidades": {
                    "acepta_pedidos_online": True,
                    "controla_stock": False,
                    "vende_por_peso": False,
                },
                "politica_stock": {"permite_negativo": False},
            },
        )


def retirar(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")
    Preset.objects.filter(slug__in=[d["slug"] for d in PRESETS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0001_initial"),
        ("tenancy", "0002_migra_la_gran_cosecha"),
    ]

    operations = [migrations.RunPython(sembrar, retirar)]
