"""
Paso 2 de 3: La Gran Cosecha pasa a ser el tenant #1.

Todo lo que existe hoy en la base pertenece, por definición, a un solo negocio:
no había forma de que fuera de otro. Así que el relleno es un `UPDATE` por
tabla, sin heurísticas ni casos especiales.

Dos detalles de orden importan:

* Los `slug` se generan ANTES de asignar el tenant. Con `tenant` todavía nulo,
  PostgreSQL considera distintas todas las tuplas `(NULL, slug)` y no hay
  choque posible; en cuanto se rellena el tenant, dos slugs iguales serían un
  duplicado real. Las restricciones se crean en el paso 3, después de esto.
* Los `Membership` se derivan del `rol_usuario` que ya tiene cada usuario, para
  que nadie pierda acceso al desplegar. La fase 4 retira ese campo.

Es reversible: `migrate tenancy 0001` deshace el relleno y borra el negocio.
Con eso y el `dumpdata` previo, la marcha atrás está cubierta por dos caminos.
"""
from django.db import migrations
from django.utils.text import slugify

# El negocio que ya usa la plataforma. Es un dato de arranque, no una constante
# del código: a partir de aquí La Gran Cosecha es una fila como cualquier otra.
SLUG = "la-gran-cosecha"
NOMBRE = "La Gran Cosecha"

# Modelos que reciben el tenant. El orden no importa: todos van al mismo.
CON_TENANT = [
    ("catalog", "Categoria"),
    ("catalog", "UnidadMedida"),
    ("catalog", "Producto"),
    ("catalog", "PresentacionProducto"),
    ("catalog", "HistorialPrecio"),
    ("orders", "Cliente"),
    ("orders", "Pedido"),
    ("orders", "DetallePedido"),
    ("orders", "HistorialDetallePedido"),
    ("orders", "DetallePedidoManual"),
    ("orders", "LotePedidos"),
    ("content", "PromoBanner"),
    ("content", "Testimonio"),
    ("content", "TrustBadge"),
    ("content", "BeneficioComercial"),
    ("content", "OfertaProducto"),
    ("media", "Archivo"),
    ("notifications", "Notificacion"),
    ("contact", "MensajeContacto"),
]

# rol_usuario actual -> rol de la pertenencia. GERENTE era el dueño de la
# cuenta según `es_owner()`, así que se conserva esa semántica.
ROLES = {"GERENTE": "OWNER", "ADMIN": "ADMIN", "ANALISTA": "STAFF"}


def _slugs(modelo, campo_nombre, maximo):
    """Rellena los slug vacíos evitando choques dentro del propio lote."""
    usados = set(
        modelo.objects.exclude(slug="").values_list("slug", flat=True)
    )
    for fila in modelo.objects.filter(slug="").iterator():
        base = slugify(getattr(fila, campo_nombre))[:maximo] or "sin-nombre"
        candidato, sufijo = base, 2
        while candidato in usados:
            candidato = f"{base}-{sufijo}"
            sufijo += 1
        usados.add(candidato)
        fila.slug = candidato
        fila.save(update_fields=["slug"])


def migrar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Membership = apps.get_model("tenancy", "Membership")
    StoreSettings = apps.get_model("content", "StoreSettings")
    Usuario = apps.get_model("accounts", "Usuario")

    # Si no hay absolutamente nada, esta es una instalación limpia y no hay
    # negocio histórico que rescatar.
    hay_datos = (
        apps.get_model("catalog", "Producto").objects.exists()
        or apps.get_model("orders", "Pedido").objects.exists()
        or Usuario.objects.exists()
    )
    if not hay_datos:
        return

    tenant, _ = Tenant.objects.get_or_create(
        slug=SLUG, defaults={"nombre": NOMBRE, "estado": "ACTIVO"}
    )

    # 1. Slugs primero — ver la nota de orden en el docstring.
    _slugs(apps.get_model("catalog", "Categoria"), "nombre_categoria", 50)
    _slugs(apps.get_model("catalog", "Producto"), "nombre_producto", 50)

    # 2. El relleno propiamente dicho.
    for etiqueta, nombre in CON_TENANT:
        apps.get_model(etiqueta, nombre).objects.filter(tenant__isnull=True).update(
            tenant=tenant
        )

    # 3. La configuración del sitio deja de ser un singleton y pasa a ser la
    #    de este negocio. Si nunca se guardó ninguna, se crea con los valores
    #    por defecto del modelo para que la tienda no se quede sin identidad.
    if not StoreSettings.objects.filter(tenant=tenant).exists():
        config = StoreSettings.objects.filter(tenant__isnull=True).first()
        if config is None:
            config = StoreSettings.objects.create(tenant=tenant)
        else:
            config.tenant = tenant
            config.save(update_fields=["tenant"])

    # 4. Cada usuario existente pasa a pertenecer al negocio, con el rol
    #    equivalente al que ya tenía. Nadie pierde acceso al desplegar.
    for usuario in Usuario.objects.all().iterator():
        rol = "OWNER" if usuario.is_superuser else ROLES.get(usuario.rol_usuario, "STAFF")
        Membership.objects.get_or_create(
            usuario=usuario, tenant=tenant, defaults={"rol": rol}
        )


def revertir(apps, schema_editor):
    """
    Devuelve la base al estado anterior: sin negocio y sin columna asignada.

    No se borran los slug generados: son inocuos con `tenant` nulo y volver a
    vaciarlos no aporta nada.
    """
    Tenant = apps.get_model("tenancy", "Tenant")
    tenant = Tenant.objects.filter(slug=SLUG).first()
    if tenant is None:
        return

    for etiqueta, nombre in CON_TENANT:
        apps.get_model(etiqueta, nombre).objects.filter(tenant=tenant).update(tenant=None)

    apps.get_model("content", "StoreSettings").objects.filter(tenant=tenant).update(
        tenant=None
    )
    apps.get_model("tenancy", "Membership").objects.filter(tenant=tenant).delete()
    tenant.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        # Todas las columnas tienen que existir antes de rellenarlas.
        ("catalog", "0003_anade_tenant"),
        ("orders", "0004_anade_tenant"),
        ("content", "0007_anade_tenant"),
        ("media", "0002_anade_tenant"),
        ("notifications", "0003_anade_tenant"),
        ("contact", "0002_anade_tenant"),
        ("accounts", "0004_usuario_debe_cambiar_password"),
    ]

    operations = [migrations.RunPython(migrar, revertir)]
