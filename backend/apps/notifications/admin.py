from django.contrib import admin

from .models import Notificacion


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ("titulo", "tipo", "leida", "fecha_creacion")
    list_filter = ("tipo", "leida")
    list_editable = ("leida",)
