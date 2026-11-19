from django.contrib import admin

from .models import Furgon, PlanoCarga, TipoCanastilla

admin.site.register(Furgon)
admin.site.register(TipoCanastilla)
admin.site.register(PlanoCarga)
