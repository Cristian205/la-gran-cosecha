"""
Da de alta Reservas en el catalogo comercial.

Tercera vez que se escribe esta migracion. La lista de comprobacion de un
modulo nuevo, ya con tres ejemplos detras:

    1. `accounts/permisos.py`   el catalogo en Python. Sin esto, un gerente no
                                puede recibir el permiso.
    2. Una migracion aqui       el catalogo en la base. Sin esto el modulo
                                funciona, pero Crynex no puede venderlo ni
                                incluirlo en un plan: es invisible.
    3. `<app>/migrations/…rls`  la tercera capa de aislamiento. Activar RLS es
                                tabla por tabla; una app posterior a
                                `tenancy.0003` se queda fuera sin que avise nada.

Y una cuarta que aparece por primera vez con este modulo, porque es el primero
que aporta algo a otro: registrar su panel en `pos.paneles` desde `ready()`. No
hay migracion para eso —el registro vive en memoria— pero si un test.

Como el POS y a diferencia de Inventario, NO se anade a los planes existentes:
regalarselo a los clientes actuales sin que nadie lo decidiera seria una
decision comercial tomada por descuido. Se activa cliente a cliente desde el
panel de Crynex.

# La trampa del slug, otra vez

`billing.0004` deriva un `Producto` por cada valor distinto de `modulo`, con el
slug sacado de la etiqueta. Aqui `slugify("Reservas")` da `reservas`, que es
justo el slug canonico, asi que en teoria no habria colision. Pero es
exactamente lo que se penso de Inventario —y funciono por casualidad— antes de
que el POS costara un test entenderlo. Asi que esta migracion RECONCILIA igual:
busca el producto del modulo por cualquiera de sus caminos, le fija el slug y
recoloca sus permisos. Depender de que slugify acierte es depender de la suerte.
"""
from django.db import migrations

PRODUCTO = {
    "slug": "reservas",
    "nombre": "Reservas",
    "descripcion": "Agenda de mesas, sillas o canchas, con su panel en la caja.",
    "categoria": "Ventas",
    "icono": "calendar-clock",
    "estado": "ACTIVO",
    "orden": 25,
}

PERMISOS = [
    {
        "codename": "reservations.view_reserva",
        "etiqueta": "Ver la agenda",
        "descripcion": "Consultar que hay reservado y para quien.",
        "orden": 10,
    },
    {
        "codename": "reservations.add_reserva",
        "etiqueta": "Crear y mover reservas",
        "descripcion": "Apartar un hueco, reprogramarlo y cambiarle el estado.",
        "orden": 20,
    },
    {
        "codename": "reservations.change_recurso",
        "etiqueta": "Administrar mesas y recursos",
        "descripcion": "Dar de alta lo que se reserva y como se llama.",
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
        ("billing", "0007_producto_pos"),
        ("reservations", "0001_initial"),
    ]

    operations = [migrations.RunPython(dar_de_alta, dar_de_baja)]
