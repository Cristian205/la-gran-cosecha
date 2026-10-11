"""
Deja un negocio listo para WhatsApp: su configuración y una plantilla por
evento con el texto sugerido. No enciende nada: WhatsApp queda APAGADO hasta
que se pongan las credenciales y se aprueben las plantillas en Meta/Twilio.

    python manage.py preparar_whatsapp --negocio la-gran-cosecha
    python manage.py preparar_whatsapp --negocio la-gran-cosecha --alertas 3001234567 3109876543
"""
from django.core.management.base import BaseCommand, CommandError

from apps.mensajeria.eventos import EVENTOS
from apps.mensajeria.models import ConfiguracionWhatsApp, PlantillaWhatsApp
from apps.mensajeria.telefonos import normalizar_e164
from apps.tenancy.context import usar_tenant
from apps.tenancy.models import Tenant


class Command(BaseCommand):
    help = "Crea la configuración de WhatsApp y las plantillas sugeridas de un negocio."

    def add_arguments(self, parser):
        parser.add_argument("--negocio", required=True, help="Slug del negocio.")
        parser.add_argument("--alertas", nargs="*", default=[], help="Teléfonos que reciben las alertas.")

    def handle(self, *args, negocio, alertas, **opciones):
        tenant = Tenant.objects.filter(slug=negocio).first()
        if tenant is None:
            raise CommandError(f"No existe el negocio «{negocio}».")

        telefonos = []
        for t in alertas:
            e164 = normalizar_e164(t)
            if not e164:
                raise CommandError(f"«{t}» no es un teléfono válido.")
            telefonos.append(e164)

        with usar_tenant(tenant):
            config, creada = ConfiguracionWhatsApp.objects.get_or_create(tenant=tenant)
            if telefonos:
                config.telefonos_alertas = telefonos
                config.save(update_fields=["telefonos_alertas", "fecha_actualizacion"])

            nuevas = 0
            for codigo, datos in EVENTOS.items():
                _, nueva = PlantillaWhatsApp.objects.get_or_create(
                    tenant=tenant,
                    evento=codigo,
                    defaults={"meta_nombre": codigo.lower(), "cuerpo": datos["texto"]},
                )
                nuevas += nueva

        self.stdout.write(self.style.SUCCESS(
            f"{tenant.nombre}: configuración {'creada' if creada else 'ya existía'}, "
            f"{nuevas} plantilla(s) nueva(s). WhatsApp está "
            f"{'ENCENDIDO' if config.activo else 'APAGADO'}; proveedor {config.proveedor}."
        ))
        self.stdout.write("Siguiente paso: ver backend/WHATSAPP.md (credenciales y aprobación de plantillas).")
