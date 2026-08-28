"""
Da de alta los dominios por los que ya se llega al negocio existente.

Es la pieza sin la cual la fase 3 dejaría el sitio caído. Hasta aquí, una
petición cuyo host no estaba registrado seguía sirviéndose gracias al puente
«si solo hay un negocio, es ese». La fase 3 retira ese puente porque adivinar
es el fallo abierto contra el que se diseñó todo esto — así que los hostnames
reales tienen que estar en la tabla `Domain` ANTES de que el puente desaparezca.

De dónde salen: de `ALLOWED_HOSTS`, que es exactamente la lista de hosts por los
que Django acepta tráfico, y que en producción viene de la variable de entorno
del servicio. `migrate` corre con el mismo entorno que el servidor (ver el CMD
del Dockerfile), así que la lista es la correcta y no hay que adivinar nada.

Solo actúa si hay UN negocio: con varios ya no está claro a cuál pertenece cada
host, y esa decisión es de quien administra la plataforma, no de una migración.
"""
from django.conf import settings
from django.db import migrations

# Hosts de desarrollo que conviene registrar siempre: son los que usan el
# `runserver` local, docker-compose y el cliente de pruebas de Django.
HOSTS_LOCALES = ["localhost", "127.0.0.1", "backend", "testserver"]


def _hostnames():
    """Los hosts reales, sin comodines ni cadenas vacías."""
    crudos = list(getattr(settings, "ALLOWED_HOSTS", [])) + HOSTS_LOCALES

    limpios = []
    for host in crudos:
        host = (host or "").strip().lower().lstrip(".")
        # `*` acepta cualquier cosa y no es un hostname que registrar; un
        # comodín de subdominio (`.ejemplo.com`) tampoco es una fila concreta.
        if not host or "*" in host:
            continue
        if host not in limpios:
            limpios.append(host)
    return limpios


def registrar(apps, schema_editor):
    Tenant = apps.get_model("tenancy", "Tenant")
    Domain = apps.get_model("tenancy", "Domain")

    negocios = list(Tenant.objects.all()[:2])
    if len(negocios) != 1:
        # Instalación vacía, o ya multiempresa: en ambos casos, quien
        # administra decide qué dominio va a qué negocio.
        return
    tenant = negocios[0]

    primario_tomado = Domain.objects.filter(tenant=tenant, es_primario=True).exists()

    for hostname in _hostnames():
        if Domain.objects.filter(hostname=hostname).exists():
            continue
        # El primero que no sea local se queda el papel de primario: es el que
        # decidirá la URL canónica del SEO más adelante.
        es_primario = not primario_tomado and hostname not in HOSTS_LOCALES
        Domain.objects.create(
            tenant=tenant, hostname=hostname, es_primario=es_primario, verificado=True
        )
        primario_tomado = primario_tomado or es_primario


def desregistrar(apps, schema_editor):
    Domain = apps.get_model("tenancy", "Domain")
    Domain.objects.filter(hostname__in=_hostnames()).delete()


class Migration(migrations.Migration):

    dependencies = [("tenancy", "0003_row_level_security")]

    operations = [migrations.RunPython(registrar, desregistrar)]
