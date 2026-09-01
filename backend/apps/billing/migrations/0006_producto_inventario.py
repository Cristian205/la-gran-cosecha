"""
Da de alta Inventario en el catalogo comercial.

Es el hueco que deja el diseno de dos catalogos, y conviene entenderlo porque
se va a repetir con el POS y con cada modulo que venga:

* `accounts/permisos.py` es el catalogo en PYTHON. Lo lee el panel del negocio
  para pintar las casillas al delegar permisos, y el serializador para validar
  lo que se asigna. Anadir una entrada ahi basta para que un GERENTE pueda
  recibir el permiso.
* `billing.PermisoDisponible` es el catalogo en la BASE. Lo lee el panel de
  Crynex, y es lo que los planes conceden. Se sembro una sola vez, en la 0002,
  a partir del de Python.

Anadir un permiso solo al primero lo deja funcionando para el negocio pero
INVISIBLE para la plataforma: no se puede vender, no se puede incluir en un
plan y no aparece en la administracion. Por eso cada modulo nuevo trae su
propia migracion de alta, en vez de confiar en que alguien vuelva a la 0002.

Se sigue el mismo criterio que la 0004: un `Producto` por modulo, y sus
permisos colgando de el.
"""
from django.db import migrations

PRODUCTO = {
    "slug": "inventario",
    "nombre": "Inventario",
    "descripcion": "Existencias por ubicacion, kardex, ajustes y traslados.",
    "categoria": "Operacion",
    "icono": "boxes",
    "estado": "ACTIVO",
    "orden": 25,
}

PERMISOS = [
    {
        "codename": "inventory.view_existencia",
        "etiqueta": "Ver existencias y kardex",
        "descripcion": "Consultar cuanto hay de cada producto y su historico.",
        "orden": 10,
    },
    {
        "codename": "inventory.change_existencia",
        "etiqueta": "Registrar entradas, ajustes y traslados",
        "descripcion": "Mover existencias. No permite reescribir el historico.",
        "orden": 20,
    },
]

#: A que planes se anade. Los que ya conceden 'todo' lo reciben; a los basicos
#: se les da solo la lectura, que es lo que corresponde a un plan de entrada:
#: ver el stock si, moverlo es operacion.
SOLO_LECTURA = ("basico", "inicial", "starter")


def dar_de_alta(apps, schema_editor):
    Producto = apps.get_model("billing", "Producto")
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")

    producto, _ = Producto.objects.get_or_create(
        slug=PRODUCTO["slug"],
        defaults={k: v for k, v in PRODUCTO.items() if k != "slug"},
    )

    for datos in PERMISOS:
        PermisoDisponible.objects.get_or_create(
            codename=datos["codename"],
            defaults={
                "producto": producto,
                "modulo": PRODUCTO["nombre"],
                "etiqueta": datos["etiqueta"],
                "descripcion": datos["descripcion"],
                "orden": datos["orden"],
            },
        )

    # Los planes ya vendidos no cambian de precio ni de estado; solo ganan
    # acceso a un modulo nuevo. Es aditivo a proposito: quitar algo a un plan
    # en produccion es una decision comercial, no un efecto de una migracion.
    for plan in Plan.objects.all():
        permisos = list(plan.permisos or [])
        nuevos = [PERMISOS[0]["codename"]]
        if plan.slug not in SOLO_LECTURA:
            nuevos.append(PERMISOS[1]["codename"])

        faltan = [c for c in nuevos if c not in permisos]
        if faltan:
            plan.permisos = permisos + faltan
            plan.save(update_fields=["permisos"])


def dar_de_baja(apps, schema_editor):
    """
    Revierte el alta. Retira los permisos de los planes ANTES de borrarlos, o
    quedarian codenames colgando en un JSON que ya no valida contra nada.
    """
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
        ("billing", "0005_retira_columnas_viejas_de_plan"),
        # El modulo tiene que existir antes de venderlo.
        ("inventory", "0001_initial"),
    ]

    operations = [migrations.RunPython(dar_de_alta, dar_de_baja)]
