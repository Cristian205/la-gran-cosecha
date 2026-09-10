"""
Da de alta Domicilios en el catalogo comercial.

Cuarta vez que se escribe esta migracion, y la lista de comprobacion de un
modulo nuevo ya no es una promesa sino un procedimiento:

    1. `accounts/permisos.py`   el catalogo en Python. Sin esto, un gerente no
                                puede recibir el permiso.
    2. Una migracion aqui       el catalogo en la base. Sin esto el modulo
                                funciona, pero Crynex no puede venderlo ni
                                incluirlo en un plan: es invisible.
    3. `<app>/migrations/…rls`  la tercera capa de aislamiento. Activar RLS es
                                tabla por tabla; una app posterior a
                                `tenancy.0003` se queda fuera sin que avise nada.
    4. `<app>/paneles.py`       si aporta algo a la caja, se registra desde
                                `ready()`. No hay migracion —el registro vive
                                en memoria— pero si un test.

Como el POS y como Reservas, NO se anade a los planes existentes: regalarselo a
los clientes actuales sin que nadie lo decidiera seria una decision comercial
tomada por descuido. Se activa cliente a cliente desde el panel de Crynex.

# La trampa del slug, por cuarta vez

`billing.0004` deriva un `Producto` por cada valor distinto de `modulo`, con el
slug sacado de la etiqueta. Aqui `slugify("Domicilios")` da `domicilios`, que es
el slug canonico, asi que en teoria no hay colision. Es exactamente lo que se
penso de Inventario —y funciono por casualidad— antes de que el POS costara un
test entenderlo. Asi que esta migracion RECONCILIA igual: busca el producto del
modulo por cualquiera de sus caminos, le fija el slug y recoloca sus permisos.
Depender de que slugify acierte es depender de la suerte, y la suerte no se
reproduce en el despliegue del cliente.
"""
from django.db import migrations

PRODUCTO = {
    "slug": "domicilios",
    "nombre": "Domicilios",
    "descripcion": "Zonas, repartidores y el tablero de envios, con su panel en la caja.",
    "categoria": "Ventas",
    "icono": "bike",
    "estado": "ACTIVO",
    "orden": 26,
}

PERMISOS = [
    {
        "codename": "delivery.view_envio",
        "etiqueta": "Ver el tablero de envios",
        "descripcion": "Consultar que hay por despachar y quien lo lleva.",
        "orden": 10,
    },
    {
        "codename": "delivery.add_envio",
        "etiqueta": "Crear, asignar y despachar envios",
        "descripcion": "Anotar un domicilio, dárselo a un repartidor y moverlo de estado.",
        "orden": 20,
    },
    {
        "codename": "delivery.change_zona",
        "etiqueta": "Administrar zonas y repartidores",
        "descripcion": "Dar de alta a donde se llega, cuanto cuesta y quien reparte.",
        "orden": 30,
    },
]


def dar_de_alta(apps, schema_editor):
    Producto = apps.get_model("billing", "Producto")
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")

    codenames = [d["codename"] for d in PERMISOS]

    producto = (
        Producto.objects.filter(slug=PRODUCTO["slug"]).first()
        or Producto.objects.filter(permisos__codename__in=codenames).first()
        or Producto.objects.filter(nombre=PRODUCTO["nombre"]).first()
    )

    if producto is None:
        producto = Producto.objects.create(**PRODUCTO)
    else:
        for campo, valor in PRODUCTO.items():
            setattr(producto, campo, valor)
        producto.save()

    Producto.objects.filter(nombre=PRODUCTO["nombre"]).exclude(pk=producto.pk).delete()

    for datos in PERMISOS:
        permiso, creado = PermisoDisponible.objects.get_or_create(
            codename=datos["codename"],
            defaults={
                "producto": producto,
                "modulo": PRODUCTO["nombre"],
                "etiqueta": datos["etiqueta"],
                "descripcion": datos["descripcion"],
                "orden": datos["orden"],
            },
        )
        if not creado and permiso.producto_id != producto.pk:
            permiso.producto = producto
            permiso.modulo = PRODUCTO["nombre"]
            permiso.save(update_fields=["producto", "modulo"])


def dar_de_baja(apps, schema_editor):
    Producto = apps.get_model("billing", "Producto")
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")

    codenames = {d["codename"] for d in PERMISOS}
    for plan in Plan.objects.all():
        permisos = [c for c in (plan.permisos or []) if c not in codenames]
        if len(permisos) != len(plan.permisos or []):
            plan.permisos = permisos
            plan.save(update_fields=["permisos"])

    PermisoDisponible.objects.filter(codename__in=codenames).delete()
    Producto.objects.filter(slug=PRODUCTO["slug"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0008_producto_reservas"),
        ("delivery", "0001_initial"),
    ]

    operations = [migrations.RunPython(dar_de_alta, dar_de_baja)]
