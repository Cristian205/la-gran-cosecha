from PIL import Image
from rest_framework import serializers

from .models import Archivo

# content_type permitido -> (tipo derivado, límite en MB)
TIPOS_PERMITIDOS = {
    "image/jpeg": ("IMAGEN", 5),
    "image/png": ("IMAGEN", 5),
    "image/webp": ("IMAGEN", 5),
    "image/gif": ("IMAGEN", 5),
    "image/svg+xml": ("IMAGEN", 5),
    "video/mp4": ("VIDEO", 50),
    "video/webm": ("VIDEO", 50),
    "video/quicktime": ("VIDEO", 50),
    "application/pdf": ("DOCUMENTO", 15),
}


class ArchivoSerializer(serializers.ModelSerializer):
    """
    Sube un archivo derivando tipo/content_type/tamaño/dimensiones del propio
    `UploadedFile` — el cliente solo manda `archivo` y, opcionalmente,
    `nombre_original`.
    """

    url = serializers.SerializerMethodField()
    subido_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Archivo
        fields = [
            "id",
            "url",
            "archivo",
            "nombre_original",
            "tipo",
            "content_type",
            "tamano",
            "ancho",
            "alto",
            "fecha_creacion",
            "subido_por_nombre",
        ]
        extra_kwargs = {
            "archivo": {"write_only": True},
            "nombre_original": {"required": False},
        }
        read_only_fields = ["tipo", "content_type", "tamano", "ancho", "alto"]

    def get_url(self, obj):
        if not obj.archivo:
            return None
        request = self.context.get("request")
        url = obj.archivo.url
        return request.build_absolute_uri(url) if request else url

    def get_subido_por_nombre(self, obj):
        return obj.subido_por.nombre_usuario if obj.subido_por else ""

    def validate_archivo(self, value):
        info = TIPOS_PERMITIDOS.get(value.content_type)
        if not info:
            raise serializers.ValidationError(
                "Formato no permitido. Usa una imagen, video o PDF soportado."
            )
        _, limite_mb = info
        if value.size > limite_mb * 1024 * 1024:
            raise serializers.ValidationError(
                f"El archivo supera el límite de {limite_mb}MB para este tipo."
            )
        return value

    def create(self, validated_data):
        archivo = validated_data["archivo"]
        tipo, _ = TIPOS_PERMITIDOS[archivo.content_type]

        validated_data.setdefault("nombre_original", archivo.name)
        validated_data["tipo"] = tipo
        validated_data["content_type"] = archivo.content_type
        validated_data["tamano"] = archivo.size

        if tipo == "IMAGEN" and archivo.content_type != "image/svg+xml":
            try:
                with Image.open(archivo) as img:
                    validated_data["ancho"], validated_data["alto"] = img.size
            except Exception:  # noqa: BLE001 — no bloquea la subida si Pillow no puede leerla
                pass
            archivo.seek(0)

        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["subido_por"] = request.user

        return super().create(validated_data)
