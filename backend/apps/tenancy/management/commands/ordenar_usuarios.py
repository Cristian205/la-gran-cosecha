"""
Deja las cuentas como quedaron acordadas al pasar a Crynex.

Es una limpieza puntual, no una herramienta permanente: se escribe como comando
y no como script suelto para poder ensayarla, revisarla y repetirla, porque
borra cuentas y eso no se deshace.

    python manage.py ordenar_usuarios --dry-run   # ver qué haría
    python manage.py ordenar_usuarios             # hacerlo

Lo delicado es el orden. Antes de borrar a nadie hay que trasladar TODO lo que
apunte a esa cuenta, y no solo lo que impediría el borrado:

* `LotePedidos.usuario`, `Pedido.usuario`, `HistorialDetallePedido.usuario` son
  PROTECT — el borrado fallaría con un error claro.
* `HistorialPrecio.usuario` es CASCADE, y ese es el peligroso: borrar la cuenta
  se llevaría por delante su historial de cambios de precio sin decir nada.
* `Archivo.subido_por` es SET_NULL, así que se puede dejar; se traslada
  igualmente para no perder quién subió qué.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.tenancy.context import ambito_de_plataforma
from apps.tenancy.models import Membership, Tenant

# Quién se queda y con qué papel.
ADMIN_PLATAFORMA = "danicrg05@gmail.com"
DUENO_DEL_NEGOCIO = "cdrg0782@gmail.com"

A_BORRAR = [
    "cdrg0782s@gmail.com",
    "francyfmg@gmail.com",
    "danicrg05x@gmail.com",
]

# Todo lo que apunta a un usuario. (app, Modelo, campo)
REFERENCIAS = [
    ("orders", "Pedido", "usuario"),
    ("orders", "Pedido", "editado_por"),
    ("orders", "DetallePedido", "modificado_por"),
    ("orders", "HistorialDetallePedido", "usuario"),
    ("orders", "LotePedidos", "usuario"),
    ("catalog", "HistorialPrecio", "usuario"),
    ("media", "Archivo", "subido_por"),
]


class Command(BaseCommand):
    help = "Deja una sola cuenta de plataforma y una de negocio; borra el resto."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="No toca nada.")

    def handle(self, *args, **opciones):
        ensayo = opciones["dry_run"]
        Usuario = get_user_model()

        def cuenta(email):
            usuario = Usuario.objects.filter(email_usuario=email).first()
            if usuario is None:
                raise CommandError(f"No existe {email}. Se aborta sin tocar nada.")
            return usuario

        admin = cuenta(ADMIN_PLATAFORMA)
        dueno = cuenta(DUENO_DEL_NEGOCIO)
        sobrantes = [
            u for u in Usuario.objects.filter(email_usuario__in=A_BORRAR)
        ]

        negocio = Tenant.objects.order_by("id").first()
        if negocio is None:
            raise CommandError("No hay ningún negocio. Se aborta.")

        self.stdout.write(f"\nNegocio: {negocio.nombre} ({negocio.slug})")
        self.stdout.write(f"Administra Crynex : {admin.email_usuario}")
        self.stdout.write(f"Dueño del negocio : {dueno.email_usuario}")
        self.stdout.write(f"Se borran         : {', '.join(u.email_usuario for u in sobrantes) or '(ninguna)'}\n")

        with ambito_de_plataforma():
            traslados = self._planear_traslados(sobrantes, dueno)

            if traslados:
                self.stdout.write("Historial que se traslada al dueño del negocio:")
                for etiqueta, n in traslados.items():
                    self.stdout.write(f"  {n:>4}  {etiqueta}")
            else:
                self.stdout.write("Nada que trasladar.")

            if ensayo:
                self.stdout.write(self.style.WARNING("\nEnsayo: no se tocó nada."))
                return

            with transaction.atomic():
                self._trasladar(sobrantes, dueno)
                self._configurar(admin, dueno, negocio)
                for usuario in sobrantes:
                    correo = usuario.email_usuario
                    usuario.delete()
                    self.stdout.write(f"  borrada  {correo}")

        self.stdout.write(self.style.SUCCESS("\nListo."))
        self._resumen(Usuario)

    # ------------------------------------------------------------------
    def _planear_traslados(self, sobrantes, destino):
        from django.apps import apps  # noqa: PLC0415

        conteo = {}
        for etiqueta, nombre, campo in REFERENCIAS:
            modelo = apps.get_model(etiqueta, nombre)
            gestor = getattr(modelo, "all_tenants", modelo._default_manager)
            n = gestor.filter(**{f"{campo}__in": sobrantes}).count()
            if n:
                conteo[f"{nombre}.{campo}  ->  {destino.email_usuario}"] = n
        return conteo

    def _trasladar(self, sobrantes, destino):
        from django.apps import apps  # noqa: PLC0415

        for etiqueta, nombre, campo in REFERENCIAS:
            modelo = apps.get_model(etiqueta, nombre)
            gestor = getattr(modelo, "all_tenants", modelo._default_manager)
            gestor.filter(**{f"{campo}__in": sobrantes}).update(**{campo: destino})

    def _configurar(self, admin, dueno, negocio):
        """Cada cuenta con el papel que le toca, y sin el que no."""
        admin.es_staff_plataforma = True
        admin.is_staff = True
        admin.is_superuser = True  # dueño de la plataforma entera
        admin.rol_usuario = "GERENTE"
        admin.is_active = True
        admin.save()

        # El dueño del negocio NO administra Crynex, y deja de ser
        # superusuario de Django: ese flag se salta la comprobación de
        # pertenencia y le daría acceso a cualquier empresa futura.
        dueno.es_staff_plataforma = False
        dueno.is_superuser = False
        dueno.is_staff = True
        dueno.rol_usuario = "GERENTE"
        dueno.is_active = True
        dueno.save()

        for usuario in (admin, dueno):
            Membership.objects.update_or_create(
                usuario=usuario,
                tenant=negocio,
                defaults={"rol": "OWNER", "activo": True},
            )

    def _resumen(self, Usuario):
        self.stdout.write("\nCuentas que quedan:")
        for u in Usuario.objects.order_by("id"):
            marcas = []
            if u.es_staff_plataforma:
                marcas.append("Crynex")
            if u.is_superuser:
                marcas.append("superusuario")
            negocios = ", ".join(
                m.tenant.slug for m in u.memberships.filter(activo=True)
            )
            self.stdout.write(
                f"  {u.email_usuario:26} {u.rol_usuario:9} "
                f"[{', '.join(marcas) or 'solo negocio'}]  {negocios}"
            )
