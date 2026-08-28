import logging
import random
import secrets
import string

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import Permission
from django.core import signing
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.permissions import EsAdministrador, es_owner, es_owner_de, requiere_permiso

from apps.tenancy.models import Membership
from apps.tenancy.viewsets import ExigeNegocioMixin

from .emails import enviar_codigo_otp
from .permisos import CATALOGO_PERMISOS
from .serializers import (
    CambiarPasswordSerializer,
    CrearUsuarioSerializer,
    EditarUsuarioSerializer,
    LoginSerializer,
    PermisosUsuarioSerializer,
    PreferenciasSerializer,
    UsuarioSerializer,
    VerifyOtpSerializer,
)

Usuario = get_user_model()

# El rol del panel se traduce a rol de pertenencia. GERENTE era el dueño de la
# cuenta según la semántica anterior a la fase 3, y lo sigue siendo.
ROL_A_PERTENENCIA = {"GERENTE": "OWNER", "ADMIN": "ADMIN", "ANALISTA": "STAFF"}
logger = logging.getLogger(__name__)


def _generar_password_seguro(longitud=12):
    """Portado de `generar_password_seguro` del proyecto original."""
    caracteres = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(caracteres) for _ in range(longitud))


def _tokens_para_usuario(user, tenant=None):
    """
    Emite el par de tokens, con el negocio activo dentro si lo hay.

    El claim va en el REFRESH y no solo en el access: SimpleJWT construye cada
    nuevo access a partir de la carga del refresh, así que ponerlo solo en el
    access lo perdería en la primera renovación y el panel se quedaría sin
    negocio a los treinta minutos.

    El claim solo ELIGE el negocio; no concede nada. Que la persona siga
    perteneciendo a él se comprueba en cada petición (`ExigePertenencia`), así
    que retirar a alguien de un negocio surte efecto de inmediato aunque su
    token siga vivo.
    """
    refresh = RefreshToken.for_user(user)
    if tenant is not None:
        refresh["tenant_id"] = str(tenant.uuid)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _negocios_de(user):
    """Los negocios operativos en los que trabaja esta persona."""
    return [
        m.tenant
        for m in user.memberships.filter(activo=True).select_related("tenant")
        if m.tenant.esta_operativo
    ]


def _negocio_por_defecto(user, negocios=None):
    """
    Con cuál entra al iniciar sesión.

    Si trabaja en varios, entra en el primero por orden alfabético y el panel le
    ofrece cambiar. Elegir por él es mejor que pedirle que elija antes de ver
    nada: la inmensa mayoría solo tiene uno.
    """
    negocios = negocios if negocios is not None else _negocios_de(user)
    return negocios[0] if negocios else None


class LoginView(APIView):
    """
    Paso 1 del login OTP administrativo.
    Valida credenciales, genera y envía el código OTP, y devuelve un
    `otp_ticket` firmado (stateless) que el frontend reenvía en el paso 2.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email_usuario"]
        password = serializer.validated_data["password"]

        user = authenticate(request, email_usuario=email, password=password)

        if user is None:
            return Response(
                {"success": False, "message": "Credenciales incorrectas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active or user.esta_bloqueado():
            return Response(
                {
                    "success": False,
                    "message": "La cuenta está bloqueada o no tiene acceso.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Generar y almacenar el hash del OTP
        otp_code = str(random.randint(100000, 999999))
        user.token_verificacion = make_password(otp_code)
        user.token_expiracion = timezone.now() + timezone.timedelta(
            minutes=settings.OTP_EXPIRY_MINUTES
        )
        user.save(update_fields=["token_verificacion", "token_expiracion"])

        try:
            # La marca del correo es la del negocio por el que entrará. Con
            # varios, la del primero: es el que el panel abrirá por defecto.
            enviar_codigo_otp(user, otp_code, _negocio_por_defecto(user))
        except Exception:  # noqa: BLE001
            # Sin esto el fallo real de SMTP (credenciales, remitente rechazado,
            # timeout) queda invisible detrás del 500 genérico de abajo.
            logger.exception("Fallo al enviar el código OTP a %s", user.email_usuario)
            return Response(
                {"success": False, "message": "Error enviando el código OTP."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if settings.DEBUG:
            # Con el backend de consola el correo son miles de líneas (el logo va
            # adjunto en base64), así que dejamos el código a la vista. Nunca en
            # producción: DEBUG es False allí.
            logger.info("Código OTP para %s: %s", user.email_usuario, otp_code)

        # Ticket firmado con el uid del usuario (válido durante la vida del OTP)
        otp_ticket = signing.dumps(
            {"uid": str(user.uid)}, salt=settings.OTP_TICKET_SALT
        )

        return Response(
            {
                "success": True,
                "step": 2,
                "otp_ticket": otp_ticket,
                "message": "Código OTP enviado correctamente.",
            }
        )


class VerifyOtpView(APIView):
    """Paso 2: valida el OTP y devuelve los tokens JWT."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = VerifyOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        otp_ticket = serializer.validated_data["otp_ticket"]
        otp_ingresado = serializer.validated_data["otp_token"]

        max_age = settings.OTP_EXPIRY_MINUTES * 60
        try:
            payload = signing.loads(
                otp_ticket, salt=settings.OTP_TICKET_SALT, max_age=max_age
            )
        except signing.SignatureExpired:
            return Response(
                {"success": False, "message": "La verificación expiró. Inicie sesión de nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response(
                {"success": False, "message": "Ticket de verificación inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = Usuario.objects.get(uid=payload["uid"])
        except Usuario.DoesNotExist:
            return Response(
                {"success": False, "message": "Usuario no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.token_expiracion:
            return Response(
                {"success": False, "message": "El código OTP no existe."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > user.token_expiracion:
            return Response(
                {"success": False, "message": "El código OTP ha expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(otp_ingresado, user.token_verificacion):
            user.intentos_fallidos += 1
            user.save(update_fields=["intentos_fallidos"])
            return Response(
                {"success": False, "message": "Código de seguridad incorrecto."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.esta_bloqueado():
            return Response(
                {"success": False, "message": "Cuenta bloqueada temporalmente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Éxito: limpiar OTP y emitir tokens
        user.ultimo_login_exitoso = timezone.now()
        user.intentos_fallidos = 0
        user.token_expiracion = None
        user.token_verificacion = None
        user.save(
            update_fields=[
                "ultimo_login_exitoso",
                "intentos_fallidos",
                "token_expiracion",
                "token_verificacion",
            ]
        )

        negocios = _negocios_de(user)
        if not negocios and not user.is_superuser:
            # Una cuenta sin pertenencia no puede administrar nada: desde la
            # fase 3 el acceso lo concede el negocio, no `is_staff`.
            return Response(
                {
                    "success": False,
                    "message": "Tu cuenta no está dada de alta en ningún negocio.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        activo = _negocio_por_defecto(user, negocios)
        request.tenant = activo  # para que el serializer calcule rol y permisos

        return Response(
            {
                "success": True,
                **_tokens_para_usuario(user, activo),
                "user": UsuarioSerializer(
                    user, context={"request": request, "incluir_negocios": True}
                ).data,
            }
        )


class MeView(APIView):
    """Devuelve o actualiza preferencias propias del usuario autenticado actual."""

    def get(self, request):
        return Response(
            UsuarioSerializer(
                request.user, context={"request": request, "incluir_negocios": True}
            ).data
        )

    def patch(self, request):
        serializer = PreferenciasSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        campos = list(serializer.validated_data.keys())
        for campo, valor in serializer.validated_data.items():
            setattr(request.user, campo, valor)
        if campos:
            request.user.save(update_fields=campos)
        return Response(
            UsuarioSerializer(
                request.user, context={"request": request, "incluir_negocios": True}
            ).data
        )


class CambiarNegocioView(APIView):
    """
    Emite un par de tokens nuevo apuntando a otro de los negocios del usuario.

    Es la contrapartida del selector del panel. No basta con que el frontend
    cambie una cabecera: el negocio activo viaja firmado dentro del token, y la
    pertenencia se vuelve a comprobar aquí antes de emitirlo.
    """

    def post(self, request):
        slug = str(request.data.get("negocio", "")).strip().lower()
        if not slug:
            return Response(
                {"success": False, "message": "Indica a qué negocio quieres entrar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        destino = next(
            (t for t in _negocios_de(request.user) if t.slug == slug), None
        )
        if destino is None:
            # 404 y no 403: si no trabaja ahí, ese negocio no existe para él.
            return Response(
                {"success": False, "message": "No trabajas en ese negocio."},
                status=status.HTTP_404_NOT_FOUND,
            )

        request.tenant = destino
        return Response(
            {
                "success": True,
                **_tokens_para_usuario(request.user, destino),
                "user": UsuarioSerializer(
                    request.user,
                    context={"request": request, "incluir_negocios": True},
                ).data,
            }
        )


class CambiarPasswordView(APIView):
    """Permite al usuario autenticado cambiar su propia contraseña."""

    def post(self, request):
        serializer = CambiarPasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(
            serializer.validated_data["password_actual"]
        ):
            return Response(
                {"success": False, "message": "La contraseña actual no es correcta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(serializer.validated_data["password_nueva"])
        request.user.debe_cambiar_password = False
        request.user.save(update_fields=["password", "debe_cambiar_password"])
        return Response({"success": True, "message": "Contraseña actualizada correctamente."})


class PermisosDisponiblesView(APIView):
    """Catálogo de permisos asignables (agrupado por módulo), para armar la UI."""

    permission_classes = [EsAdministrador]

    def get(self, request):
        return Response(CATALOGO_PERMISOS)


class UsuarioViewSet(ExigeNegocioMixin, viewsets.ViewSet):
    """
    Gestión de usuarios administrativos.

    El dueño de la cuenta (GERENTE o superusuario) siempre tiene acceso total.
    Para el resto, cada acción de escritura exige el permiso puntual
    correspondiente (asignable por el dueño desde `permisos`), pensado para
    delegar el panel en un tercero sin darle control total.
    """

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [requiere_permiso("accounts.view_usuario")()]
        if self.action == "create":
            return [requiere_permiso("accounts.add_usuario")()]
        if self.action in ("update", "partial_update"):
            return [requiere_permiso("accounts.change_usuario")()]
        if self.action == "destroy":
            return [requiere_permiso("accounts.delete_usuario")()]
        # Asignar permisos es, en sí mismo, una acción exclusiva del dueño:
        # de lo contrario un delegado con "change_usuario" podría auto-otorgarse más acceso.
        return [EsAdministrador()]

    def _equipo(self, request):
        """
        Los usuarios del negocio de esta petición.

        `Usuario` es identidad de plataforma y no lleva columna de negocio: una
        persona puede trabajar en varios. El ámbito lo da la pertenencia.
        """
        if request.tenant is None:
            return Usuario.objects.none()
        return Usuario.objects.filter(
            memberships__tenant=request.tenant, memberships__activo=True
        ).distinct()

    def list(self, request):
        usuarios = self._equipo(request)
        return Response(
            UsuarioSerializer(usuarios, many=True, context={"request": request}).data
        )

    def retrieve(self, request, pk=None):
        try:
            usuario = self._equipo(request).get(pk=pk)
        except Usuario.DoesNotExist:
            return Response(
                {"message": "Usuario no encontrado"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(UsuarioSerializer(usuario, context={"request": request}).data)

    def create(self, request):
        serializer = CrearUsuarioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data["rol"] == "GERENTE" and not es_owner(request):
            return Response(
                {"success": False, "message": "Solo un Gerente puede crear otra cuenta de Gerente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.tenant is None:
            return Response(
                {"success": False, "message": "No hay ningún negocio en esta dirección."},
                status=status.HTTP_404_NOT_FOUND,
            )

        password_temp = _generar_password_seguro()
        nuevo = Usuario.objects.create_user(
            email_usuario=data["email"],
            nombre_usuario=data["nombre"],
            password=password_temp,
            rol_usuario=data["rol"],
            is_staff=True,
            debe_cambiar_password=True,
        )

        # Sin pertenencia el usuario existiría pero no podría entrar a ningún
        # negocio: crear la cuenta y darla de alta en el negocio es una sola
        # operación desde el punto de vista de quien usa el panel.
        Membership.objects.create(
            usuario=nuevo,
            tenant=request.tenant,
            rol=ROL_A_PERTENENCIA.get(data["rol"], "STAFF"),
        )

        return Response(
            {
                "success": True,
                "message": f"Usuario creado. Clave temporal asignada: {password_temp}",
                "password_temporal": password_temp,
                "usuario": UsuarioSerializer(nuevo, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, pk=None):
        return self.partial_update(request, pk)

    def partial_update(self, request, pk=None):
        try:
            usuario = self._equipo(request).get(pk=pk)
        except Usuario.DoesNotExist:
            return Response(
                {"message": "Usuario no encontrado"}, status=status.HTTP_404_NOT_FOUND
            )

        if es_owner_de(usuario, request.tenant) and not es_owner(request):
            return Response(
                {"success": False, "message": "No puedes modificar una cuenta de Gerente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = EditarUsuarioSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)

        # Solo el dueño puede reasignar el rol (evita que un delegado se autopromueva).
        if "rol_usuario" in datos and not es_owner(request):
            datos.pop("rol_usuario")

        if usuario.id == request.user.id and datos.get("is_active") is False:
            return Response(
                {"success": False, "message": "No puedes desactivar tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for campo, valor in datos.items():
            setattr(usuario, campo, valor)
        if datos:
            usuario.save(update_fields=list(datos.keys()))

        # `rol_usuario` es la etiqueta que muestra el panel; quien decide el
        # acceso desde la fase 3 es la pertenencia. Sin esta sincronización,
        # cambiar el rol en la interfaz no cambiaría nada de verdad.
        if "rol_usuario" in datos:
            Membership.objects.filter(usuario=usuario, tenant=request.tenant).update(
                rol=ROL_A_PERTENENCIA.get(datos["rol_usuario"], "STAFF")
            )

        return Response(UsuarioSerializer(usuario, context={"request": request}).data)

    def destroy(self, request, pk=None):
        try:
            usuario = self._equipo(request).get(pk=pk)
        except Usuario.DoesNotExist:
            return Response(
                {"success": False, "message": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if usuario.id == request.user.id:
            return Response(
                {"success": False, "message": "No puedes eliminar tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if es_owner_de(usuario, request.tenant) and not es_owner(request):
            return Response(
                {"success": False, "message": "No puedes eliminar una cuenta de Gerente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        usuario.delete()
        return Response({"success": True, "message": "Usuario eliminado correctamente"})

    @action(detail=True, methods=["get", "put"], url_path="permisos")
    def permisos(self, request, pk=None):
        """Consulta o asigna los permisos granulares de un usuario delegado."""
        try:
            usuario = self._equipo(request).get(pk=pk)
        except Usuario.DoesNotExist:
            return Response(
                {"message": "Usuario no encontrado"}, status=status.HTTP_404_NOT_FOUND
            )

        if request.method == "GET":
            return Response({"permisos": UsuarioSerializer(usuario, context={"request": request}).data["permisos"]})

        if es_owner_de(usuario, request.tenant):
            return Response(
                {"success": False, "message": "Las cuentas de Gerente ya tienen acceso total."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PermisosUsuarioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        codenames = serializer.validated_data["permisos"]

        # Los permisos se guardan en la pertenencia, no en `user_permissions`.
        # Ese es global: concedérselos allí daría el mismo acceso en todos los
        # negocios donde la persona trabaje, que es justo lo que la fase 3
        # viene a impedir.
        pertenencia = Membership.objects.filter(
            usuario=usuario, tenant=request.tenant, activo=True
        ).first()
        if pertenencia is None:
            return Response(
                {"success": False, "message": "El usuario no trabaja en este negocio."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pertenencia.permisos = sorted(codenames)
        pertenencia.save(update_fields=["permisos"])
        return Response({"success": True, "permisos": pertenencia.permisos})
