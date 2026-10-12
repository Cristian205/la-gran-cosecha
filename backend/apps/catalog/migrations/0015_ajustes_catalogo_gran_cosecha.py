"""
Ajustes del catálogo de La Gran Cosecha pedidos por el negocio.

    Naranja     + Tangelo (maya, kilo, canastilla y bulto, como la Valencia)
    Kiwi        + libra
    Ochuas      + libra (ya tenía bandeja y kilo)
    Acelga      se vende por 1/4 y 1/2 (desde 0,25 de 0,25 en 0,25)
    Papa        + Sabanera por kilo, arroba y bulto
    Zanahoria   + arroba
    Plátano     cada presentación, también Maduro, Verde, Pintón, Mixto y Negro
    Peto        libra y arroba por fracción (desde 0,5 de 0,5 en 0,5)
    Queso       + Entero por bloque y libra, por fracción
    Acelto      → Acento        Famuloso → Fabuloso

La madurez del plátano va en el NOMBRE de la presentación («Artón Maduro»),
como ya hace el Mango («Tommy Maduro»): la tienda deja elegir presentación,
no atributos sueltos. Las presentaciones que ya existían se conservan: los
pedidos anteriores las referencian.

# Precios

Son DE PRUEBA, para que el negocio los ajuste desde el panel: la libra a la
mitad del kilo, la arroba a 25 libras, la Sabanera con los precios que tenía
en el producto «Papa» inactivo, y lo demás con el precio de la presentación
hermana en la misma unidad.

Cada presentación nueva copia las reglas de cantidad de sus hermanas, para
que se pida igual que el resto del producto. Si un producto o una unidad no
existen (otra base), esa línea se salta; volver a ejecutarla no duplica nada.
"""
from decimal import Decimal

from django.db import migrations

TENANT_SLUG = "la-gran-cosecha"
MADUREZ = ["Maduro", "Verde", "Pintón", "Mixto", "Negro"]


def aplicar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Producto = apps.get_model("catalog", "Producto")
    Presentacion = apps.get_model("catalog", "PresentacionProducto")
    Unidad = apps.get_model("catalog", "UnidadMedida")

    tenant = Tenant.objects.filter(slug=TENANT_SLUG).first()
    if tenant is None:
        return

    unidades = {u.nombre_unidad: u for u in Unidad.objects.filter(tenant=tenant)}

    def producto(nombre, activo=None):
        qs = Producto.objects.filter(tenant=tenant, nombre_producto=nombre)
        if activo is not None:
            qs = qs.filter(estado_producto=activo)
        return qs.order_by("id").first()

    def presentaciones(prod):
        return list(Presentacion.objects.filter(producto=prod).order_by("orden", "id"))

    def hermana(prod, nombre=None, unidad=None):
        """La presentación existente que sirve de modelo (reglas y precio)."""
        for p in presentaciones(prod):
            if (nombre is None or p.nombre_presentacion == nombre) and (
                unidad is None or p.unidad_venta.nombre_unidad == unidad
            ):
                return p
        return None

    def agregar(prod, nombre, unidad, precio, modelo=None, reglas=None):
        if prod is None or unidad not in unidades or precio is None:
            return
        if Presentacion.objects.filter(producto=prod, nombre_presentacion=nombre, unidad_venta=unidades[unidad]).exists():
            return
        modelo = modelo or (presentaciones(prod) or [None])[0]
        minima, incremento, decimales = reglas or (
            (modelo.cantidad_minima, modelo.incremento_cantidad, modelo.decimales_cantidad)
            if modelo is not None
            else (Decimal("1"), Decimal("1"), 0)
        )
        ultimo = max((p.orden for p in presentaciones(prod)), default=-1)
        Presentacion.objects.create(
            tenant=tenant,
            producto=prod,
            nombre_presentacion=nombre,
            unidad_venta=unidades[unidad],
            factor_conversion=Decimal("1"),
            precio_unitario=Decimal(precio),
            cantidad_minima=minima,
            incremento_cantidad=incremento,
            decimales_cantidad=decimales,
            orden=ultimo + 1,
        )

    def precio_de(prod, nombre, unidad, factor=Decimal("1")):
        p = hermana(prod, nombre, unidad)
        return (p.precio_unitario * factor).quantize(Decimal("1")) if p else None

    def fracciones(prod, minima, incremento, decimales, tipo):
        if prod is None:
            return
        for p in presentaciones(prod):
            p.cantidad_minima, p.incremento_cantidad, p.decimales_cantidad = minima, incremento, decimales
            p.version = (p.version or 0) + 1
            p.save(update_fields=["cantidad_minima", "incremento_cantidad", "decimales_cantidad", "version"])
        prod.permite_fraccion = True
        prod.tipo_cantidad = tipo
        prod.save(update_fields=["permite_fraccion", "tipo_cantidad"])

    def renombrar(viejo, nuevo):
        prod = producto(viejo)
        if prod is None:
            return
        prod.nombre_producto = nuevo
        campos = ["nombre_producto"]
        slug = nuevo.lower()
        if not Producto.objects.filter(tenant=tenant, slug=slug).exclude(pk=prod.pk).exists():
            prod.slug = slug
            campos.append("slug")
        prod.save(update_fields=campos)

    # Naranja: Tangelo en las mismas unidades que la Valencia.
    naranja = producto("Naranja")
    if naranja is not None:
        for p in presentaciones(naranja):
            if p.nombre_presentacion == "Valencia":
                agregar(naranja, "Tangelo", p.unidad_venta.nombre_unidad, p.precio_unitario, modelo=p)

    # Kiwi y Ochuas: libra a la mitad del kilo.
    for nombre in ("Kiwi", "Ochuas"):
        prod = producto(nombre)
        if prod is not None:
            agregar(prod, "Común", "Libra", precio_de(prod, "Común", "Kilogramo", Decimal("0.5")),
                    modelo=hermana(prod, "Común", "Kilogramo"))

    # Acelga: 1/4 y 1/2.
    fracciones(producto("Acelga"), Decimal("0.25"), Decimal("0.25"), 2, "cuarto")

    # Papa (la activa): Sabanera con los precios de la Papa inactiva.
    papa = producto("Papa", activo=True)
    vieja = producto("Papa", activo=False)
    if papa is not None:
        respaldo = {"Kilogramo": Decimal("2000"), "Arroba": Decimal("20000"), "Bulto": Decimal("120000")}
        for unidad, precio in respaldo.items():
            anterior = hermana(vieja, "Sabanera", unidad) if vieja is not None else None
            agregar(papa, "Sabanera", unidad, anterior.precio_unitario if anterior else precio)

    # Zanahoria: arroba = 25 libras.
    zanahoria = producto("Zanahoria")
    if zanahoria is not None:
        agregar(zanahoria, "Común", "Arroba", precio_de(zanahoria, "Común", "Libra", Decimal("25")),
                modelo=hermana(zanahoria, "Común", "Libra"))

    # Plátano: cada presentación existente, también por madurez.
    platano = producto("Platano") or producto("Plátano")
    if platano is not None:
        for base in presentaciones(platano):
            if any(base.nombre_presentacion.endswith(f" {m}") for m in MADUREZ):
                continue
            for madurez in MADUREZ:
                agregar(platano, f"{base.nombre_presentacion} {madurez}", base.unidad_venta.nombre_unidad,
                        base.precio_unitario, modelo=base)

    # Peto: libra y arroba por fracción.
    fracciones(producto("Peto"), Decimal("0.5"), Decimal("0.5"), 1, "medio")

    # Queso: Entero por bloque y libra, por fracción.
    queso = producto("Queso")
    if queso is not None:
        reglas = (Decimal("0.5"), Decimal("0.5"), 1)
        agregar(queso, "Entero", "Bloque", precio_de(queso, "Tajado", "Bloque") or Decimal("52000"), reglas=reglas)
        agregar(queso, "Entero", "Libra", precio_de(queso, "Campesino", "Libra") or Decimal("12000"), reglas=reglas)

    # Nombres mal escritos.
    renombrar("Acelto", "Acento")
    renombrar("Famuloso", "Fabuloso")


class Migration(migrations.Migration):

    dependencies = [("catalog", "0014_mango_foto_comun")]

    # Volver atrás es editar desde el panel: borrar presentaciones con pedidos
    # no es algo que deba hacer una migración.
    operations = [migrations.RunPython(aplicar, migrations.RunPython.noop)]
