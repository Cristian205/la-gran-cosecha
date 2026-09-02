"""
Da de alta el Punto de venta en el catalogo comercial.

Es la segunda vez que se escribe esta migracion —la 0006 hizo lo mismo con
Inventario— y sera la misma para reservas, domicilios y compras. La lista de
comprobacion de un modulo nuevo, ya con dos ejemplos detras:

    1. `accounts/permisos.py`   el catalogo en Python. Sin esto, un gerente no
                                puede recibir el permiso.
    2. Una migracion aqui       el catalogo en la base. Sin esto el modulo
                                funciona, pero Crynex no puede venderlo ni
                                incluirlo en un plan: es invisible.
    3. `<app>/migrations/…rls`  la tercera capa de aislamiento. Activar RLS es
                                tabla por tabla; una app posterior a
                                `tenancy.0003` se queda fuera sin que avise nada.

A diferencia de Inventario, el POS NO se anade a los planes existentes. La
razon es comercial y conviene decirla: inventario es infraestructura que todo
negocio acaba necesitando, y regalar la lectura no le quita valor a nadie. El
punto de venta es un producto que se vende aparte, y meterlo en los planes ya
contratados seria regalarlo a los clientes actuales sin que nadie lo decidiera.
Se activa desde el panel de Crynex, cliente a cliente.

# Por que esto RECONCILIA en vez de crear

Aqui hay una trampa que costo un test entender, y que se repetira con cada
modulo nuevo si no se dice.

`billing.0002` siembra `PermisoDisponible` a partir de `CATALOGO_PERMISOS`, y
`billing.0004` deriva un `Producto` por cada valor DISTINTO de `modulo`, con el
slug sacado de la etiqueta. Asi que en una base NUEVA —donde 0002 ya ve «Punto
de venta»— nace un producto con slug `punto-de-venta`, mientras que en una base
que ya existia no nace ninguno. Crear aqui uno con slug `pos` daba dos
productos para el mismo modulo en el primer caso, y los permisos colgando del
que no era: `modulos_del_plan` devolvia `punto-de-venta` y el codigo preguntaba
por `pos`. El modulo quedaba contratado y apagado a la vez.

Inventario funciono por casualidad: `slugify("Inventario")` da justo
`inventario`. No hay que confiar en esa suerte.

Asi que esta migracion no crea: BUSCA el producto del modulo por cualquiera de
sus caminos, le fija el slug canonico —el que usa el codigo— y recoloca sus
permisos. Es idempotente y da el mismo resultado en las dos bases.
"""
from django.db import migrations

PRODUCTO = {
    "slug": "pos",
    "nombre": "Punto de venta",
    "descripcion": "Caja de mostrador: turnos, ventas, medios de pago y arqueo.",
    "categoria": "Ventas",
    "icono": "scan-line",
    "estado": "ACTIVO",
    "orden": 15,
}

PERMISOS = [
    {
        "codename": "pos.add_venta",
        "etiqueta": "Vender en caja",
        "descripcion": "Abrir ventas, anadir productos y cobrar.",
        "orden": 10,
    },
    {
        "codename": "pos.change_turno",
        "etiqueta": "Abrir y cerrar caja, medios de pago",
        "descripcion": "Cerrar turno deja constancia de un descuadre con nombre y apellidos.",
        "orden": 20,
    },
    {
        "codename": "pos.delete_venta",
        "etiqueta": "Anular ventas",
        "descripcion": "Anular devuelve la mercancia al inventario. No borra el historico.",
        "orden": 30,
    },
]


def dar_de_alta(apps, schema_editor):
    Producto = apps.get_model("billing", "Producto")
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")

    codenames = [d["codename"] for d in PERMISOS]

    # 1. El producto de este modulo, se llame como se llame hoy. Se busca por
    #    el slug canonico, luego por los permisos que ya cuelgan de el, y por
    #    ultimo por el nombre. Cualquiera de los tres lo identifica.
    producto = (
        Producto.objects.filter(slug=PRODUCTO["slug"]).first()
        or Producto.objects.filter(permisos__codename__in=codenames).first()
        or Producto.objects.filter(nombre=PRODUCTO["nombre"]).first()
    )

    if producto is None:
        producto = Producto.objects.create(**PRODUCTO)
    else:
        # Se renombra la fila en vez de crear otra: sus claves foraneas —los
        # permisos, y manana las activaciones de cada negocio— siguen en pie.
        for campo, valor in PRODUCTO.items():
            setattr(producto, campo, valor)
        producto.save()

    # 2. Los duplicados que hubieran quedado de un intento anterior.
    Producto.objects.filter(nombre=PRODUCTO["nombre"]).exclude(pk=producto.pk).delete()

    # 3. Los permisos, apuntando todos al mismo producto.
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
            # Sembrado por la 0002 y enganchado por la 0004 al producto de slug
            # derivado. Es justo el caso que rompia.
            permiso.producto = producto
            permiso.modulo = PRODUCTO["nombre"]
            permiso.save(update_fields=["producto", "modulo"])


def dar_de_baja(apps, schema_editor):
    Producto = apps.get_model("billing", "Producto")
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")

    codenames = {d["codename"] for d in PERMISOS}
    # Se retiran de los planes ANTES de borrarlos, o quedarian codenames
    # colgando en un JSON que ya no valida contra nada.
    for plan in Plan.objects.all():
        permisos = [c for c in (plan.permisos or []) if c not in codenames]
        if len(permisos) != len(plan.permisos or []):
            plan.permisos = permisos
            plan.save(update_fields=["permisos"])

    PermisoDisponible.objects.filter(codename__in=codenames).delete()
    Producto.objects.filter(slug=PRODUCTO["slug"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0006_producto_inventario"),
        ("pos", "0001_initial"),
    ]

    operations = [migrations.RunPython(dar_de_alta, dar_de_baja)]
