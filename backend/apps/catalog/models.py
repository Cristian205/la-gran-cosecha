from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models, transaction


# ==========================================================================
# 1. CATEGORÍA
# ==========================================================================
class Categoria(models.Model):
    nombre_categoria = models.CharField(max_length=150, unique=True)
    estado_categoria = models.BooleanField(default=True)
    abreviatura = models.CharField(max_length=50)
    orden = models.PositiveIntegerField(default=0)
    imagen = models.ImageField(upload_to="categorias/", blank=True, null=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ui_categoria"
        verbose_name_plural = "Categorías"
        ordering = ["orden", "nombre_categoria"]
        indexes = [
            models.Index(fields=["nombre_categoria"]),
            models.Index(fields=["orden"]),
        ]

    def __str__(self):
        return self.nombre_categoria


# ==========================================================================
# 2. UNIDAD DE MEDIDA
# ==========================================================================
class UnidadMedida(models.Model):
    nombre_unidad = models.CharField(max_length=100, unique=True)
    abreviatura_unidad = models.CharField(max_length=10)
    estado_unidad = models.BooleanField(default=True)

    class Meta:
        db_table = "ui_unidadmedida"
        verbose_name_plural = "Unidades de Medida"
        ordering = ["nombre_unidad"]

    def __str__(self):
        return f"{self.nombre_unidad} ({self.abreviatura_unidad})"


# ==========================================================================
# 3. PRODUCTO
# ==========================================================================
class Producto(models.Model):
    codigo_producto = models.CharField(max_length=50, unique=True, editable=False)
    nombre_producto = models.CharField(max_length=200)

    estado_producto = models.BooleanField(default=True)
    permite_fraccion = models.BooleanField(default=False)

    imagen = models.ImageField(upload_to="productos/", blank=True, null=True)

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
            models.Index(fields=["nombre_producto"]),
            models.Index(fields=["codigo_producto"]),
            models.Index(fields=["orden"]),
        ]

    def __str__(self):
        return f"{self.codigo_producto}-{self.nombre_producto}"

    def save(self, *args, **kwargs):
        # Generación automática de orden y código (lógica original preservada).
        with transaction.atomic():
            if not self.pk:
                ultimo = Producto.objects.all().order_by("-orden").first()
                self.orden = (ultimo.orden + 1) if ultimo else 1

                abrev = self.categoria.abreviatura.upper()
                consecutivo = (
                    Producto.objects.filter(categoria=self.categoria).count() + 1
                )
                nuevo_codigo = f"{abrev}-{consecutivo:03d}"

                while Producto.objects.filter(codigo_producto=nuevo_codigo).exists():
                    consecutivo += 1
                    nuevo_codigo = f"{abrev}-{consecutivo:03d}"

                self.codigo_producto = nuevo_codigo

            super().save(*args, **kwargs)


# ==========================================================================
# 4. PRESENTACIÓN PRODUCTO
# ==========================================================================
class PresentacionProducto(models.Model):
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
class HistorialPrecio(models.Model):
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
