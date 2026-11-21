from django.contrib import admin

from .models import EventoLote, Furgon, LoteDespacho, PlanoCarga, TipoCanastilla

admin.site.register(Furgon)
admin.site.register(TipoCanastilla)
admin.site.register(PlanoCarga)
admin.site.register(LoteDespacho)
admin.site.register(EventoLote)
