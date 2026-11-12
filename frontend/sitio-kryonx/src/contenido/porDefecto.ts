import bellezaEscritorio from "../assets/demos/belleza-escritorio.webp";
import bellezaMovil from "../assets/demos/belleza-movil.webp";
import cosechaEscritorio from "../assets/demos/cosecha-escritorio.webp";
import cosechaMovil from "../assets/demos/cosecha-movil.webp";
import { temas } from "./temas";
import type { ContenidoSitio } from "./tipos";

/**
 * El contenido con el que el sitio sale mientras no se administre desde el
 * panel. Es un dato como cualquier otro: si mañana llega del backend, este
 * archivo pasa a ser el respaldo para cuando el backend no responde.
 *
 * Reglas que este contenido respeta, y que conviene mantener al editarlo:
 *  - No hay precios, clientes, testimonios, cifras ni resultados comerciales
 *    inventados. Si no existen, cada plan lleva a una cotización.
 *  - Solo se afirma lo que el producto hace hoy.
 *  - Lo REAL (`tipo: "real"`) y lo CONCEPTUAL (`tipo: "concepto"`) se rotulan
 *    distinto: una maqueta nunca se presenta como proyecto realizado.
 */

export const contenidoPorDefecto: ContenidoSitio = {
  temas,

  navegacion: {
    enlaces: [
      { etiqueta: "Inicio", href: "#inicio" },
      { etiqueta: "Experiencias", href: "#experiencias" },
      { etiqueta: "Proyectos", href: "#proyectos" },
      { etiqueta: "Nosotros", href: "#proceso" },
    ],
    soluciones: [
      {
        solucion: "commerce",
        nombre: "Commerce",
        detalle: "Tu tienda online, administrada por ti",
        href: "#caminos",
      },
      {
        solucion: "custom",
        nombre: "Custom",
        detalle: "Una experiencia hecha solo para tu marca",
        href: "#caminos",
      },
      {
        solucion: "growth",
        nombre: "Growth",
        detalle: "Soporte y evolución continua",
        href: "#planes",
      },
    ],
    cta: { etiqueta: "Empezar", href: "#contacto", origen: "navegacion" },
  },

  secciones: [
    /* 01 · Hero */
    {
      tipo: "hero",
      id: "inicio",
      visible: true,
      datos: {
        lema: "Your vision. Our technology. Your digital future.",
        titulo: "Tu negocio merece una experiencia digital",
        destacado: "extraordinaria.",
        subtitulo:
          "Creamos tiendas online personalizadas para marcas que quieren diferenciarse, conectar con sus clientes y vender sin límites.",
        ctaPrincipal: { etiqueta: "Crear mi tienda", href: "#contacto", solucion: "commerce", origen: "hero" },
        ctaSecundario: { etiqueta: "Explorar proyectos", href: "#proyectos", origen: "hero" },
        temas: ["moda", "tecnologia", "alimentos", "belleza"],
        dominio: "tutienda.crafteech.com",
      },
    },

    /* 02 · Dos caminos, una marca */
    {
      tipo: "caminos",
      id: "caminos",
      visible: true,
      datos: {
        etiqueta: "02 · Dos caminos, una marca",
        titulo: "Dos caminos,",
        destacado: "una marca.",
        descripcion:
          "Elige cómo quieres construir tu presencia digital: administrar tu propia tienda o desarrollar una experiencia exclusiva para tu marca.",
        commerce: {
          solucion: "commerce",
          nombre: "Crafteech Commerce",
          frase: "Tu tienda. Tu negocio. Tu control.",
          descripcion:
            "Una tienda online que creas y administras tú mismo, sin depender de nadie para cambiar un precio, publicar un producto o atender un pedido.",
          beneficios: [
            "Autonomía para administrar tu negocio",
            "Experiencia responsive en celular, tablet y escritorio",
            "Personalización visual dentro de las capacidades de tu plan",
          ],
          funciones: [
            "Gestión de productos, categorías, presentaciones y precios",
            "Administración de pedidos y clientes",
            "Herramientas para gestionar tu comercio digital",
          ],
          diferencia: "La administras tú: con las capacidades que incluye tu plan.",
          cta: { etiqueta: "Quiero mi tienda", href: "#contacto", solucion: "commerce", origen: "caminos-commerce" },
        },
        custom: {
          solucion: "custom",
          nombre: "Crafteech Custom",
          frase: "Una experiencia digital construida exclusivamente para tu marca.",
          descripcion:
            "Diseñamos y desarrollamos tu tienda desde cero, a partir de la identidad y del modelo de negocio de tu marca.",
          beneficios: [
            "Diseño exclusivo basado en la identidad de tu marca",
            "Funcionalidades particulares según tu modelo de negocio",
            "Arquitectura digital adaptada a tu empresa",
          ],
          funciones: [
            "Integraciones con sistemas externos",
            "Experiencias comerciales y flujos de trabajo especiales",
            "Desarrollo a la medida de lo que tu negocio necesita",
          ],
          diferencia: "La construimos nosotros: sin plantillas y a tu medida.",
          cta: { etiqueta: "Cuéntanos tu idea", href: "#contacto", solucion: "custom", origen: "caminos-custom" },
        },
      },
    },

    /* 03 · Experiencias por industria */
    {
      tipo: "experiencias",
      id: "experiencias",
      visible: true,
      datos: {
        etiqueta: "03 · Experiencias por industria",
        titulo: "Cada negocio,",
        destacado: "su propia personalidad.",
        descripcion:
          "Una misma tecnología, tiendas que no se parecen. Son maquetas conceptuales de cómo puede verse cada industria.",
        industrias: [
          {
            id: "fashion",
            nombre: "Fashion & Lifestyle",
            tema: "moda",
            descripcion: "Editorial, serif y mucho aire: la tienda se lee como una revista.",
          },
          {
            id: "food",
            nombre: "Food & Market",
            tema: "alimentos",
            descripcion: "Producto fresco, presentaciones claras y pedidos ágiles.",
          },
          {
            id: "beauty",
            nombre: "Beauty & Care",
            tema: "belleza",
            descripcion: "Tonos suaves, categorías con iconos y una compra pensada para el celular.",
          },
          {
            id: "tech",
            nombre: "Technology",
            tema: "tecnologia",
            descripcion: "Modo oscuro, acentos de neón y fichas técnicas fáciles de comparar.",
          },
          {
            id: "otros",
            nombre: "Otros comercios",
            tema: "retail",
            descripcion: "Catálogos amplios, promociones y filtros para cualquier otro negocio.",
          },
        ],
      },
    },

    /* 04 · Personalización real */
    {
      tipo: "personalizacion",
      id: "personalizacion",
      visible: true,
      datos: {
        etiqueta: "04 · Personalización real",
        titulo: "Tu marca. Tus reglas.",
        destacado: "Tu experiencia.",
        descripcion:
          "Cambia los colores, la tipografía, las tarjetas, el banner y las secciones de esta tienda de ejemplo, y míralo en escritorio y en móvil.",
        tema: "belleza",
        paletas: [
          { nombre: "Rosa", acento: "#d4567a" },
          { nombre: "Violeta", acento: "#7c4dff" },
          { nombre: "Esmeralda", acento: "#0f8b6c" },
          { nombre: "Naranja", acento: "#e2572b" },
          { nombre: "Azul noche", acento: "#1f2a44" },
        ],
        fuentes: ["display", "editorial", "grotesca", "sans"],
        anuncios: [
          "Muestras gratis en cada pedido",
          "Nueva colección: Ritual de noche",
          "Envío en 24 h a todo el país",
        ],
        aviso:
          "Es una demostración independiente del producto: lo que cambies aquí no modifica ninguna tienda real.",
      },
    },

    /* 05 · Proyectos destacados */
    {
      tipo: "proyectos",
      id: "proyectos",
      visible: true,
      datos: {
        etiqueta: "05 · Proyectos destacados",
        titulo: "Una tienda real,",
        destacado: "funcionando hoy.",
        descripcion:
          "La Gran Cosecha es nuestro primer caso de referencia: una experiencia de comercio digital diseñada para facilitar la gestión de productos, presentaciones, precios y pedidos.",
        casos: [
          {
            id: "la-gran-cosecha",
            tipo: "real",
            nombre: "La Gran Cosecha",
            rubro: "Frutas y verduras · Soacha, Cundinamarca",
            reto:
              "Vender más de 190 productos frescos a hogares y negocios, cada uno con varias formas de compra (libra, kilo, bulto o unidad) y precios que dependen del mercado.",
            solucion:
              "Una tienda propia con catálogo filtrable, presentaciones y precios por unidad, pedido en línea y un panel con el que el negocio administra sus productos, precios y pedidos por su cuenta.",
            funcionalidades: [
              "Catálogo de más de 190 productos con filtros",
              "Presentaciones y precios por libra, kilo, bulto o unidad",
              "Carrito y pedido en línea",
              "Contacto y pedidos por WhatsApp",
              "Panel para administrar productos, precios y pedidos",
              "Experiencia responsive",
            ],
            dominio: "la-gran-cosecha.crafteech.com",
            escritorio: cosechaEscritorio,
            movil: cosechaMovil,
            recorrido: 70,
            enlace: {
              etiqueta: "Visitar La Gran Cosecha",
              href: "https://la-gran-cosecha.crafteech.com",
              origen: "proyecto-la-gran-cosecha",
            },
          },
          {
            id: "boutique",
            tipo: "concepto",
            nombre: "Boutique",
            rubro: "Belleza y cuidado personal · Demostración conceptual",
            reto: "Mostrar cómo se vería una tienda de cosmética pensada primero para el celular.",
            solucion:
              "Una demostración conceptual sobre la plantilla de belleza de Crafteech Commerce: paleta, tipografía y menú propios. No es un proyecto realizado para un cliente.",
            funcionalidades: [
              "Menú por categorías con iconos",
              "Barra de confianza",
              "Paleta y tipografía propias",
              "Diseño pensado primero para el móvil",
            ],
            dominio: "tu-boutique.ejemplo.com",
            escritorio: bellezaEscritorio,
            movil: bellezaMovil,
            recorrido: 16,
          },
        ],
      },
    },

    /* 06 · Proceso */
    {
      tipo: "proceso",
      id: "proceso",
      visible: true,
      datos: {
        etiqueta: "06 · Proceso de trabajo",
        titulo: "De la idea",
        destacado: "al lanzamiento.",
        descripcion: "Cuatro etapas y una conversación constante contigo.",
        etapas: [
          {
            numero: "01",
            titulo: "Descubrimos",
            texto: "Entendemos tu negocio, tus objetivos y tus necesidades.",
          },
          {
            numero: "02",
            titulo: "Diseñamos",
            texto: "Creamos una experiencia visual alineada con tu marca.",
          },
          {
            numero: "03",
            titulo: "Desarrollamos",
            texto: "Construimos, integramos y probamos tu solución.",
          },
          {
            numero: "04",
            titulo: "Lanzamos",
            texto: "Publicamos tu proyecto y te acompañamos en su evolución.",
          },
        ],
      },
    },

    /* 07 · Soluciones y planes */
    {
      tipo: "soluciones",
      id: "planes",
      visible: true,
      datos: {
        etiqueta: "07 · Soluciones y planes",
        titulo: "Tres formas de",
        destacado: "trabajar contigo.",
        descripcion:
          "Una suscripción, un desarrollo a la medida o un acompañamiento recurrente. Cada una tiene su propio camino y todas empiezan con una conversación.",
        planes: [
          {
            solucion: "commerce",
            nombre: "Commerce",
            modelo: "Suscripción",
            descripcion: "Tu tienda online lista para que la administres tú.",
            incluye: [
              "Tienda autogestionable",
              "Productos, categorías, presentaciones y precios",
              "Pedidos y clientes",
              "Personalización visual según tu plan",
            ],
            cta: { etiqueta: "Cotizar Commerce", href: "#contacto", solucion: "commerce", origen: "planes-commerce" },
          },
          {
            solucion: "custom",
            nombre: "Custom",
            modelo: "Desarrollo a la medida",
            descripcion: "Una solución construida para tu marca, de principio a fin.",
            incluye: [
              "Diseño exclusivo para tu identidad",
              "Funcionalidades según tu modelo de negocio",
              "Integraciones con sistemas externos",
              "Flujos y experiencias comerciales especiales",
            ],
            cta: { etiqueta: "Cotizar Custom", href: "#contacto", solucion: "custom", origen: "planes-custom" },
            destacado: true,
          },
          {
            solucion: "growth",
            nombre: "Growth",
            modelo: "Acompañamiento recurrente",
            descripcion: "Tu solución sigue evolucionando después del lanzamiento.",
            incluye: [
              "Mantenimiento y soporte",
              "Mejoras funcionales",
              "Optimización de experiencias",
              "Nuevas integraciones",
            ],
            cta: { etiqueta: "Cotizar Growth", href: "#contacto", solucion: "growth", origen: "planes-growth" },
          },
        ],
        nota: "No publicamos precios: cada proyecto se cotiza según lo que necesites. Escríbenos y te respondemos con una propuesta.",
      },
    },

    /* 08 · Cierre y contacto */
    {
      tipo: "contacto",
      id: "contacto",
      visible: true,
      datos: {
        titulo: "El siguiente gran paso de tu negocio",
        destacado: "empieza aquí.",
        texto: "Cuéntanos qué quieres construir. Nosotros te ayudamos a hacerlo realidad.",
        opciones: [
          { valor: "commerce", etiqueta: "Crear mi tienda · Commerce" },
          { valor: "custom", etiqueta: "Desarrollo personalizado · Custom" },
          { valor: "growth", etiqueta: "Soporte y evolución · Growth" },
          { valor: "por_definir", etiqueta: "Aún no lo sé" },
        ],
        whatsapp: "Hablar por WhatsApp",
      },
    },
  ],

  pie: {
    lema: "Your vision. Our technology. Your digital future.",
    enlaces: [
      { etiqueta: "Soluciones", href: "#caminos" },
      { etiqueta: "Experiencias", href: "#experiencias" },
      { etiqueta: "Proyectos", href: "#proyectos" },
      { etiqueta: "Proceso", href: "#proceso" },
      { etiqueta: "Contacto", href: "#contacto" },
    ],
    legal: "Crafteech. Todos los derechos reservados.",
  },
};
