"""
Qué preset le conviene a un negocio que acaba de darse de alta.

Reglas y puntuación, cuarenta líneas y ninguna dependencia. No es un motor de
recomendación y no debe llegar a serlo.

# Cuándo corre: UNA VEZ, en el alta

Y su resultado se copia. Nunca al pintar una página ni al abrir el panel. Un
algoritmo que se ejecutara en cada visita haría que la configuración de un
cliente cambiara sola el día que Crynex añadiera un preset nuevo — y nadie
podría explicarle por qué su tienda amaneció distinta.

# Por qué devuelve tres y no uno

Devuelve candidatos CON SU PORQUÉ y una persona elige. Un asistente que acierta
con explicación vale más que uno que acierta a ciegas: cuando se equivoca, la
explicación dice en qué señal se equivocó, y eso es lo que permite calibrar los
pesos sin adivinar. Es también lo que hará auditable a la IA cuando llegue: su
trabajo será rellenar estas respuestas, no elegir el preset.
"""
from .models import Preset

#: Cuánto pesa que el sector declarado coincida. Alto, porque quien contesta
#: «ferretería» casi siempre sabe lo que dice — pero no decisivo por sí solo:
#: las señales describen cómo TRABAJA el negocio, y eso manda sobre la etiqueta.
PESO_SECTOR = 40

#: Cuánto suma cada señal que coincide, multiplicado por el peso del preset.
PESO_SENAL = 10

#: Cuánto resta cada módulo que el preset pide y el plan no cubre.
#:
#: DESEMPATA, no descarta, y la diferencia se descubrió construyendo el POS: con
#: la penalización dentro de la puntuación, una ferretería de manual —código de
#: barras, cobro en mostrador— dejaba de reconocerse como ferretería en cuanto
#: su plan no incluía la caja, y el alta le proponía «Mercado». Absurdo: no
#: tener contratado el POS no lo convierte en una frutería.
#:
#: Son dos preguntas distintas y ahora se responden por separado:
#:   ¿describe a este negocio?   -> `puntos`, y es lo que cruza el umbral
#:   ¿puede usarlo entero hoy?   -> `penalizacion`, y solo ordena
#: Lo que falte se muestra en pantalla (`modulos_no_cubiertos`), que es la forma
#: honesta de avisar: se configura igual, sin eso, y el cliente lo sabe.
PENALIZACION_MODULO = 25

#: Por debajo de esto no hay candidato convincente y se cae al predeterminado.
#: Adivinar es justo el fallo contra el que se diseñó todo esto.
UMBRAL = 30


def sugerir(respuestas, *, modulos_disponibles=None, limite=3) -> list:
    """
    Los mejores presets para estas respuestas, mejor primero.

    Devuelve `[{preset, puntos, penalizacion, motivos, modulos_no_cubiertos}]`.
    `respuestas`
    es lo que se contestó en el alta: `{"sector": "ferreteria",
    "usa_codigo_barras": true, "vende_por_peso": false}`.
    """
    respuestas = respuestas or {}
    disponibles = set(modulos_disponibles or [])
    sector = (respuestas.get("sector") or "").strip().lower()

    candidatos = []
    for preset in Preset.objects.filter(activo=True):
        puntos = 0
        motivos = []

        if sector and preset.slug.lower() == sector:
            puntos += PESO_SECTOR
            motivos.append(f"Dijiste que tu negocio es «{preset.nombre}»")

        # Las señales son la inteligencia real: preguntan cómo trabaja el
        # negocio, no cómo se llama. Se editan desde el panel de Crynex.
        for senal, peso in (preset.senales or {}).items():
            if respuestas.get(senal):
                puntos += PESO_SENAL * int(peso or 1)
                motivos.append(ETIQUETAS_DE_SENAL.get(senal, senal))

        no_cubiertos = [m for m in (preset.modulos or []) if m not in disponibles]
        # Solo se penaliza si sabemos qué cubre el plan. Sin ese dato, la resta
        # castigaría por igual a todos y solo añadiría ruido.
        penalizacion = PENALIZACION_MODULO * len(no_cubiertos) if disponibles else 0

        candidatos.append(
            {
                "preset": preset,
                "puntos": puntos,
                "penalizacion": penalizacion,
                "motivos": motivos,
                "modulos_no_cubiertos": no_cubiertos,
            }
        )

    candidatos.sort(
        key=lambda c: (
            -(c["puntos"] - c["penalizacion"]),
            c["preset"].orden,
            c["preset"].pk,
        )
    )

    if not candidatos or candidatos[0]["puntos"] < UMBRAL:
        respaldo = predeterminado()
        if respaldo is None:
            return []
        return [
            {
                "preset": respaldo,
                "puntos": 0,
                "penalizacion": 0,
                "motivos": ["Ninguna opción encajaba claramente; esta es la general"],
                "modulos_no_cubiertos": [],
            }
        ]

    return candidatos[:limite]


def predeterminado():
    """
    El preset al que cae un alta sin candidato claro.

    La base garantiza que haya como mucho uno. Si no hay ninguno, se devuelve
    None y quien llama decide: es preferible a inventarse uno, porque un
    negocio configurado con un preset arbitrario se comporta de forma que nadie
    pidió y cuesta más de deshacer que de no hacer.
    """
    return Preset.objects.filter(es_predeterminado=True, activo=True).first()


#: Cómo se lee cada señal en la explicación. Vive aquí y no en la base porque
#: es texto de interfaz: las señales las define cada preset, pero la frase que
#: ve la persona es una sola para toda la plataforma.
ETIQUETAS_DE_SENAL = {
    "vende_por_peso": "Vendes por peso o fracción",
    "usa_codigo_barras": "Usas código de barras",
    "cobra_en_mostrador": "Cobras en el mostrador",
    "acepta_pedidos_online": "Recibes pedidos por internet",
    "controla_stock": "Llevas cuenta de existencias",
    "tiene_mesas": "Atiendes en mesas",
    "productos_con_variantes": "El mismo producto viene en tallas o colores",
    "catalogo_grande": "Manejas cientos de referencias",
}

#: Las preguntas del alta, en orden. Son las mismas que la IA rellenará más
#: adelante a partir de una descripción en texto libre; por eso son pocas,
#: concretas y contestables por cualquiera sin saber de software.
PREGUNTAS_DEL_ALTA = [
    {"codigo": "vende_por_peso", "texto": "¿Vendes por peso, litros o fracciones?"},
    {"codigo": "usa_codigo_barras", "texto": "¿Tus productos traen código de barras?"},
    {"codigo": "cobra_en_mostrador", "texto": "¿Cobras en un mostrador o caja?"},
    {"codigo": "acepta_pedidos_online", "texto": "¿Quieres recibir pedidos por internet?"},
    {"codigo": "controla_stock", "texto": "¿Necesitas saber cuánto te queda de cada cosa?"},
    {"codigo": "tiene_mesas", "texto": "¿Atiendes clientes en mesas?"},
    {
        "codigo": "productos_con_variantes",
        "texto": "¿El mismo producto viene en tallas, colores o presentaciones?",
    },
    {"codigo": "catalogo_grande", "texto": "¿Manejas más de doscientas referencias?"},
]
