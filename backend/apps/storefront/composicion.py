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
                # Ausente significa visible: una página escrita a mano no
                # debería desaparecer por no declarar los tres dispositivos.
                "visible": {
                    d: bool(visible.get(d, True)) for d in DISPOSITIVOS
                },
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


def adoptar_plantilla(tenant, plantilla, *, autor=None, publicar_ya=False) -> list:
    """
    Copia las páginas de una plantilla al negocio.

    Copia y no referencia: si la página apuntara a la plantilla, que Crynex
    retocara «Mercado» reescribiría la tienda publicada de todos los clientes
    que la usan. Una tienda en producción no cambia sola.

    Las rutas que el negocio ya tiene se respetan; solo se les crea o actualiza
    el BORRADOR, nunca lo publicado.
    """
    tocadas = []
    for ruta, composicion in (plantilla.paginas or {}).items():
        pagina, _ = Pagina.objects.get_or_create(
            tenant=tenant,
            ruta=ruta,
            defaults={
                "titulo": ruta.strip("/").capitalize() or "Inicio",
                "tipo": Pagina.Tipo.HOME if ruta == "/" else Pagina.Tipo.LIBRE,
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
