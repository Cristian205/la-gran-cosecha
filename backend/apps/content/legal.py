"""
El contenido del centro legal de una tienda: `StoreSettings.legal`.

Forma (todas las claves son opcionales; lo que falte lo completa la tienda con
los datos de contacto del negocio o lo marca como «por completar»):

    empresa       razon_social, nit, direccion, ciudad, departamento,
                  representante_legal, matricula_mercantil
    contacto      correo_atencion, correo_datos_personales, telefono,
                  whatsapp, horario_atencion, direccion_notificaciones
    envios        cobertura (lista), horarios, tiempos, costos, pedido_minimo,
                  condiciones, perecederos, retrasos, confirmacion, requisitos
    devoluciones  plazo_cambios, plazo_reporte, condiciones, excepciones,
                  reembolso, costos_devolucion, tiempo_respuesta
    pagos         metodos (lista de {id, nombre, descripcion, activo}),
                  confirmacion, seguridad
    pedidos       ajuste_precio, cancelacion
    politicas     {<slug>: {titulo, resumen, secciones, actualizado, historial}}

`politicas` es lo que el negocio reescribió de cada política. Sin entrada, la
tienda usa su texto por defecto. `historial` lo lleva el SERVIDOR: cada vez
que cambia el contenido de una política —o los datos que la alimentan— se
anota la fecha y el motivo (`nota_cambio`, que el panel manda junto al cambio
y no se guarda suelto). Una política legal sin registro de versiones no deja
demostrar qué aceptó un cliente en una fecha dada.
"""
from __future__ import annotations

import copy
import json
import re
from datetime import date

SECCIONES = ("empresa", "contacto", "envios", "devoluciones", "pagos", "pedidos", "politicas")

#: Qué políticas cambian cuando cambian los datos de una sección. Los datos de
#: empresa y contacto no están: son identidad, no condiciones, y anotar nueve
#: «actualizaciones» por un cambio de teléfono ensuciaría el historial.
POLITICAS_POR_SECCION = {
    "envios": ("politica-de-envios",),
    "devoluciones": ("cambios-y-devoluciones", "politica-de-retracto"),
    "pagos": ("medios-de-pago",),
    "pedidos": ("terminos-y-condiciones",),
}

#: Lo que define el contenido de una política. `actualizado` e `historial` no
#: cuentan: son la consecuencia del cambio, no el cambio.
CAMPOS_DE_CONTENIDO = ("titulo", "resumen", "secciones")

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TAMANO_MAXIMO = 300_000  # bytes de JSON: varias políticas reescritas enteras caben de sobra.


class ContenidoLegalInvalido(ValueError):
    pass


def validar(entrada) -> dict:
    """Comprueba la forma de lo que llega del panel. No toca el contenido."""
    if not isinstance(entrada, dict):
        raise ContenidoLegalInvalido("El contenido legal debe ser un objeto.")
    desconocidas = set(entrada) - set(SECCIONES)
    if desconocidas:
        raise ContenidoLegalInvalido(f"Claves no reconocidas: {', '.join(sorted(desconocidas))}.")
    for seccion, valor in entrada.items():
        if not isinstance(valor, dict):
            raise ContenidoLegalInvalido(f"«{seccion}» debe ser un objeto.")
    for slug, politica in entrada.get("politicas", {}).items():
        if not SLUG.match(slug):
            raise ContenidoLegalInvalido(f"«{slug}» no es un identificador de política válido.")
        if not isinstance(politica, dict):
            raise ContenidoLegalInvalido(f"La política «{slug}» debe ser un objeto.")
        fecha = politica.get("actualizado")
        if fecha and not FECHA.match(str(fecha)):
            raise ContenidoLegalInvalido(f"La fecha de «{slug}» debe tener el formato AAAA-MM-DD.")
    if len(json.dumps(entrada, ensure_ascii=False).encode()) > TAMANO_MAXIMO:
        raise ContenidoLegalInvalido("El contenido legal es demasiado grande.")
    return entrada


def combinar(anterior: dict, cambios: dict, hoy: date | None = None) -> dict:
    """
    Aplica un PATCH del panel y anota en el historial lo que cambió.

    Cada sección que llega reemplaza a la guardada; en `politicas`, cada
    política que llega reemplaza a la suya y las demás se conservan. El
    historial de cada política se conserva siempre del lado del servidor: el
    panel no lo puede reescribir.
    """
    hoy = hoy or date.today()
    anterior = copy.deepcopy(anterior or {})
    cambios = copy.deepcopy(validar(cambios))
    resultado = {**anterior}

    politicas_previas = anterior.get("politicas", {})
    politicas = {**politicas_previas}
    # Motivo por política. Se inicializa con lo que cambió en los datos.
    por_anotar: dict[str, str] = {}

    for seccion, valor in cambios.items():
        if seccion == "politicas":
            continue
        if valor != anterior.get(seccion):
            for slug in POLITICAS_POR_SECCION.get(seccion, ()):
                por_anotar.setdefault(slug, "Actualización de las condiciones")
        resultado[seccion] = valor

    # Fechas que el panel cambió a propósito (p. ej. una versión que entra en
    # vigor otro día). Si no cambió la fecha, la pone el servidor.
    fechas_elegidas: dict[str, str] = {}

    for slug, nueva in cambios.get("politicas", {}).items():
        previa = politicas_previas.get(slug, {})
        nota = str(nueva.pop("nota_cambio", "") or "").strip()
        nueva.pop("historial", None)
        fecha_enviada = nueva.pop("actualizado", None)
        if fecha_enviada and fecha_enviada != previa.get("actualizado"):
            fechas_elegidas[slug] = fecha_enviada

        cambio_contenido = any(nueva.get(c) != previa.get(c) for c in CAMPOS_DE_CONTENIDO)
        if nota or cambio_contenido or slug in fechas_elegidas:
            por_anotar[slug] = nota or "Actualización del contenido"

        politicas[slug] = {**nueva, "historial": previa.get("historial", [])}
        if previa.get("actualizado"):
            politicas[slug]["actualizado"] = previa["actualizado"]

    for slug, motivo in por_anotar.items():
        politica = politicas.setdefault(slug, {"historial": []})
        fecha = fechas_elegidas.get(slug, hoy.isoformat())
        politica["actualizado"] = fecha
        politica["historial"] = [*politica.get("historial", []), {"fecha": fecha, "cambio": motivo}]

    if politicas or "politicas" in anterior:
        resultado["politicas"] = politicas
    return resultado
