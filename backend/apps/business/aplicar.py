"""
Adoptar un preset: la operación que configura un negocio de una vez.

Copia, activa módulos, adopta la plantilla y aplica el tema. Todo dentro de una
transacción, porque un negocio configurado a medias —con el perfil puesto pero
sin páginas, o con módulos encendidos que su plan no cubre— es peor que uno sin
configurar: el segundo se nota, el primero no.

# La regla de una sola vez

Reaplicar un preset sobre un negocio que ya lo tiene BORRA el trabajo del
cliente: sus capacidades ajustadas a mano, sus ejes de atributos, su política de
stock. Por eso hace falta pedirlo expresamente con `sobrescribir=True`, y por
eso esa bandera no la expone la API del negocio, solo la de plataforma.
"""
from django.db import transaction

from apps.billing.models import Producto
from apps.storefront.composicion import adoptar_plantilla

from .capacidades import normalizar, normalizar_politica
from .perfil_pos import normalizar as normalizar_pos
from .models import PerfilNegocio, TenantModulo


class YaTienePerfil(Exception):
    """El negocio ya adoptó un preset y nadie pidió sobrescribirlo."""


@transaction.atomic
def aplicar_preset(tenant, preset, *, usuario=None, sobrescribir=False, respuestas=None):
    """
    Copia el preset al negocio y lo deja listo para trabajar.

    Devuelve el perfil ya guardado. Lo que NO devuelve —ni toca— es el catálogo:
    un preset configura cómo se comporta el negocio, no le inventa productos.
    """
    perfil, _ = PerfilNegocio.objects.get_or_create(tenant=tenant)

    if perfil.esta_configurado and not sobrescribir:
        raise YaTienePerfil(
            f"«{tenant}» ya adoptó el preset «{perfil.preset_origen}». "
            "Volver a aplicarlo borraría los ajustes que haya hecho."
        )

    # `dict()` y `list()` y no la referencia: sin la copia, editar el perfil
    # mutaría el JSON del preset en memoria y —peor— podría guardarlo.
    perfil.sector = preset.sector
    perfil.capacidades = normalizar(preset.capacidades)
    perfil.politica_stock = normalizar_politica(preset.politica_stock)
    perfil.esquema_atributos = [dict(eje) for eje in (preset.esquema_atributos or [])]
    perfil.perfil_pos = normalizar_pos(preset.perfil_pos)
    perfil.dashboard = list(preset.dashboard or [])
    perfil.preset_origen = preset
    perfil.preset_version_origen = preset.version
    if respuestas is not None:
        perfil.respuestas_alta = dict(respuestas)
    perfil.save()

    activar_modulos(tenant, preset.modulos, usuario=usuario)

    if preset.plantilla_id:
        # `publicar_ya`: un negocio que acaba de configurarse tiene que poder
        # enseñar su tienda en el momento. Pedirle que entre a publicar antes de
        # que su dominio responda es un paso que nadie entiende.
        adoptar_plantilla(tenant, preset.plantilla, autor=usuario, publicar_ya=True)

    aplicar_tema(tenant, preset)
    return perfil


def activar_modulos(tenant, slugs, *, usuario=None) -> list:
    """
    Enciende los módulos del preset que el plan del negocio permita.

    Los que no cubre el plan se OMITEN en silencio y se devuelven aparte, en vez
    de fallar. Un preset es una recomendación: que «Ferretería» sugiera POS no
    puede impedir darse de alta a quien todavía no lo ha contratado — vería un
    error en el alta sin entender qué hizo mal.
    """
    disponibles = modulos_del_plan(tenant)
    encendidos, omitidos = [], []

    for slug in slugs or []:
        modulo = Producto.objects.filter(slug=slug, estado="ACTIVO").first()
        if modulo is None:
            continue
        if slug not in disponibles:
            omitidos.append(slug)
            continue

        activacion, creado = TenantModulo.objects.get_or_create(
            tenant=tenant, modulo=modulo, defaults={"activado_por": usuario}
        )
        if not creado and not activacion.activo:
            activacion.activo = True
            activacion.save(update_fields=["activo"])
        encendidos.append(slug)

    return encendidos, omitidos


def modulos_del_plan(tenant) -> set:
    """
    Los módulos que la suscripción del negocio cubre, por slug.

    Se deduce de los permisos del plan y no de una lista aparte: un plan que
    concede `inventory.view_existencia` está vendiendo Inventario, y mantener
    además una lista de módulos por plan sería un segundo sitio donde vive la
    misma verdad — con la garantía de que algún día discreparán.
    """
    from apps.billing.models import PermisoDisponible, Subscription  # noqa: PLC0415

    # Se consulta y NO se usa `tenant.suscripcion`. El accesor inverso de un
    # OneToOne guarda la instancia en el objeto la primera vez que se toca, así
    # que un `Tenant` que lleve un rato vivo —una tarea de fondo, una cadena de
    # señales, un comando— seguiría respondiendo con el plan que tenía al
    # cargarse. Aquí eso significaría conceder módulos que acaban de revocarse.
    suscripcion = (
        Subscription.objects.filter(tenant=tenant).select_related("plan").first()
    )
    if suscripcion is None or suscripcion.plan is None:
        return set()
    if suscripcion.estado not in Subscription.ESTADOS_VIGENTES:
        # Una suscripción suspendida o cancelada no concede nada. Se comprueba
        # aquí, en el único sitio que responde «¿qué cubre el plan?», y no en
        # cada consumidor: repartir esa condición es garantizar que alguien la
        # olvide y siga sirviendo un módulo que ya no se paga.
        return set()

    return set(
        PermisoDisponible.objects.filter(
            codename__in=suscripcion.plan.permisos or [], producto__isnull=False
        )
        .values_list("producto__slug", flat=True)
        .distinct()
    )


def aplicar_tema(tenant, preset) -> dict:
    """
    Copia el aspecto que propone el preset a la configuración del negocio.

    El orden es el que ya define el motor de temas: primero el tema compartido,
    luego lo que la plantilla dice encima. Cada capa pisa solo lo que declara,
    así que una plantilla que no menciona el color del pie deja el del tema.

    Se copia a `StoreSettings.tokens` y no se referencia, por la razón de
    siempre: apuntar al tema haría que retocarlo en Crynex cambiara la tienda
    publicada de todos sus clientes.
    """
    from apps.content.models import StoreSettings  # noqa: PLC0415

    valores = {}
    if preset.tema_id:
        valores.update(preset.tema.valores or {})
    if preset.plantilla_id:
        valores.update(preset.plantilla.tema_valores or {})
    if not valores:
        return {}

    config, _ = StoreSettings.objects.get_or_create(tenant=tenant)
    # Encima de lo que el negocio ya tenía: adoptar un preset propone un
    # aspecto, no borra los ajustes que no menciona.
    config.tokens = {**(config.tokens or {}), **valores}
    config.save(update_fields=["tokens"])
    return valores


def modulos_activos(tenant) -> set:
    """
    Los que están operativos AHORA: cubiertos por el plan y encendidos.

    Es la única función que debe consultarse para saber si un módulo funciona.
    Preguntar solo por el plan deja encendido lo que el cliente apagó;
    preguntar solo por `TenantModulo` deja encendido lo que dejó de pagar.
    """
    encendidos = set(
        TenantModulo.objects.filter(tenant=tenant, activo=True).values_list(
            "modulo__slug", flat=True
        )
    )
    return encendidos & modulos_del_plan(tenant)
