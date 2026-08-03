from django.contrib import admin

from .models import Archivo


@admin.register(Archivo)
class ArchivoAdmin(admin.ModelAdmin):
    list_display = ("nombre_original", "tipo", "tamano", "subido_por", "fecha_creacion")
    list_filter = ("tipo",)
    search_fields = ("nombre_original",)
