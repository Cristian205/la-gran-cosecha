"""Alta y consulta de los dominios de cada negocio."""
from django.core.management.base import BaseCommand, CommandError

from apps.tenancy.models import Domain, Tenant


class Command(BaseCommand):
    help = "Lista los dominios registrados, o da de alta uno nuevo en un negocio."

    def add_arguments(self, parser):
        parser.add_argument("--negocio", help="Slug del negocio")
        parser.add_argument("--añadir", dest="anadir", help="Hostname a registrar")
        parser.add_argument(
            "--primario",
            action="store_true",
            help="Marcarlo como dominio canónico del negocio (para el SEO)",
        )

    def handle(self, *args, **opciones):
        if not opciones["anadir"]:
            return self._listar()

        if not opciones["negocio"]:
            raise CommandError("Indica el negocio con --negocio <slug>.")

        try:
            tenant = Tenant.objects.get(slug=opciones["negocio"])
        except Tenant.DoesNotExist:
            raise CommandError(f"No existe el negocio '{opciones['negocio']}'.") from None

        hostname = opciones["anadir"].strip().lower()
        existente = Domain.objects.filter(hostname=hostname).first()
        if existente:
            raise CommandError(f"'{hostname}' ya está asignado a {existente.tenant}.")

        if opciones["primario"]:
            # Solo puede haber uno: si no, la URL canónica queda ambigua.
            Domain.objects.filter(tenant=tenant, es_primario=True).update(es_primario=False)

        Domain.objects.create(
            tenant=tenant, hostname=hostname, es_primario=opciones["primario"]
        )
        self.stdout.write(self.style.SUCCESS(f"{hostname} → {tenant.nombre}"))

    def _listar(self):
        if not Domain.objects.exists():
            self.stdout.write(
                self.style.WARNING(
                    "No hay ningún dominio registrado: ninguna petición resolverá "
                    "a un negocio y la tienda responderá 404."
                )
            )
            return
        for tenant in Tenant.objects.prefetch_related("dominios"):
            self.stdout.write(f"\n{tenant.nombre} ({tenant.slug}) · {tenant.estado}")
            for dominio in tenant.dominios.all():
                marca = " [primario]" if dominio.es_primario else ""
                aviso = "" if dominio.verificado else " (sin verificar)"
                self.stdout.write(f"  {dominio.hostname}{marca}{aviso}")
