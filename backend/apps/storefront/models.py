"""
El motor de tiendas de Crynex.

Una sola aplicación de React sirve todas las tiendas, y lo que las hace
distintas son datos: qué bloques lleva cada página, en qué orden y con qué
propiedades. Nada de esto genera código ni lo guarda; el JSON solo NOMBRA
componentes que ya existen en el frontend.

Esa es la frontera y conviene decirla claro, porque es lo que separa un motor
mantenible de un constructor que acaba siendo imposible de rediseñar:

* En CÓDIGO viven los bloques (componentes React), lo que hacen, cómo piden sus
  datos y cómo se ven. Cambiarlos es un despliegue, y debe serlo.
* En DATOS viven la composición (qué bloques y en qué orden), sus propiedades y
  el tema. Cambiarlos es una edición en el panel.

Los cinco modelos, en dos niveles:

    Nivel plataforma — lo administra Crynex
      Bloque     el catálogo de lo que se puede colocar
      Tema       preajustes visuales reutilizables
      Plantilla  una composición inicial por sector

    Nivel negocio — lo edita cada cliente
      Pagina         una ruta de su tienda
      VersionPagina  cada estado guardado de esa página

Lo que NO está aquí, y a propósito: el catálogo, los pedidos y los precios.
Un bloque de productos no guarda productos, los pide. El motor decide qué se
ve y dónde; de qué se llena sigue siendo trabajo de las apps de negocio.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.tenancy.models import ModeloConTenant


# ==========================================================================
# NIVEL PLATAFORMA — el catálogo de Crynex
# ==========================================================================
class Bloque(models.Model):
    """
    Una pieza que se puede colocar en una página.

    Es la declaración de un componente que YA existe en el frontend, no su
    definición: `codigo` es la llave del registro de React. Una fila sin
    componente detrás no pinta nada —el lienzo la salta— y un componente sin
    fila no se puede colocar desde el panel. Están así de atados a propósito:
    la alternativa es guardar marcado en la base de datos, y entonces
    rediseñar la tienda deja de ser posible.

    `esquema_props` es un JSON Schema y sirve para tres cosas a la vez: valida
    en el servidor, dibuja el panel de propiedades del constructor y documenta
    el bloque. Tenerlo en un sitio solo es lo que evita que las tres versiones
    se separen.
    """

    class Categoria(models.TextChoices):
        ESTRUCTURA = "ESTRUCTURA", "Estructura"
        CONTENIDO = "CONTENIDO", "Contenido"
        CATALOGO = "CATALOGO", "Catálogo"
        PRUEBA_SOCIAL = "PRUEBA_SOCIAL", "Prueba social"
        CONVERSION = "CONVERSION", "Conversión"

    codigo = models.SlugField(
        max_length=60, unique=True, help_text="La llave del registro de React."
    )
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)
    categoria = models.CharField(
        max_length=20, choices=Categoria.choices, default=Categoria.CONTENIDO
    )
    icono = models.CharField(max_length=40, blank=True)

    esquema_props = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON Schema de las propiedades que acepta.",
    )
    variantes = models.JSONField(
        default=list,
        blank=True,
        help_text='Aspectos disponibles: [{"codigo": "rejilla-4", "nombre": "Rejilla"}]',
    )

    #: El bloque necesita datos del servidor antes de pintarse. Los que lo
    #: declaran se resuelven en el render del servidor de Next: si se dejaran
    #: al navegador, el rastreador vería un hueco donde va el contenido y se
    #: perdería el posicionamiento que la tienda ya tiene ganado.
    requiere_datos = models.BooleanField(default=False)

    #: Un bloque único no se puede repetir en la misma página (una cabecera,
    #: un pie). Sin esto, dos pies serían un JSON válido.
    unico_por_pagina = models.BooleanField(default=False)

    #: Ocupa el ancho de la ventana en vez de ir dentro del contenedor. Lo
    #: declara el bloque y no la página porque es una propiedad de cómo está
    #: hecho: un carrusel a sangre lo es en el primer puesto y en el quinto. Si
    #: lo decidiera la posición, reordenar en el constructor sacaría bloques de
    #: los márgenes sin que nadie lo pidiera.
    a_sangre = models.BooleanField(default=False)

    activo = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "storefront_bloque"
        verbose_name = "Bloque"
        verbose_name_plural = "Bloques"
        ordering = ["categoria", "orden", "nombre"]

    def __str__(self):
        return self.nombre

    def codigos_de_variante(self) -> set[str]:
        return {
            v.get("codigo")
            for v in (self.variantes or [])
            if isinstance(v, dict) and v.get("codigo")
        }


class Tema(models.Model):
    """
    Un preajuste visual reutilizable.

    NO es donde vive el tema de un negocio: eso sigue en `StoreSettings`, que
    ya lo resuelve en el servidor y sin parpadeo. Este modelo es la galería —
    "Fresco", "Sobrio", "Nocturno"— y aplicarlo COPIA sus valores a la
    configuración del negocio.

    Copiar y no referenciar es deliberado: si un negocio apuntara a este tema,
    que Crynex retocara "Fresco" le cambiaría los colores de la tienda a
    cuarenta clientes sin avisar.
    """

    slug = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)

    #: Las mismas claves que `StoreSettings`: color_primario, fuente,
    #: radio_boton… Se guardan como JSON porque el preajuste es una propuesta,
    #: no una fila que deba tener todas las columnas.
    valores = models.JSONField(default=dict, blank=True)

    activo = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "storefront_tema"
        verbose_name = "Tema"
        verbose_name_plural = "Temas"
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre


class TokenTema(models.Model):
    """
    Una perilla del aspecto de la tienda.

    Es al tema lo que `TipoLimite` es a los planes: el catálogo de lo que se
    puede ajustar, en filas. Añadir «color del pie» o «grosor de los títulos»
    deja de ser una migración y pasa a ser un alta.

    `variable_css` es el contrato con la hoja de estilos de la tienda. Un token
    cuya variable nadie consume se puede configurar y no cambia nada, así que
    crear uno aquí obliga a usarlo allí — igual que un bloque obliga a tener su
    componente. Es la misma frontera: los datos nombran, el código pinta.
    """

    class Grupo(models.TextChoices):
        MARCA = "MARCA", "Marca"
        NAVEGACION = "NAVEGACION", "Navegación"
        TIPOGRAFIA = "TIPOGRAFIA", "Tipografía"
        SUPERFICIE = "SUPERFICIE", "Superficies"
        FORMA = "FORMA", "Formas y espacios"

    class Tipo(models.TextChoices):
        COLOR = "COLOR", "Color"
        MEDIDA = "MEDIDA", "Medida"
        NUMERO = "NUMERO", "Número"
        OPCION = "OPCION", "Opción"
        TEXTO = "TEXTO", "Texto"

    codigo = models.SlugField(max_length=60, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)
    grupo = models.CharField(max_length=20, choices=Grupo.choices, default=Grupo.MARCA)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.COLOR)

    variable_css = models.CharField(
        max_length=60, help_text="La variable que la tienda lee: --navbar-fondo."
    )
    valor_por_defecto = models.CharField(max_length=120, blank=True)
    #: Para `OPCION` y para acotar `MEDIDA`: [{"valor": "1.1", "nombre": "Grande"}]
    opciones = models.JSONField(default=list, blank=True)
    #: Unidad que se añade al guardar una medida suelta: px, rem, %…
    unidad = models.CharField(max_length=8, blank=True)

    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "storefront_tokentema"
        verbose_name = "Token de tema"
        verbose_name_plural = "Tokens de tema"
        ordering = ["grupo", "orden", "nombre"]

    def __str__(self):
        return self.nombre


class Plantilla(models.Model):
    """
    Una tienda de arranque para un sector.

    "Mercado", "Boutique", "Restaurante": cada una trae la composición inicial
    de sus páginas y el tema que le pega. Adoptarla COPIA esa composición al
    borrador del negocio.

    Otra vez copiar y no referenciar, y aquí importa todavía más: si `Pagina`
    apuntara a la plantilla, que Crynex editara "Mercado" reescribiría en
    silencio la tienda PUBLICADA de todos los clientes que la usan. Una tienda
    en producción no puede cambiar sola.
    """

    slug = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=255, blank=True)
    sector = models.CharField(
        max_length=60, blank=True, help_text="Alimentos, Moda, Restaurante…"
    )
    vista_previa = models.URLField(blank=True)

    tema = models.ForeignKey(
        Tema, on_delete=models.SET_NULL, null=True, blank=True, related_name="plantillas"
    )
    #: {"/": [bloque, ...], "/nosotros": [...]}. Es el molde que se copia.
    paginas = models.JSONField(default=dict, blank=True)

    #: El aspecto que propone, por código de `TokenTema`. Es lo mismo que
    #: guarda un `Tema`, pero escrito en la propia plantilla: la mayoría nacen
    #: con un aspecto propio y obligar a crear un preajuste aparte para cada
    #: una sería un rodeo. El `tema` de arriba sigue sirviendo para compartir
    #: una paleta entre varias.
    tema_valores = models.JSONField(default=dict, blank=True)

    activa = models.BooleanField(default=True)
    es_predeterminada = models.BooleanField(default=False)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "storefront_plantilla"
        verbose_name = "Plantilla"
        verbose_name_plural = "Plantillas"
        ordering = ["orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["es_predeterminada"],
                condition=models.Q(es_predeterminada=True),
                name="storefront_una_sola_plantilla_por_defecto",
            )
        ]

    def __str__(self):
        return self.nombre


# ==========================================================================
# NIVEL NEGOCIO — la tienda de cada cliente
# ==========================================================================
class Pagina(ModeloConTenant):
    """
    Una ruta de la tienda de un negocio.

    La página es la identidad —qué ruta, de qué tipo, con qué SEO—; lo que se
    ve dentro vive en sus versiones. Separarlo es lo que permite tener un
    borrador y una publicada a la vez sin duplicar la ruta.

    `tipo` no es decorativo: le dice al frontend qué contexto tiene disponible.
    Una página de PRODUCTO puede llevar bloques que hablen del producto actual;
    la HOME, no.
    """

    class Tipo(models.TextChoices):
        HOME = "HOME", "Inicio"
        CATALOGO = "CATALOGO", "Catálogo"
        PRODUCTO = "PRODUCTO", "Ficha de producto"
        CATEGORIA = "CATEGORIA", "Categoría"
        LIBRE = "LIBRE", "Página libre"

    ruta = models.CharField(
        max_length=120, help_text="Empieza por /. La home es exactamente «/»."
    )
    titulo = models.CharField(max_length=120)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.LIBRE)

    seo_titulo = models.CharField(max_length=160, blank=True)
    seo_descripcion = models.CharField(max_length=255, blank=True)

    #: Una página apagada responde 404. Se conserva por si vuelve.
    activa = models.BooleanField(default=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "storefront_pagina"
        verbose_name = "Página"
        verbose_name_plural = "Páginas"
        ordering = ["ruta"]
        constraints = [
            # Por negocio, no global: dos tiendas distintas tienen cada una su
            # "/nosotros" y no se estorban.
            models.UniqueConstraint(
                fields=["tenant", "ruta"], name="storefront_una_ruta_por_negocio"
            )
        ]

    def __str__(self):
        return f"{self.ruta} · {self.tenant}"

    def clean(self):
        super().clean()
        if not self.ruta.startswith("/"):
            raise ValidationError({"ruta": "Debe empezar por /."})

    @property
    def publicada(self):
        return self.versiones.filter(estado=VersionPagina.Estado.PUBLICADA).first()

    @property
    def borrador(self):
        return self.versiones.filter(estado=VersionPagina.Estado.BORRADOR).first()


class VersionPagina(ModeloConTenant):
    """
    Un estado guardado de una página.

    Hay como mucho un borrador y una publicada a la vez; el resto son
    archivadas, que es el historial. Publicar archiva la anterior y asciende el
    borrador; restaurar copia una archivada al borrador y NUNCA reescribe la
    publicada — deshacer no puede cambiar lo que los visitantes están viendo
    sin que alguien lo confirme.

    La composición es un snapshot completo y no un montón de referencias: una
    versión de hace tres meses tiene que poder pintarse tal como era, aunque
    desde entonces se hayan retocado la plantilla y el tema. Es el mismo
    criterio que en facturación, y por la misma razón.
    """

    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        PUBLICADA = "PUBLICADA", "Publicada"
        ARCHIVADA = "ARCHIVADA", "Archivada"

    pagina = models.ForeignKey(
        Pagina, on_delete=models.CASCADE, related_name="versiones"
    )
    numero = models.PositiveIntegerField(default=1)
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.BORRADOR
    )

    #: La lista de bloques, en orden. Cada uno:
    #: {"id": "b1", "tipo": "productos-destacados", "variante": "rejilla-4",
    #:  "props": {...}, "visible": {"movil": true, "tablet": true, "escritorio": true}}
    composicion = models.JSONField(default=list, blank=True)

    nota = models.CharField(max_length=200, blank=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="versiones_de_pagina",
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_publicacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "storefront_versionpagina"
        verbose_name = "Versión de página"
        verbose_name_plural = "Versiones de página"
        ordering = ["-numero"]
        constraints = [
            models.UniqueConstraint(
                fields=["pagina", "numero"], name="storefront_un_numero_por_pagina"
            ),
            # Dos publicadas dejarían qué ve el visitante a suerte del orden de
            # la consulta; dos borradores, a suerte de cuál abre el editor.
            models.UniqueConstraint(
                fields=["pagina"],
                condition=models.Q(estado="PUBLICADA"),
                name="storefront_una_sola_publicada",
            ),
            models.UniqueConstraint(
                fields=["pagina"],
                condition=models.Q(estado="BORRADOR"),
                name="storefront_un_solo_borrador",
            ),
        ]

    def __str__(self):
        return f"{self.pagina.ruta} v{self.numero} ({self.get_estado_display()})"
