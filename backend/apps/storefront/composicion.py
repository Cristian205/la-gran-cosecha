"""
Validación de una composición y las operaciones que la mueven.

La composición es JSON, así que la base de datos no la puede proteger: aquí es
donde se decide qué es una página válida. Sin esto, un bloque con un `tipo` mal
escrito se guardaría sin queja y desaparecería de la tienda sin que nadie
supiera por qué.

El criterio de qué se rechaza y qué se tolera:

* Se RECHAZA lo que dejaría la página rota o mentiría sobre lo que hay: un tipo
  de bloque que no existe, un bloque repetido que no puede repetirse, ids
  duplicados. Son errores que el editor puede corregir en el momento.
* Se TOLERA lo desconocido dentro de `props`. Un bloque puede ganar una
  propiedad en el frontend antes de que su esquema la declare, y bloquear el
  guardado por eso convertiría cada mejora en una migración coordinada.
"""
from django.utils import timezone
from rest_framework import serializers

from .models import Bloque, Pagina, VersionPagina

#: Los tres puntos de corte del constructor. Están en código porque son los que
#: la hoja de estilos de la tienda conoce: añadir uno aquí sin añadirlo allí
#: daría una visibilidad que nadie aplica.
DISPOSITIVOS = ("movil", "tablet", "escritorio")


def validar(composicion, *, bloques=None) -> list:
    """
    Comprueba una composición entera y la devuelve normalizada.

    Normalizar aquí —y no en el frontend— es lo que permite que el lienzo
    asuma que todo bloque trae `id`, `props` y `visible`, sin defenderse en
    cada punto de un JSON escrito a mano.
    """
    if not isinstance(composicion, list):
        raise serializers.ValidationError("La composición debe ser una lista de bloques.")

    catalogo = {b.codigo: b for b in (bloques or Bloque.objects.filter(activo=True))}
    vistos_id: set[str] = set()
    vistos_unicos: set[str] = set()
    salida = []

    for posicion, bruto in enumerate(composicion):
        if not isinstance(bruto, dict):
            raise serializers.ValidationError(
                f"El elemento {posicion} no es un bloque."
            )

        tipo = bruto.get("tipo")
        bloque = catalogo.get(tipo)
        if bloque is None:
            raise serializers.ValidationError(
                f"El bloque «{tipo}» no existe en el catálogo o está retirado."
            )

        if bloque.unico_por_pagina:
            if tipo in vistos_unicos:
                raise serializers.ValidationError(
                    f"«{bloque.nombre}» solo puede aparecer una vez en la página."
                )
            vistos_unicos.add(tipo)

        # El id lo usa el editor para arrastrar y para saber qué cambió; si se
        # repite, mover un bloque movería dos.
        identificador = str(bruto.get("id") or f"{tipo}-{posicion}")
        if identificador in vistos_id:
            raise serializers.ValidationError(
                f"Hay dos bloques con el identificador «{identificador}»."
            )
        vistos_id.add(identificador)

        variante = bruto.get("variante") or ""
        disponibles = bloque.codigos_de_variante()
        if variante and disponibles and variante not in disponibles:
            raise serializers.ValidationError(
                f"«{bloque.nombre}» no tiene la variante «{variante}»."
            )

        props = bruto.get("props")
        if props is not None and not isinstance(props, dict):
            raise serializers.ValidationError(
                f"Las propiedades de «{tipo}» deben ser un objeto."
            )

        visible = bruto.get("visible") or {}
        salida.append(
            {
                "id": identificador,
                "tipo": tipo,
                "variante": variante,
                "props": props or {},
                "estilo": _estilo(bloque, bruto.get("estilo")),
                # Ausente significa visible: una página escrita a mano no
                # debería desaparecer por no declarar los tres dispositivos.
                "visible": {
                    d: bool(visible.get(d, True)) for d in DISPOSITIVOS
                },
            }
        )

    return salida


def _estilo(bloque, bruto) -> dict:
    """
    El aspecto propio de un bloque colocado, acotado a lo que ese bloque admite.

    Guarda CÓDIGOS de token y no variables CSS, igual que `StoreSettings.tokens`:
    la traducción a `--variable` la hace `tema.a_variables()` justo antes de
    escribirla, y hacerla una sola vez es lo que evita que el editor y la tienda
    acaben con dos vocabularios.

    Lo que NO declara `Bloque.tokens_admitidos` se DESCARTA en silencio, no se
    rechaza. Es el mismo criterio que `tema.resolver()` con un token retirado, y
    aquí importa más: retirar un token del catálogo, o quitárselo a un bloque,
    no puede impedir que se guarde una página que lo tenía puesto de antes. La
    alternativa —un 400— dejaría al negocio sin poder editar su tienda por una
    decisión que tomó la plataforma.

    Se descarta también el valor vacío. Una perilla que el editor dejó en blanco
    significa «que mande el tema del negocio», y guardarla como cadena vacía
    escribiría `--fondo:` en el HTML, que invalida la declaración entera.
    """
    if bruto is None:
        return {}
    if not isinstance(bruto, dict):
        raise serializers.ValidationError(
            f"El estilo de «{bloque.codigo}» debe ser un objeto."
        )

    admitidos = set(bloque.tokens_admitidos or [])
    return {
        codigo: str(valor)
        for codigo, valor in bruto.items()
        if codigo in admitidos and valor not in (None, "")
    }


def para_la_tienda(bloques) -> list:
    """
    Una composición lista para pintarse: con lo que sabe el catálogo y con el
    estilo ya traducido a variables CSS.

    Dos cosas se añaden aquí y no se guardan en el JSON, y por el mismo motivo:
    son propiedad del CATÁLOGO, no de esta página. Copiarlas a la composición
    haría que cambiar un bloque de ancho —o darle un token nuevo— obligara a
    reescribir las mil composiciones que lo usan.

        a_sangre   si sale de los márgenes
        estilo     los códigos de token, ya como `--variable`

    Existe como función suelta porque hay DOS caminos que sirven una tienda: la
    página publicada y el enlace de prueba de una plantilla. Hasta ahora solo el
    primero enriquecía, así que en la previa de una plantilla `a_sangre` llegaba
    ausente y una portada a sangre se pintaba dentro del contenedor. No daba
    error: simplemente la plantilla se veía peor de lo que era, justo en la
    pantalla que existe para juzgarla.
    """
    from . import tema as motor  # noqa: PLC0415 — evita el ciclo con models

    catalogo_bloques = {b.codigo: b for b in Bloque.objects.filter(activo=True)}
    catalogo_tokens = motor.catalogo()

    salida = []
    for bloque in bloques or []:
        definicion = catalogo_bloques.get(bloque.get("tipo"))
        salida.append(
            {
                **bloque,
                "a_sangre": bool(definicion and definicion.a_sangre),
                "estilo": motor.a_variables(
                    bloque.get("estilo"), disponibles=catalogo_tokens
                ),
            }
        )
    return salida


# ==========================================================================
# Operaciones sobre las versiones
# ==========================================================================
def siguiente_numero(pagina: Pagina) -> int:
    ultimo = pagina.versiones.order_by("-numero").values_list("numero", flat=True).first()
    return (ultimo or 0) + 1


def obtener_borrador(pagina: Pagina, autor=None) -> VersionPagina:
    """
    El borrador de una página, creándolo si hace falta.

    Se siembra con lo que hay publicado y no en blanco: quien entra a editar
    quiere retocar su tienda, no empezar de cero.
    """
    borrador = pagina.borrador
    if borrador is not None:
        return borrador

    publicada = pagina.publicada
    return VersionPagina.objects.create(
        tenant=pagina.tenant,
        pagina=pagina,
        numero=siguiente_numero(pagina),
        estado=VersionPagina.Estado.BORRADOR,
        composicion=list(publicada.composicion) if publicada else [],
        autor=autor,
    )


def publicar(pagina: Pagina, autor=None) -> VersionPagina:
    """
    Asciende el borrador y archiva la que estaba publicada.

    El orden importa: primero se archiva la vieja y después se asciende el
    borrador. Al revés habría un instante con dos publicadas, y la restricción
    de la base lo impediría en mitad de la operación.
    """
    borrador = pagina.borrador
    if borrador is None:
        raise serializers.ValidationError("No hay ningún borrador que publicar.")

    anterior = pagina.publicada
    if anterior is not None:
        anterior.estado = VersionPagina.Estado.ARCHIVADA
        anterior.save(update_fields=["estado"])

    borrador.estado = VersionPagina.Estado.PUBLICADA
    borrador.fecha_publicacion = timezone.now()
    if autor is not None:
        borrador.autor = autor
    borrador.save(update_fields=["estado", "fecha_publicacion", "autor"])
    return borrador


def restaurar(pagina: Pagina, version: VersionPagina, autor=None) -> VersionPagina:
    """
    Copia una versión vieja al borrador.

    Deliberadamente NO publica: deshacer no puede cambiar lo que los visitantes
    están viendo sin que alguien lo confirme. Se restaura, se revisa en la vista
    previa y se publica aparte.
    """
    borrador = pagina.borrador
    if borrador is None:
        borrador = VersionPagina.objects.create(
            tenant=pagina.tenant,
            pagina=pagina,
            numero=siguiente_numero(pagina),
            estado=VersionPagina.Estado.BORRADOR,
            composicion=[],
        )

    borrador.composicion = list(version.composicion)
    borrador.nota = f"Restaurada de la versión {version.numero}."
    borrador.autor = autor
    borrador.save(update_fields=["composicion", "nota", "autor"])
    return borrador


def adoptar_plantilla(
    tenant, plantilla, *, autor=None, publicar_ya=False, con_aspecto=True
) -> list:
    """
    Copia las páginas de una plantilla al negocio.

    Copia y no referencia: si la página apuntara a la plantilla, que Crynex
    retocara «Mercado» reescribiría la tienda publicada de todos los clientes
    que la usan. Una tienda en producción no cambia sola.

    Las rutas que el negocio ya tiene se respetan; solo se les crea o actualiza
    el BORRADOR, nunca lo publicado.

    Copia también el ASPECTO —color de marca, tipografía, tokens—. Antes no lo
    hacía, y era un agujero silencioso: adoptar una plantilla traía su maqueta
    pero no su paleta, así que una tienda que estrenaba «boutique» quedaba con
    la portada nueva y la barra verde de la anterior. Nadie veía un error;
    simplemente parecía que la plantilla estaba mal hecha.
    """
    from .aspecto import aplicar_aspecto  # noqa: PLC0415

    # `con_aspecto=False` copia solo la maqueta. Lo pide el Control Center
    # cuando le rediseña la tienda a un cliente que ya tiene su identidad
    # puesta: cambiarle el logotipo de color por estrenar una plantilla sería
    # una decisión de marca tomada por un programador.
    if con_aspecto:
        aplicar_aspecto(tenant, plantilla)

    tocadas = []
    for ruta, composicion in (plantilla.paginas or {}).items():
        pagina, _ = Pagina.objects.get_or_create(
            tenant=tenant,
            ruta=ruta,
            defaults={
                "titulo": titulo_de(ruta),
                "tipo": tipo_de(ruta),
            },
        )
        borrador = obtener_borrador(pagina, autor=autor)
        borrador.composicion = validar(composicion)
        borrador.nota = f"Adoptada de la plantilla «{plantilla.nombre}»."
        borrador.save(update_fields=["composicion", "nota"])

        if publicar_ya:
            publicar(pagina, autor=autor)
        tocadas.append(pagina)
    return tocadas


def tipo_de(ruta: str):
    """
    Qué clase de página es esta ruta.

    El armazón se reconoce por su ruta reservada. Sin esto, adoptar una
    plantilla que traiga `/_layout` lo crearía como página LIBRE, y entonces
    aparecería en el listado de rutas públicas: Next generaría una página con
    la cabecera y el pie sueltos, y el buscador acabaría indexándola.
    """
    if ruta == Pagina.RUTA_LAYOUT:
        return Pagina.Tipo.LAYOUT
    if ruta == "/":
        return Pagina.Tipo.HOME
    return Pagina.Tipo.LIBRE


def titulo_de(ruta: str) -> str:
    if ruta == Pagina.RUTA_LAYOUT:
        return "Cabecera y pie"
    return ruta.strip("/").capitalize() or "Inicio"
