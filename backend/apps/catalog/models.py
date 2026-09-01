from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.utils.text import slugify

from apps.tenancy.almacenamiento import ruta_categoria, ruta_producto
from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# SLUGS
# ==========================================================================
def generar_slug_unico(modelo, texto, tenant_id, excluir_pk=None, maximo=50):
    """
    Slug único dentro del negocio, derivado del nombre.

    Los slugs son por tenant, no globales: dos negocios pueden vender ambos un
    "mango" y cada uno merece /productos/mango. El sufijo numérico solo aparece
    cuando hay choque real dentro del mismo negocio.

    `slugify` puede devolver cadena vacía si el nombre es todo signos o está en
    un alfabeto que no translitera; en ese caso se cae a un identificador
    genérico antes que dejar el campo en blanco y romper la URL.
    """
    base = slugify(texto)[:maximo] or "sin-nombre"
    candidato = base

    # `all_tenants` y no `objects`: aquí el negocio ya viene dado por
    # parámetro, así que filtrar es explícito y no debe depender de que haya un
    # contexto declarado — este código corre también desde una migración.
    hermanos = modelo.all_tenants.filter(tenant=tenant_id)
    if excluir_pk:
        hermanos = hermanos.exclude(pk=excluir_pk)

    sufijo = 2
    while hermanos.filter(slug=candidato).exists():
        candidato = f"{base}-{sufijo}"
        sufijo += 1

    return candidato


# ==========================================================================
# 1. CATEGORÍA
# ==========================================================================
class Categoria(ModeloConTenant):
    # La unicidad pasa a ser (tenant, nombre): dos negocios tienen que poder
    # llamar "Ofertas" a una categoría cada uno. Ver Meta.constraints.
    nombre_categoria = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, blank=True)
    estado_categoria = models.BooleanField(default=True)
    abreviatura = models.CharField(max_length=50)
    orden = models.PositiveIntegerField(default=0)
    imagen = models.ImageField(upload_to=ruta_categoria, blank=True, null=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ui_categoria"
        verbose_name_plural = "Categorías"
        ordering = ["orden", "nombre_categoria"]
        indexes = [
            models.Index(fields=["tenant", "nombre_categoria"], name="ui_categori_tenant_nombre_idx"),
            models.Index(fields=["tenant", "orden"], name="ui_categori_tenant_orden_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "nombre_categoria"], name="catalog_categoria_unica_por_negocio"
            ),
            models.UniqueConstraint(
                fields=["tenant", "slug"], name="catalog_categoria_slug_unico_por_negocio"
            ),
        ]

    def __str__(self):
        return self.nombre_categoria

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = generar_slug_unico(Categoria, self.nombre_categoria, self.tenant_id)
        super().save(*args, **kwargs)


# ==========================================================================
# 2. UNIDAD DE MEDIDA
# ==========================================================================
class UnidadMedida(ModeloConTenant):
    # Sin esto, dos negocios no podrían tener ambos un "Kilogramo".
    nombre_unidad = models.CharField(max_length=100)
    abreviatura_unidad = models.CharField(max_length=10)
    estado_unidad = models.BooleanField(default=True)

    class Meta:
        db_table = "ui_unidadmedida"
        verbose_name_plural = "Unidades de Medida"
        ordering = ["nombre_unidad"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "nombre_unidad"], name="catalog_unidad_unica_por_negocio"
            )
        ]

    def __str__(self):
        return f"{self.nombre_unidad} ({self.abreviatura_unidad})"


# ==========================================================================
# 3. PRODUCTO
# ==========================================================================
class Producto(ModeloConTenant):
    # El código deja de ser único globalmente: cada negocio lleva su propia
    # numeración, así que "FRU-001" existe una vez por negocio.
    codigo_producto = models.CharField(max_length=50, editable=False)
    nombre_producto = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, blank=True)

    estado_producto = models.BooleanField(default=True)
    permite_fraccion = models.BooleanField(default=False)

    # El producto lleva cuenta de sus existencias. Nace en False para TODOS los
    # productos que ya existen: encender el inventario no puede empezar a
    # rechazar pedidos de un catálogo cuyo stock nadie ha cargado todavía. Se
    # activa producto a producto —o de golpe desde el panel— cuando el negocio
    # ya ha contado. Desde la fase 9 el preset propone el valor inicial.
    controla_stock = models.BooleanField(default=False)

    # Lo lee el lector del POS y también la búsqueda del panel. Va en el
    # producto y no en la presentación porque identifica el artículo, no su
    # empaque; el código de la caja de 12, cuando el negocio lo necesite, es un
    # atributo de la presentación.
    codigo_barras = models.CharField(max_length=64, blank=True, db_index=True)

    imagen = models.ImageField(upload_to=ruta_producto, blank=True, null=True)

    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="productos"
    )

    orden = models.PositiveIntegerField(editable=False)

    tipo_cantidad = models.CharField(
        max_length=20,
        choices=[("entero", "Entero"), ("medio", "Medio"), ("cuarto", "Cuartos")],
        default="entero",
    )

    unidad_base = models.ForeignKey(
        UnidadMedida,
        on_delete=models.PROTECT,
        related_name="productos_base",
        null=True,
        blank=True,
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ui_producto"
        ordering = ["orden", "nombre_producto"]
        indexes = [
            models.Index(fields=["tenant", "nombre_producto"], name="ui_producto_tenant_nombre_idx"),
            models.Index(fields=["tenant", "codigo_producto"], name="ui_producto_tenant_codigo_idx"),
            models.Index(fields=["tenant", "orden"], name="ui_producto_tenant_orden_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "codigo_producto"], name="catalog_producto_codigo_unico_por_negocio"
            ),
            models.UniqueConstraint(
                fields=["tenant", "slug"], name="catalog_producto_slug_unico_por_negocio"
            ),
        ]

    def __str__(self):
        return f"{self.codigo_producto}-{self.nombre_producto}"

    def save(self, *args, **kwargs):
        """
        Genera `orden`, `codigo_producto` y `slug` por negocio.

        Cambia respecto al original en dos cosas. La primera es el ámbito: la
        numeración era un barrido global de la tabla, así que el segundo
        negocio habría continuado la cuenta del primero. Ahora cada uno empieza
        en 001.

        La segunda es la carrera. El código original leía el máximo y escribía
        sin bloqueo: dos altas simultáneas en la misma categoría calculaban el
        mismo consecutivo y una de las dos moría contra el índice único. Se
        bloquea la fila de la categoría, que es la granularidad natural del
        contador y no serializa el catálogo entero.
        """
        # Antes que nada: sin tenant no se puede numerar por negocio.
        self.asegurar_tenant()

        with transaction.atomic():
            if not self.pk:
                # `all_tenants` con filtro explícito: la numeración es del
                # negocio de este producto, se declare o no un contexto.
                del_negocio = Producto.all_tenants.filter(tenant=self.tenant_id)

                # Bloquea el contador de esta categoría hasta el commit.
                categoria = Categoria.all_tenants.select_for_update().get(
                    pk=self.categoria_id
                )

                ultimo = del_negocio.order_by("-orden").first()
                self.orden = (ultimo.orden + 1) if ultimo else 1

                abrev = categoria.abreviatura.upper()
                consecutivo = del_negocio.filter(categoria=categoria).count() + 1
                nuevo_codigo = f"{abrev}-{consecutivo:03d}"

                while del_negocio.filter(codigo_producto=nuevo_codigo).exists():
                    consecutivo += 1
                    nuevo_codigo = f"{abrev}-{consecutivo:03d}"

                self.codigo_producto = nuevo_codigo

            if not self.slug:
                self.slug = generar_slug_unico(
                    Producto, self.nombre_producto, self.tenant_id, excluir_pk=self.pk
                )

            super().save(*args, **kwargs)


# ==========================================================================
# 4. PRESENTACIÓN PRODUCTO
# ==========================================================================
class PresentacionProducto(ModeloConTenant):
    tenant_heredado_de = "producto"

    producto = models.ForeignKey(
        Producto, on_delete=models.CASCADE, related_name="presentaciones"
    )
    nombre_presentacion = models.CharField(max_length=200)

    unidad_venta = models.ForeignKey(
        UnidadMedida, on_delete=models.CASCADE, related_name="presentaciones_venta"
    )

    factor_conversion = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=1,
        validators=[MinValueValidator(0.0001)],
    )
    precio_unitario = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(0)]
    )
    unidad_manual = models.CharField(max_length=20, blank=True, null=True)
    estado_presentacion = models.BooleanField(default=True)

    # En qué se diferencia esta presentación de las otras del mismo producto:
    # {"talla": "M", "color": "negro"} en una boutique, {"empaque": "caja 100"}
    # en una ferretería. Es JSON y no una tabla por tipo de negocio porque los
    # ejes los declara el negocio, no el código: crear `ProductoBoutique` con
    # columnas de talla y color obligaría a una migración por cada sector nuevo,
    # que es exactamente lo que esta plataforma no puede permitirse.
    #
    # Quién lo valida: desde la fase 9, el `esquema_atributos` del perfil del
    # negocio. Hasta entonces se guarda libre y solo se muestra.
    #
    # Cuándo dejará de ser JSON: el día que haya que FILTRAR el catálogo público
    # por talla con paginación. Buscar puntualmente dentro de un JSONB va bien;
    # recorrerlos todos para paginar, no. El disparador es esa consulta, no una
    # intuición.
    atributos = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ui_presentacionproducto"
        unique_together = ["producto", "nombre_presentacion", "unidad_venta"]
        indexes = [models.Index(fields=["producto"])]

    def __str__(self):
        return (
            f"{self.producto.nombre_producto} "
            f"({self.nombre_presentacion} x {self.factor_conversion} "
            f"{self.unidad_venta.nombre_unidad}) - ${self.precio_unitario:,.0f}"
        )


# ==========================================================================
# 5. HISTORIAL DE PRECIOS
# ==========================================================================
class HistorialPrecio(ModeloConTenant):
    tenant_heredado_de = "presentacion"

    presentacion = models.ForeignKey(
        PresentacionProducto,
        on_delete=models.CASCADE,
        related_name="historial_precios",
    )
    precio_anterior = models.DecimalField(max_digits=12, decimal_places=2)
    precio_nuevo = models.DecimalField(max_digits=12, decimal_places=2)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    fecha_cambio = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ui_historialprecio"
        ordering = ["-fecha_cambio"]

    def __str__(self):
        return f"{self.presentacion} {self.precio_anterior} → {self.precio_nuevo}"
