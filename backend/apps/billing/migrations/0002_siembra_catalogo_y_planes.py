"""
Siembra el catálogo de permisos y los tres planes de arranque.

Los permisos NO se inventan aquí: salen de `accounts/permisos.py`, que es el
catálogo curado que el panel ya venía usando. Pasarlos a filas es lo que
permite que Crynex añada un módulo sin desplegar código, y que cada plan
decida cuáles incluye.

El reparto entre planes es una propuesta de arranque, no una decisión cerrada:
se administra desde el panel de plataforma y se puede cambiar sin migración.
"""
from django.db import migrations

# Lo que cada plan concede, por módulo. Se escribe así y no con codenames
# sueltos porque es como se razona el producto: «Starter ve el catálogo,
# Growth lo edita, Business además administra usuarios».
REPARTO = {
    "starter": {"Catálogo": ["view"], "Pedidos": ["view"], "Clientes": ["view"]},
    "growth": {
        "Catálogo": ["view", "change"],
        "Pedidos": ["view", "change"],
        "Clientes": ["view", "change"],
        "Contenido": ["view"],
    },
    "business": "todos",
}

PLANES = [
    {
        "slug": "starter",
        "nombre": "Starter",
        "descripcion": "Para empezar a vender en línea.",
        "precio_mensual": 0,
        "orden": 1,
        "es_predeterminado": True,
        "limites": {
            "max_productos": 100,
            "max_usuarios": 2,
            "max_dominios": 1,
            "max_almacenamiento_mb": 512,
        },
    },
    {
        "slug": "growth",
        "nombre": "Growth",
        "descripcion": "Para negocios que ya venden y quieren crecer.",
        "precio_mensual": 89000,
        "orden": 2,
        "es_predeterminado": False,
        "limites": {
            "max_productos": 1000,
            "max_usuarios": 8,
            "max_dominios": 2,
            "max_almacenamiento_mb": 5120,
        },
    },
    {
        "slug": "business",
        "nombre": "Business",
        "descripcion": "Sin límites de catálogo y con equipo completo.",
        "precio_mensual": 249000,
        "orden": 3,
        "es_predeterminado": False,
        # `None` es «sin límite», y es distinto de no fijarlo: no fijarlo
        # heredaría el valor por defecto del modelo.
        "limites": {
            "max_productos": None,
            "max_usuarios": 30,
            "max_dominios": 5,
            "max_almacenamiento_mb": 51200,
        },
    },
]


def sembrar(apps, schema_editor):
    from apps.accounts.permisos import CATALOGO_PERMISOS  # noqa: PLC0415

    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")
    Subscription = apps.get_model("billing", "Subscription")
    Tenant = apps.get_model("tenancy", "Tenant")

    # 1. El catálogo, tal cual lo tenía el panel.
    for orden_modulo, modulo in enumerate(CATALOGO_PERMISOS):
        for orden, permiso in enumerate(modulo["permisos"]):
            PermisoDisponible.objects.get_or_create(
                codename=permiso["codename"],
                defaults={
                    "modulo": modulo["modulo"],
                    "etiqueta": permiso["etiqueta"],
                    "orden": orden_modulo * 100 + orden,
                },
            )

    todos = list(PermisoDisponible.objects.values_list("codename", "modulo"))

    # 2. Los planes, con los permisos que les toquen.
    for datos in PLANES:
        reparto = REPARTO[datos["slug"]]
        if reparto == "todos":
            permisos = [c for c, _ in todos]
        else:
            permisos = [
                codename
                for codename, modulo in todos
                if any(
                    f".{accion}_" in codename for accion in reparto.get(modulo, [])
                )
            ]
        Plan.objects.get_or_create(
            slug=datos["slug"],
            defaults={**{k: v for k, v in datos.items() if k != "slug"},
                      "permisos": sorted(permisos)},
        )

    # 3. Los negocios que ya existen entran con el plan más alto: estaban
    #    usando el sistema entero antes de que hubiera planes, y recortarles el
    #    acceso al desplegar sería quitarles algo que ya tenían.
    business = Plan.objects.filter(slug="business").first()
    if business:
        for tenant in Tenant.objects.all():
            Subscription.objects.get_or_create(
                tenant=tenant, defaults={"plan": business, "estado": "ACTIVA"}
            )


def revertir(apps, schema_editor):
    apps.get_model("billing", "Subscription").objects.all().delete()
    apps.get_model("billing", "Plan").objects.all().delete()
    apps.get_model("billing", "PermisoDisponible").objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
        ("tenancy", "0004_registra_dominios_iniciales"),
    ]

    operations = [migrations.RunPython(sembrar, revertir)]
