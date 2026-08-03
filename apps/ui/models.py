import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db import models, transaction
from django.db.models import Sum
from django.core.validators import MinValueValidator
from decimal import Decimal


# ==========================
# 1. CATEGORÍA
# ==========================

class Categoria(models.Model):

    nombre_categoria = models.CharField(max_length=150, unique=True)
    estado_categoria = models.BooleanField(default=True)
    abreviatura = models.CharField(max_length=50)

    # 🔥 NUEVO CAMPO
    orden = models.PositiveIntegerField(default=0)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Categorías"

        # 🔥 CAMBIO CLAVE
        ordering = ["orden", "nombre_categoria"]

        indexes = [
            models.Index(fields=["nombre_categoria"]),
            models.Index(fields=["orden"]),
        ]

    def __str__(self):
        return self.nombre_categoria 


# ==========================
# 2. UNIDAD DE MEDIDA
# ==========================

class UnidadMedida(models.Model):

    nombre_unidad = models.CharField(max_length=100, unique=True)
    abreviatura_unidad = models.CharField(max_length=10)
    estado_unidad = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Unidades de Medida"
        ordering = ["nombre_unidad"]

    def __str__(self):
        return f"{self.nombre_unidad} ({self.abreviatura_unidad})"


# ==========================
# 3. PRODUCTO
# ==========================

class Producto(models.Model):

    codigo_producto = models.CharField(max_length=50, unique=True, editable=False)
    nombre_producto = models.CharField(max_length=200)

    estado_producto = models.BooleanField(default=True)
    permite_fraccion = models.BooleanField(default=False)
    
    imagen = models.ImageField(
        upload_to="productos/",
        blank=True,
        null=True
    )

    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="productos"
    )

    orden = models.PositiveIntegerField(editable=False)

    tipo_cantidad = models.CharField(
        max_length=20,
        choices=[
            ("entero","Entero"),
            ("medio","Medio"),
            ("cuarto","Cuartos")
        ],
        default="entero"
    )

    unidad_base = models.ForeignKey(
        UnidadMedida,
        on_delete=models.PROTECT,
        related_name="productos_base",
        null=True,
        blank=True
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        # 🔥 CAMBIO CLAVE
        ordering = ["orden", "nombre_producto"]

        indexes = [
            models.Index(fields=["nombre_producto"]),
            models.Index(fields=["codigo_producto"]),
            models.Index(fields=["orden"]),  # mejora rendimiento
        ]

    def __str__(self):
        return f"{self.codigo_producto}-{self.nombre_producto}"
    
    def save(self, *arg, **kwargs):
        #Usamos una transacción atómica para evitar errores de duplicidad en concurrencia
        with transaction.atomic():
            if not self.pk: #Solamente al crear un producto nuevo
                #1. Generar orden automatico
                #Buscamos el número más alto de 'orden' actualmente
                
                ultimo_producto_creado = Producto.objects.all().order_by("-orden").first()
                if ultimo_producto_creado:
                    self.orden = ultimo_producto_creado.orden + 1
                else:
                    self.orden = 1 #Si es el primero 
                    
                #2. Generar Código Automático
                # Obtenemos la abreviatura de la categoria (en mayúsculas)
                abrev = self.categoria.abreviatura.upper()
                
                #Contamos cuántos productos existen ya en esa categoría para el consecutivo
                consecutivo = Producto.objects.filter(categoria=self.categoria).count() + 1
                
                #Formateamos el código: ABREV-001, ABREV-002.
                #El :03d asegura que siempre tenga 3 digitos (001,010,100)
                nuevo_codigo = f"{abrev}-{consecutivo:03d}"
                
                #Verificación de seguridad por si acaso el conteo falla por borrados previos
                while Producto.objects.filter(codigo_producto=nuevo_codigo).exists():
                    consecutivo += 1
                    nuevo_codigo = f"{abrev}-{consecutivo:03d}"
                    
                self.codigo_producto = nuevo_codigo
                
            super().save(*arg, **kwargs)
                
# ==========================
# 4. PRESENTACION PRODUCTO
# ==========================

class PresentacionProducto(models.Model):

    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name="presentaciones"
    )

    nombre_presentacion = models.CharField(max_length=200)

    unidad_venta = models.ForeignKey(
        UnidadMedida,
        on_delete=models.CASCADE,
        related_name="presentaciones_venta"
    )

    factor_conversion = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=1,
        validators=[MinValueValidator(0.0001)]
    )

    precio_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    unidad_manual = models.CharField(max_length=20, blank=True, null=True)

    estado_presentacion = models.BooleanField(default=True)

    class Meta:
        unique_together = ["producto", "nombre_presentacion", "unidad_venta"]
        indexes = [
            models.Index(fields=["producto"]),
        ]

    def __str__(self):
        # Esto mostrará en los selectores: "Papa Sabanera (Bulto x 50.0 kg) - $ 120.000"
        return f"{self.producto.nombre_producto} ({self.nombre_presentacion} x {self.factor_conversion} {self.unidad_venta.nombre_unidad}) - ${self.precio_unitario:,.0f}"


# ==========================
# 5. CLIENTE
# ==========================

class Cliente(models.Model):

    nombre_cliente = models.CharField(max_length=200, unique=True)
    telefono_cliente = models.CharField(max_length=25)
    direccion_cliente = models.TextField()

    fecha_registro_cliente = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre_cliente"]

    def __str__(self):
        return self.nombre_cliente


# ==========================
# 6. USUARIO DEL SISTEMA
# ==========================
class UsuarioManager(BaseUserManager):
    def _create_user(self, email_usuario, nombre_usuario, password, is_staff, is_superuser, **extra_fields):
        if not email_usuario:
            raise ValueError('El email es obligatorio.')
        email_usuario = self.normalize_email(email_usuario)
        user = self.model(
            email_usuario=email_usuario,
            nombre_usuario=nombre_usuario,
            is_staff=is_staff,
            is_active=True,
            is_superuser=is_superuser,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email_usuario, nombre_usuario, password=None, **extra_fields):
        return self._create_user(email_usuario, nombre_usuario, password, False, False, **extra_fields)

    def create_superuser(self, email_usuario, nombre_usuario, password=None, **extra_fields):
        return self._create_user(email_usuario, nombre_usuario, password, True, True, **extra_fields)

class Usuario(AbstractBaseUser, PermissionsMixin):
    ROLES = [
        ("ADMIN", "Administrador de Sede"),
        ("ANALISTA", "Analista de Inventario/Pedidos"),
        ("GERENTE", "Gerente General"),
    ]

    # Identificación Única
    uid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    nombre_usuario = models.CharField("Nombre Completo", max_length=150)
    email_usuario = models.EmailField("Correo Electrónico", unique=True)
    rol_usuario = models.CharField("Rol en el Sistema", max_length=20, choices=ROLES, default="ANALISTA")
    
    # Estados de Django Auth
    is_active = models.BooleanField("Cuenta Activa", default=True)
    is_staff = models.BooleanField("Acceso al Staff", default=False)
    
    # --- Robustez y Seguridad ---
    intentos_fallidos = models.PositiveIntegerField(default=0)
    ultima_ip = models.GenericIPAddressField(null=True, blank=True)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)
    
    # OTP (Verificación de Identidad)
    token_verificacion = models.CharField(max_length=255, null=True, blank=True)
    token_expiracion = models.DateTimeField(null=True, blank=True)
    
    # Auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_modificacion = models.DateTimeField(auto_now=True)
    ultimo_login_exitoso = models.DateTimeField(null=True, blank=True)

    # --- Solución a los errores de "clashes" ---
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='usuario_custom_set',
        blank=True,
        verbose_name='grupos'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='usuario_custom_permissions_set',
        blank=True,
        verbose_name='permisos de usuario'
    )

    objects = UsuarioManager()

    USERNAME_FIELD = 'email_usuario'
    REQUIRED_FIELDS = ['nombre_usuario']

    class Meta:
        verbose_name = "Usuario de Sistema"
        verbose_name_plural = "Usuarios del Fruver"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.nombre_usuario} ({self.rol_usuario})"

    # Lógica de Seguridad
    def esta_bloqueado(self):
        if self.bloqueado_hasta and timezone.now() < self.bloqueado_hasta:
            return True
        return False

    def es_token_valido(self, token):
        if self.token_verificacion == token and self.token_expiracion:
            return timezone.now() < self.token_expiracion
        return False
# ==========================
# 7. PEDIDO
# ==========================

class Pedido(models.Model):

    ESTADOS = [
        ("PENDIENTE", "Pendiente"),
        ("EDITADO", "Editado"),
        ("CERRADO", "Cerrado"),
        ("ENTREGADO", "Entregado"),
        ("IMPRESO", "Impreso"),
    ]

    fecha_pedido = models.DateTimeField(auto_now_add=True)

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name="pedidos",
        null=True,
        blank=True
    )

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name="pedidos_realizados",
        null=True,   # <--- IMPORTANTE: Permite que la DB acepte valores nulos
        blank=True   # <--- IMPORTANTE: Permite que los formularios lo dejen vacío
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADOS,
        default="PENDIENTE"
    )

    total_pedido = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    observaciones = models.TextField(blank=True, null=True)
    
    fecha_modificacion = models.DateTimeField(
        auto_now=True,
        null=True,
        blank=True
    )
    editado_por = models.ForeignKey(
        Usuario,
        null=True,
        blank=True,
        on_delete=models. PROTECT,
        related_name="pedidos_editados"
    )

    class Meta:
        ordering = ["fecha_pedido"]
        
    def actualizar_total(self):
        total = self.detalles.aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        self.total_pedido = total
        self.save(update_fields=['total_pedido'])

    def __str__(self):
        # La técnica del "Acceso Seguro"
        nombre = self.cliente.nombre_cliente if self.cliente else "Registro Corrupto"
        return f"Pedido #{self.id} - {nombre}"


# ==========================
# 8. DETALLE PEDIDO
# ==========================

class DetallePedido(models.Model):
    pedido = models.ForeignKey(
        "Pedido",
        on_delete=models.CASCADE,
        related_name="detalles"
    )

    presentacion = models.ForeignKey(
        "PresentacionProducto",
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )

    unidad_personalizada = models.ForeignKey(
        "UnidadMedida",
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )

    nombre_personalizado = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    cantidad = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    precio_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00")
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        editable=False,
        default=Decimal("0.00")
    )

    es_catalogo = models.BooleanField(default=False)

    categoria_manual = models.ForeignKey(
        "Categoria",
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    fecha_modificacion = models.DateTimeField(auto_now=True)

    modificado_por = models.ForeignKey(
        "Usuario",
        null=True,
        blank=True,
        on_delete=models.PROTECT
    )

    fue_modificado = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Detalle de Pedido"
        verbose_name_plural = "Detalles de Pedidos"
        indexes = [
            models.Index(fields=["pedido"]),
        ]

    # -------------------------
    # VALIDACIONES
    # -------------------------
    def clean(self):
        super().clean()

        if not self.presentacion and not self.nombre_personalizado:
            raise ValidationError(
                "Debes seleccionar un producto o escribir uno personalizado."
            )

        if self.presentacion and self.nombre_personalizado:
            raise ValidationError(
                "No puedes mezclar producto de catálogo con personalizado."
            )

        if self.cantidad <= 0:
            raise ValidationError(
                "La cantidad debe ser mayor a 0."
            )

    # -------------------------
    # CÁLCULO SUBTOTAL
    # -------------------------
    def calcular_subtotal(self):
        return (self.cantidad or Decimal("0")) * (
            self.precio_unitario or Decimal("0")
        )

    # -------------------------
    # SAVE LIMPIO
    # -------------------------
    def save(self, *args, **kwargs):
        self.full_clean()  # ejecuta clean()

        # Si viene de catálogo, toma precio automático
        if self.pk is None and self.presentacion:
            self.precio_unitario = self.presentacion.precio_unitario

        self.subtotal = self.calcular_subtotal()

        super().save(*args, **kwargs)

    # -------------------------
    # STRING REPRESENTATION
    # -------------------------
    def __str__(self):
        if self.presentacion:
            return f"{self.cantidad} x {self.presentacion.producto.nombre_producto}"
        return f"{self.cantidad} x {self.nombre_personalizado} (Manual)"
    
class HistorialDetallePedido(models.Model):

    detalle = models.ForeignKey(
        DetallePedido,
        on_delete=models.CASCADE,
        related_name='historial'
    )

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT
    )

    fecha = models.DateTimeField(
        auto_now_add=True
    )

    campo = models.CharField(max_length=100)

    valor_anterior = models.TextField()

    valor_nuevo = models.TextField()

    motivo = models.TextField(
        null=True,
        blank=True
)
    
class HistorialPrecio(models.Model):

    presentacion = models.ForeignKey(
        'PresentacionProducto',
        on_delete=models.CASCADE,
        related_name='historial_precios'
    )

    precio_anterior = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    precio_nuevo = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE
    )

    fecha_cambio = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['-fecha_cambio']

    def __str__(self):
        return (
            f"{self.presentacion} "
            f"{self.precio_anterior} → "
            f"{self.precio_nuevo}"
        )
        
        
class DetallePedidoManual(models.Model):
    pedido=models.ForeignKey(
        Pedido, 
        on_delete=models.CASCADE,
        related_name= "detalle_manual"
    )
    
    descripcion = models.CharField(
        max_length=300
    )
    cantidad =models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    unidad = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )
    detalle_adicional = models.TextField(
        blank=True,
        null=True
    )
    estado = models.CharField(
        max_length=20,
        choices=[
            ('PENDIENTE','Pendiente'),
            ('CONVERTIDO','Convertido a catálogo'),
            ('DESCARTADO', 'Descartado'),
        ],
        default='PENDIENTE'
    )
    producto_catalogo = models.ForeignKey(
        Producto,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='productos_convertidos'
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )
    
    def __str__(self):
        return self.descripcion
    
    
class CategoriaMultimedia(models.Model):
    nombreCategoria = models.CharField(
        max_length=100,
        unique=True
    )
    icono = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )
    estado = models.BooleanField(
        default=True
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )
    
    def __str__(self):
        return self.nombreCategoria
    
    
class BibliotecaMultimedia(models.Model):

    TIPOS = (
        ('IMG', 'Imagen'),
        ('MP4', 'Video'),
        ('PDF', 'PDF'),
        ('DOCX', 'Word'),
    )

    titulo = models.CharField(
        max_length=250
    )

    categoriaMultimedia = models.ForeignKey(
        CategoriaMultimedia,
        on_delete=models.CASCADE,
        related_name='archivos'
    )

    archivo = models.FileField(
        upload_to='biblioteca/%Y/%m'
    )

    miniatura = models.ImageField(
        upload_to='biblioteca/thumbs',
        blank=True,
        null=True
    )

    tipo = models.CharField(
        max_length=10,
        choices=TIPOS
    )

    observacion = models.TextField(
        blank=True,
        null=True
    )

    activo = models.BooleanField(
        default=True
    )

    orden = models.PositiveIntegerField(
        default=0
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    fecha_actualizacion = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ['orden', '-fecha_creacion']

    def __str__(self):
        return self.titulo
    
class ProductoMultimedia(models.Model):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.CASCADE,
        related_name='multimedia'
    )
    archivo = models.ForeignKey(
        BibliotecaMultimedia,
        on_delete=models.CASCADE,
    )
    principal = models.BooleanField(
        default=False
    )
    orden = models.PositiveIntegerField(
        default=0
    )
class BannerPublicitario(models.Model):
    titulo_banner= models.CharField(
        max_length=200
    )
    imagen= models.ForeignKey(
        BibliotecaMultimedia,
        on_delete=models.PROTECT
    )
    enlace = models.URLField(
        blank=True,
        null=True
    )
    orden = models.PositiveIntegerField(
        default=0
    )
    activo = models.BooleanField(
        default=True
    )
    fecha_inicio = models.DateField(
        blank=True,
        null=True
    )
    fecha_fin = models.DateField(
        blank=True,
        null=True
    )
