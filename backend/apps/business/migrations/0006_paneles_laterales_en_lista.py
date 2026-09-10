"""
`panel_lateral` pasa de cadena a lista, y el restaurante estrena domicilios.

Las dos cosas van juntas porque la segunda es la que obligo a la primera.

# Que se rompio, exactamente

`perfil_pos.panel_lateral` guardaba UNA clave: «reserva», o «cliente», o nada.
Con un solo modulo aportando paneles eso alcanzaba y nadie lo miro dos veces.
Llega domicilios —el segundo— y aparece el negocio que lo revienta: un
restaurante que atiende en mesas Y reparte. Tiene los dos modulos contratados,
los dos paneles registrados, los dos filtrados correctamente por
`pos.paneles.disponibles()`… y tenia que elegir cual de los dos ver, porque el
sitio donde el negocio dice cuales quiere solo admitia uno.

No fallaba el registro de paneles, que aguanto la fase entera sin tocarse. Lo
que suponia «uno» era el campo. Es un modo de fallo que conviene reconocer
porque se repite: la primera implementacion de un mecanismo extensible casi
siempre supone «uno» en ALGUN sitio, y ese sitio no suele ser el que uno
disenio con cuidado —ahi ya se penso en varios— sino el de al lado, el que
parecia un detalle de configuracion. Y quien lo encuentra es el segundo caso,
nunca el primero: con un solo panel no hay contra que chocar.

# Por que se migra el dato y no solo el codigo

`perfil_pos.normalizar()` acepta la cadena vieja y la envuelve, asi que nada se
rompe sin esto. Pero un dato que solo funciona porque el codigo lo perdona es
deuda con fecha: dentro de un ano nadie recordara por que hay dos formas del
mismo campo, y el primero que escriba `panel_lateral[0]` sobre un perfil sin
migrar leera la letra «r» de «reserva» sin que nada avise. Se normalizan las
dos tablas —presets y perfiles— y la compatibilidad queda solo para lo que
llegue de fuera.

# Y el restaurante

Se le anaden `domicilios` a los modulos y `domicilio` a sus paneles. No es
cosmetico: era el preset que hacia falta para que el problema de arriba
existiera, y dejarlo con un solo panel seria describir un restaurante que no es
ninguno de los que uno conoce.
"""
from django.db import migrations

PRESET = "restaurante"
MODULO = "domicilios"
PANEL = "domicilio"


def _en_lista(valor) -> list:
    """La misma conversion que `perfil_pos._lista_de_claves`, escrita aparte.

    Duplicada a proposito: una migracion que importa codigo de la aplicacion
    hace lo que ese codigo diga DENTRO DE UN ANO, no lo que decia el dia que se
    escribio. Es la razon por la que Django obliga a `apps.get_model` en vez de
    dejar importar los modelos, y vale igual para las funciones.
    """
    if valor is None:
        return []
    if isinstance(valor, str):
        return [valor] if valor else []
    if isinstance(valor, (list, tuple)):
        return [c for c in valor if isinstance(c, str) and c]
    return []


def a_lista(apps, schema_editor):
    Preset = apps.get_model("business", "Preset")
    PerfilNegocio = apps.get_model("business", "PerfilNegocio")

    for modelo in (Preset, PerfilNegocio):
        for fila in modelo.objects.all():
            perfil = dict(fila.perfil_pos or {})
            if "panel_lateral" not in perfil:
                continue
            perfil["panel_lateral"] = _en_lista(perfil["panel_lateral"])
            fila.perfil_pos = perfil
            fila.save(update_fields=["perfil_pos"])

    restaurante = Preset.objects.filter(slug=PRESET).first()
    if restaurante is None:
        return

    modulos = list(restaurante.modulos or [])
    if MODULO not in modulos:
        modulos.append(MODULO)

    perfil = dict(restaurante.perfil_pos or {})
    paneles = _en_lista(perfil.get("panel_lateral"))
    if PANEL not in paneles:
        paneles.append(PANEL)
    perfil["panel_lateral"] = paneles

    restaurante.modulos = modulos
    restaurante.perfil_pos = perfil
    restaurante.save(update_fields=["modulos", "perfil_pos"])


def a_cadena(apps, schema_editor):
    """
    Vuelve a la cadena, quedandose con el PRIMER panel.

    Es una marcha atras con perdida y no hay forma de que no lo sea: el modelo
    viejo no sabe representar dos. Se conserva el primero porque es el que el
    negocio tenia antes de que domicilios existiera.
    """
    Preset = apps.get_model("business", "Preset")
    PerfilNegocio = apps.get_model("business", "PerfilNegocio")

    for modelo in (Preset, PerfilNegocio):
        for fila in modelo.objects.all():
            perfil = dict(fila.perfil_pos or {})
            if "panel_lateral" not in perfil:
                continue
            paneles = _en_lista(perfil["panel_lateral"])
            perfil["panel_lateral"] = paneles[0] if paneles else None
            fila.perfil_pos = perfil
            fila.save(update_fields=["perfil_pos"])

    restaurante = Preset.objects.filter(slug=PRESET).first()
    if restaurante is not None:
        restaurante.modulos = [m for m in (restaurante.modulos or []) if m != MODULO]
        restaurante.save(update_fields=["modulos"])


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0005_preset_restaurante"),
        # El preset nombra el modulo `domicilios`, y nombrar en `Preset.modulos`
        # un slug que el catalogo no tiene es como se fabrica un negocio que
        # cree tener contratado algo que no existe.
        ("billing", "0009_producto_domicilios"),
    ]

    operations = [migrations.RunPython(a_lista, a_cadena)]
