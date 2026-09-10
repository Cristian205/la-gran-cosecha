from rest_framework import serializers

from .composicion import para_la_tienda, validar
from .models import Bloque, Pagina, Plantilla, Tema, TokenTema, VersionPagina


class BloqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bloque
        fields = [
            "id", "codigo", "nombre", "descripcion", "categoria", "icono",
            "esquema_props", "variantes", "requiere_datos", "unico_por_pagina",
            # Con esto el editor dibuja la pestaña de diseño del bloque, igual
            # que dibuja la de contenido con `esquema_props`.
            "tokens_admitidos",
            "a_sangre", "activo", "orden",
        ]


class TokenTemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TokenTema
        fields = [
            "id", "codigo", "nombre", "descripcion", "grupo", "tipo",
            "variable_css", "valor_por_defecto", "opciones", "unidad",
            "orden", "activo",
        ]


class TemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tema
        fields = ["id", "slug", "nombre", "descripcion", "valores", "activo", "orden"]


class PlantillaSerializer(serializers.ModelSerializer):
    tema_nombre = serializers.CharField(source="tema.nombre", read_only=True)

    class Meta:
        model = Plantilla
        fields = [
            "id", "slug", "nombre", "descripcion", "sector", "vista_previa",
            "tema", "tema_nombre", "tema_valores", "marca", "paginas", "activa",
            "es_predeterminada", "orden",
        ]

    def validate_marca(self, valor):
        """
        Solo las claves del catalogo. Sin esto, un JSON editable desde el panel
        de Crynex seria escritura arbitraria sobre la configuracion de cada
        negocio que adopte la plantilla: `aplicar_aspecto` hace `setattr`.
        """
        from .aspecto import limpiar_marca  # noqa: PLC0415

        if not isinstance(valor, dict):
            raise serializers.ValidationError("Debe ser un objeto.")
        return limpiar_marca(valor)

    def validate_paginas(self, valor):
        if not isinstance(valor, dict):
            raise serializers.ValidationError("Debe ser un objeto de ruta → bloques.")
        # Se valida cada composición al guardar la plantilla y no al adoptarla:
        # descubrir que el molde estaba roto cuando un cliente lo aplica es
        # descubrirlo en el peor momento.
        return {ruta: validar(bloques) for ruta, bloques in valor.items()}


class VersionPaginaSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.CharField(
        source="autor.nombre_usuario", read_only=True, default=""
    )

    class Meta:
        model = VersionPagina
        fields = [
            "id", "numero", "estado", "composicion", "nota", "autor_nombre",
            "fecha_creacion", "fecha_publicacion",
        ]
        read_only_fields = ["numero", "estado", "fecha_creacion", "fecha_publicacion"]

    def validate_composicion(self, valor):
        return validar(valor)


class PaginaSerializer(serializers.ModelSerializer):
    """La página con el estado de sus dos versiones vivas, no con todas."""

    tiene_borrador = serializers.SerializerMethodField()
    version_publicada = serializers.SerializerMethodField()
    bloques_publicados = serializers.SerializerMethodField()

    class Meta:
        model = Pagina
        fields = [
            "id", "ruta", "titulo", "tipo", "seo_titulo", "seo_descripcion",
            "activa", "tiene_borrador", "version_publicada", "bloques_publicados",
            "fecha_actualizacion",
        ]

    def get_tiene_borrador(self, obj):
        return obj.borrador is not None

    def get_version_publicada(self, obj):
        publicada = obj.publicada
        return publicada.numero if publicada else None

    def get_bloques_publicados(self, obj):
        """Cuántos bloques tiene en vivo: el dato que dice si está en pie."""
        publicada = obj.publicada
        return len(publicada.composicion) if publicada else 0


class PaginaPublicaSerializer(serializers.ModelSerializer):
    """
    Lo que la tienda necesita para pintarse, y nada más.

    No lleva ni versiones ni historial: es la respuesta que pide cada visitante
    y viaja en el HTML del servidor de Next.
    """

    bloques = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()

    class Meta:
        model = Pagina
        fields = ["ruta", "titulo", "tipo", "seo_titulo", "seo_descripcion",
                  "bloques", "version"]

    def _version(self, obj):
        # El borrador solo se sirve a quien puede editarlo; la vista lo decide
        # y lo deja en el contexto.
        if self.context.get("borrador"):
            return obj.borrador or obj.publicada
        return obj.publicada

    def get_bloques(self, obj):
        """
        La composición, más lo que el catálogo sabe de cada bloque.

        El enriquecido vive en `composicion.para_la_tienda` y no aquí porque el
        enlace de prueba de una plantilla lo necesita igual, y tenerlo escrito
        dos veces era justo por donde se coló que en la previa faltara
        `a_sangre`.
        """
        version = self._version(obj)
        if version is None:
            return []
        return para_la_tienda(version.composicion)

    def get_version(self, obj):
        version = self._version(obj)
        return {"numero": version.numero, "estado": version.estado} if version else None


class AdoptarPlantillaSerializer(serializers.Serializer):
    plantilla = serializers.SlugField()
    #: Aplicar también el tema reescribe los colores del negocio, así que se
    #: pide explícitamente en vez de venir de regalo.
    aplicar_tema = serializers.BooleanField(default=False)
    publicar = serializers.BooleanField(default=False)

    def validate_plantilla(self, valor):
        if not Plantilla.objects.filter(slug=valor, activa=True).exists():
            raise serializers.ValidationError("No existe esa plantilla.")
        return valor
