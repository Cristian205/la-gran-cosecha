"""
Da de alta «Plano de carga» en el catálogo comercial.

Mismo procedimiento y misma reconciliación que `0009_producto_domicilios`. No
se añade a ningún plan: se activa negocio a negocio desde el panel de la
plataforma.
"""
from django.db import migrations

PRODUCTO = {
    "slug": "plano-carga",
    "nombre": "Plano de carga",
    "descripcion": "Plano 3D del furgón para ordenar las canastillas de cada despacho.",
    "categoria": "Ventas",
    "icono": "truck",
    "estado": "ACTIVO",
    "orden": 27,
}

PERMISOS = [
    {
        "codename": "logistica.view_planocarga",
        "etiqueta": "Ver los planos de carga",
        "descripcion": "Consultar cómo va acomodado cada despacho en el furgón.",
        "orden": 10,
    },
    {
        "codename": "logistica.add_planocarga",
        "etiqueta": "Armar y guardar planos de carga",
        "descripcion": "Crear despachos, acomodar las canastillas y guardarlos.",
        "orden": 20,
    },
    {
        "codename": "logistica.change_furgon",
        "etiqueta": "Administrar furgones y canastillas",
        "descripcion": "Registrar vehículos y las medidas de las canastillas.",
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
        ("billing", "0013_configuracion_integracion"),
        ("logistica", "0001_initial"),
    ]

    operations = [migrations.RunPython(dar_de_alta, dar_de_baja)]
