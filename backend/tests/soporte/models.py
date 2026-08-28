"""
Modelo de usar y tirar para probar la maquinaria de tenancy.

Existe porque en la fase 1 ningún modelo de negocio hereda todavía de
`ModeloConTenant` — eso es la fase 2 — y enviar el manager sin cobertura sería
enviar sin probar justamente la pieza de la que depende todo el aislamiento.

Solo se instala bajo `config.settings.test`. Django le crea la tabla con
run_syncdb porque la app no tiene migraciones.
"""
from django.db import models

from apps.tenancy.models import ModeloConTenant


class Cosa(ModeloConTenant):
    nombre = models.CharField(max_length=100)

    class Meta:
        db_table = "soporte_cosa"

    def __str__(self):
        return self.nombre
