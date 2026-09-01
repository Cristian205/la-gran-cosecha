"""
Traslada lo que ya existia a las tablas del motor comercial.

Es el paso delicado de los tres: la 0003 crea las tablas, esta mueve los datos
y la 0005 retira las columnas viejas. Separarlo asi es lo que permite que un
despliegue con datos reales no pierda ningun precio.

Cuatro traslados, cada uno reversible:

1. `PermisoDisponible.modulo` era una cadena repetida en cada fila. Los valores
   distintos se convierten en `Producto` y cada permiso queda apuntando al
   suyo. La cadena se conserva: hay pantallas que agrupan por ella.
2. `Plan.precio_mensual` + `Plan.moneda` pasan a ser una fila de `PrecioPlan`
   mensual, vigente desde la fecha de creacion del plan. Que sea una fila y no
   una columna es lo que permitira subir la tarifa sin reescribir lo que se
   cobro antes.
3. `Plan.activo` (booleano) pasa a `Plan.estado`. `False` no es BORRADOR sino
   ARCHIVADO: un plan desactivado ya se habia vendido, y un borrador es otra
   cosa: uno que aun no se ha publicado.
4. Los limites que los planes ya usaban en su JSON se declaran como filas de
   `TipoLimite`, con los valores por defecto que hasta ahora vivian en la
   constante `Plan.LIMITES_POR_DEFECTO`.
"""
from decimal import Decimal

from django.db import migrations
from django.utils import timezone
from django.utils.text import slugify

# Lo que era `Plan.LIMITES_POR_DEFECTO` en el modelo. Se copia aqui, y no se
# importa, porque una migracion tiene que seguir corriendo igual dentro de un
# ano cuando esa constante ya no exista.
LIMITES = [
    {
        "codigo": "max_usuarios",
        "nombre": "Usuarios",
        "descripcion": "Personas con acceso al panel del negocio.",
        "unidad": "UNIDAD",
        "valor_por_defecto": 3,
        # Los unicos dos que el serializador sabe contar hoy.
        "medido": True,
        "orden": 10,
    },
    {
        "codigo": "max_dominios",
        "nombre": "Dominios",
        "descripcion": "Direcciones por las que responde la tienda.",
        "unidad": "UNIDAD",
        "valor_por_defecto": 1,
        "medido": True,
        "orden": 20,
    },
    {
        "codigo": "max_productos",
        "nombre": "Productos",
        "descripcion": "Referencias en el catalogo.",
        "unidad": "UNIDAD",
        "valor_por_defecto": 100,
        "medido": False,
        "orden": 30,
    },
    {
        "codigo": "max_almacenamiento_mb",
        "nombre": "Almacenamiento",
        "descripcion": "Espacio para imagenes y archivos.",
        "unidad": "MB",
        "valor_por_defecto": 512,
        "medido": False,
        "orden": 40,
    },
]


def columnas_viejas_presentes(schema_editor) -> bool:
    """
    Si `Plan` todavia tiene las columnas que esta migracion traslada.

    Hace falta preguntarlo porque hubo una version de este cambio en la que el
    borrado de columnas iba en la 0004 y el traslado no existia: una base que
    aplico aquella se queda sin `precio_mensual` antes de llegar aqui, y el
    modelo historico de este punto SI la declara, asi que cualquier consulta al
    ORM sobre Plan reventaria con UndefinedColumn.

    Se comprueba contra el esquema real y no contra el estado de las
    migraciones, que es lo unico que no puede mentir.
    """
    with schema_editor.connection.cursor() as cursor:
        columnas = {
            c.name
            for c in schema_editor.connection.introspection.get_table_description(
                cursor, "billing_plan"
            )
        }
    return "precio_mensual" in columnas


def trasladar(apps, schema_editor):
    Producto = apps.get_model("billing", "Producto")
    TipoLimite = apps.get_model("billing", "TipoLimite")
    PermisoDisponible = apps.get_model("billing", "PermisoDisponible")
    Plan = apps.get_model("billing", "Plan")
    PrecioPlan = apps.get_model("billing", "PrecioPlan")

    # --- 1. los modulos se vuelven productos ---------------------------
    modulos = [
        m
        for m in PermisoDisponible.objects.values_list("modulo", flat=True).distinct()
        if m
    ]
    for orden, modulo in enumerate(sorted(modulos), start=1):
        # El slug puede chocar si dos modulos se llaman parecido; se desempata
        # con el orden antes que fallar la migracion entera.
        base = slugify(modulo)[:50] or f"producto-{orden}"
        slug = base
        n = 2
        while Producto.objects.filter(slug=slug).exclude(nombre=modulo).exists():
            slug = f"{base}-{n}"[:50]
            n += 1

        producto, _ = Producto.objects.get_or_create(
            slug=slug,
            defaults={"nombre": modulo, "estado": "ACTIVO", "orden": orden * 10},
        )
        PermisoDisponible.objects.filter(modulo=modulo, producto__isnull=True).update(
            producto=producto
        )

    # --- 2. el catalogo de limites -------------------------------------
    for datos in LIMITES:
        TipoLimite.objects.get_or_create(codigo=datos["codigo"], defaults=datos)

    # Cualquier clave que algun plan use y no este en la lista de arriba: se
    # declara igualmente, porque si no el serializador la rechazaria al primer
    # guardado y el limite dejaria de poder editarse.
    conocidos = {d["codigo"] for d in LIMITES}
    sueltos = set()
    for limites in Plan.objects.values_list("limites", flat=True):
        sueltos.update(k for k in (limites or {}) if k not in conocidos)
    for orden, codigo in enumerate(sorted(sueltos), start=1):
        TipoLimite.objects.get_or_create(
            codigo=codigo,
            defaults={
                "nombre": codigo.removeprefix("max_").replace("_", " ").capitalize(),
                "unidad": "MB" if codigo.endswith("_mb") else "UNIDAD",
                "valor_por_defecto": None,
                "orden": 100 + orden,
            },
        )

    # --- 3 y 4. estado y precio de cada plan ---------------------------
    if not columnas_viejas_presentes(schema_editor):
        # Esta base ya perdio las columnas antes de que existiera el traslado.
        # Los productos y los limites de arriba si se crean —no dependen de
        # ellas—, pero los precios no se pueden deducir de nada, y esta
        # migracion no va a inventarlos: se avisa y se sigue.
        print(
            "\n  billing.0004: billing_plan ya no tiene precio_mensual, asi que"
            " se omite el traslado de precios."
            "\n  Los planes quedan SIN tarifa: cargalas en Planes -> Precios,"
            " o restauralas de un respaldo.\n"
        )
        return

    for plan in Plan.objects.all():
        plan.estado = "ACTIVO" if plan.activo else "ARCHIVADO"
        plan.save(update_fields=["estado"])

        importe = Decimal(plan.precio_mensual or 0)
        # Un plan gratuito no necesita fila de precio: `importe_mensual()`
        # devuelve cero solo con no encontrarla, y una fila de 0,00 daria a
        # entender que alguien fijo esa tarifa a proposito.
        if importe <= 0:
            continue

        PrecioPlan.objects.get_or_create(
            plan=plan,
            moneda=plan.moneda or "COP",
            periodicidad="MENSUAL",
            # `localdate()` y no `.date()`: `fecha_creacion` es un datetime en
            # UTC, y de 19:00 en adelante (hora de Bogota) su fecha UTC ya es la
            # del dia siguiente. Con `.date()`, una migracion aplicada por la
            # tarde dejaba el precio vigente MANANA y todos los planes sin
            # tarifa hasta entonces.
            vigente_desde=timezone.localdate(plan.fecha_creacion),
            defaults={
                "importe": importe,
                "notas": "Trasladado desde Plan.precio_mensual.",
            },
        )


def revertir(apps, schema_editor):
    """
    Devuelve el precio y el estado a las columnas viejas.

    Existe para que la 0005 se pueda deshacer sin dejar los planes a cero. Los
    productos y los tipos de limite NO se borran: son datos nuevos que alguien
    puede haber editado ya, y una marcha atras del esquema no deberia llevarse
    por delante trabajo del administrador.
    """
    Plan = apps.get_model("billing", "Plan")
    PrecioPlan = apps.get_model("billing", "PrecioPlan")

    if not columnas_viejas_presentes(schema_editor):
        return

    for plan in Plan.objects.all():
        plan.activo = plan.estado == "ACTIVO"
        mensual = (
            PrecioPlan.objects.filter(plan=plan, periodicidad="MENSUAL")
            .order_by("-vigente_desde")
            .first()
        )
        if mensual:
            plan.precio_mensual = mensual.importe
            plan.moneda = mensual.moneda
        plan.save(update_fields=["activo", "precio_mensual", "moneda"])


class Migration(migrations.Migration):
    dependencies = [("billing", "0003_motor_comercial")]

    operations = [migrations.RunPython(trasladar, revertir)]
