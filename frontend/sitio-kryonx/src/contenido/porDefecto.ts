import bellezaEscritorio from "../assets/demos/belleza-escritorio.webp";
import bellezaMovil from "../assets/demos/belleza-movil.webp";
import cosechaEscritorio from "../assets/demos/cosecha-escritorio.webp";
import cosechaMovil from "../assets/demos/cosecha-movil.webp";
import type { Campana, CasoDemostracion, ContenidoSitio, TemaTienda } from "./tipos";

/**
 * El contenido con el que el sitio sale mientras no se administre desde el
 * panel. Es un dato como cualquier otro: si mañana llega del backend, este
 * archivo pasa a ser el respaldo para cuando el backend no responde.
 */

const CREAR_TIENDA = import.meta.env.VITE_URL_CREAR_TIENDA || "#empezar";

/* ------------------------------------------------------------------ */
/* Identidades de tienda                                               */
/* ------------------------------------------------------------------ */

const temas: TemaTienda[] = [
  {
    id: "moda",
    rubro: "Moda",
    nombre: "Maison Nera",
    rasgos: ["Serif editorial", "Monocromo cálido", "Sin bordes"],
    fondo: "#f4f0ea",
    superficie: "#e9e2d7",
    texto: "#151311",
    tenue: "#756c62",
    acento: "#151311",
    sobreAcento: "#f4f0ea",
    fuente: "editorial",
    radio: 0,
    mayusculas: true,
    anuncio: "Envíos sin costo desde $250.000",
    hero: {
      antetitulo: "Colección Otoño 26",
      titulo: "La forma del silencio",
      cta: "Descubrir",
      objeto: ["#cbb9a2", "#7f6a55"],
      forma: "arco",
    },
    categorias: ["Mujer", "Hombre", "Accesorios", "Nuevo"],
    productos: [
      { nombre: "Abrigo de lana", precio: "$389.000", color: ["#4a433c", "#1d1a17"], forma: "capsula" },
      { nombre: "Bolso Arco", precio: "$214.000", color: ["#b9946f", "#7a5c40"], forma: "arco" },
      { nombre: "Camisa lino", precio: "$129.000", color: ["#e9e1d5", "#c4b9a9"], forma: "cubo" },
      { nombre: "Botín Nera", precio: "$298.000", color: ["#5d4c3e", "#2c241d"], forma: "gota" },
    ],
    promo: { titulo: "Edición limitada", texto: "Piezas numeradas, solo en línea" },
  },
  {
    id: "tecnologia",
    rubro: "Tecnología",
    nombre: "Volt Lab",
    rasgos: ["Modo oscuro", "Acento neón", "Grotesca técnica"],
    fondo: "#07090f",
    superficie: "#121726",
    texto: "#eef2ff",
    tenue: "#7d86a3",
    acento: "#4cf2c2",
    sobreAcento: "#04140f",
    fuente: "grotesca",
    radio: 0.9,
    anuncio: "Hasta 12 cuotas sin intereses",
    hero: {
      antetitulo: "Nuevo · Serie X",
      titulo: "Potencia que se siente.",
      cta: "Comprar ahora",
      objeto: ["#4cf2c2", "#3d5cff"],
      forma: "cubo",
    },
    categorias: ["Audio", "Wearables", "Gaming", "Hogar"],
    productos: [
      { nombre: "Audífonos ANC", precio: "$649.900", color: ["#36406a", "#141a2e"], forma: "circulo" },
      { nombre: "Reloj Pulse", precio: "$489.900", color: ["#4cf2c2", "#1f8f78"], forma: "capsula" },
      { nombre: "Control Pro", precio: "$289.900", color: ["#5468ff", "#2a35a8"], forma: "arco" },
      { nombre: "Parlante Orb", precio: "$359.900", color: ["#2a3150", "#0b0e18"], forma: "botella" },
    ],
    promo: { titulo: "Plan renueva", texto: "Entrega tu equipo y estrena hoy" },
  },
  {
    id: "alimentos",
    rubro: "Alimentos",
    nombre: "Huerta Viva",
    rasgos: ["Serif amable", "Tonos tierra", "Bordes suaves"],
    fondo: "#fbf6ec",
    superficie: "#f1e6cf",
    texto: "#23301f",
    tenue: "#6d7464",
    acento: "#2f6b3a",
    sobreAcento: "#fbf6ec",
    fuente: "serif",
    radio: 1.4,
    anuncio: "Pide antes de las 11 a. m. y recíbelo hoy",
    hero: {
      antetitulo: "Del campo a tu mesa",
      titulo: "Fresco, de temporada y cerca.",
      cta: "Hacer mi pedido",
      objeto: ["#ffb347", "#d9542b"],
      forma: "circulo",
    },
    categorias: ["Frutas", "Verduras", "Despensa", "Lácteos"],
    productos: [
      { nombre: "Mango de azúcar", precio: "$6.900 kg", color: ["#ffc145", "#f07f2a"], forma: "gota" },
      { nombre: "Aguacate Hass", precio: "$9.800 kg", color: ["#8bb04a", "#3f6b2a"], forma: "gota" },
      { nombre: "Fresas", precio: "$7.500", color: ["#ff6b6b", "#c52b3d"], forma: "circulo" },
      { nombre: "Miel de abejas", precio: "$18.900", color: ["#f4b63b", "#c97a12"], forma: "botella" },
    ],
    promo: { titulo: "Martes de cosecha", texto: "15% en frutas y verduras" },
  },
  {
    id: "belleza",
    rubro: "Belleza",
    nombre: "Lumière",
    rasgos: ["Display elegante", "Rosa empolvado", "Formas redondas"],
    fondo: "#fdf2f2",
    superficie: "#f7e0e2",
    texto: "#3a1d27",
    tenue: "#8a6470",
    acento: "#d4567a",
    sobreAcento: "#ffffff",
    fuente: "display",
    radio: 2.2,
    anuncio: "Muestras gratis en cada pedido",
    hero: {
      antetitulo: "Ritual de noche",
      titulo: "Tu piel, en su mejor luz.",
      cta: "Ver rutina",
      objeto: ["#ffd1dc", "#e27396"],
      forma: "botella",
    },
    categorias: ["Skincare", "Maquillaje", "Fragancias", "Sets"],
    productos: [
      { nombre: "Sérum Rosé", precio: "$124.000", color: ["#ffc2d1", "#e88aa5"], forma: "botella" },
      { nombre: "Crema Nube", precio: "$98.000", color: ["#fff1e6", "#f1c9b3"], forma: "circulo" },
      { nombre: "Labial Velvet", precio: "$62.000", color: ["#d9577a", "#9c2d4f"], forma: "capsula" },
      { nombre: "Eau Lumière", precio: "$236.000", color: ["#f6d6a8", "#d79b5a"], forma: "botella" },
    ],
    promo: { titulo: "Regalo con tu compra", texto: "Neceser exclusivo desde $180.000" },
  },
  {
    id: "retail",
    rubro: "Retail",
    nombre: "MEGA",
    rasgos: ["Contraste alto", "Mayúsculas", "Ritmo de oferta"],
    fondo: "#ffffff",
    superficie: "#f1f1f1",
    texto: "#111111",
    tenue: "#666666",
    acento: "#ffd400",
    sobreAcento: "#111111",
    fuente: "sans",
    radio: 0.4,
    mayusculas: true,
    anuncio: "Llega hoy en tu ciudad",
    hero: {
      antetitulo: "Solo esta semana",
      titulo: "Precios que no se repiten.",
      cta: "Ver ofertas",
      objeto: ["#ffd400", "#ff8a00"],
      forma: "cubo",
    },
    categorias: ["Hogar", "Tecnología", "Deportes", "Mercado"],
    productos: [
      { nombre: "Licuadora 3V", precio: "$189.900", color: ["#ff5252", "#b81d1d"], forma: "botella" },
      { nombre: "Silla Loft", precio: "$249.900", color: ["#3a3a3a", "#000000"], forma: "arco" },
      { nombre: "Balón Pro", precio: "$79.900", color: ["#ffd400", "#e0a800"], forma: "circulo" },
      { nombre: "Lámpara Halo", precio: "$119.900", color: ["#4d7cff", "#1c3fb8"], forma: "gota" },
    ],
    promo: { titulo: "Días MEGA", texto: "Hasta 50% en miles de productos" },
  },
  {
    id: "servicios",
    rubro: "Servicios",
    nombre: "Norte Estudio",
    rasgos: ["Sans corporativa", "Azul sereno", "Agenda en línea"],
    fondo: "#f3f6fb",
    superficie: "#e2e9f5",
    texto: "#0f1f3a",
    tenue: "#5b6b85",
    acento: "#2457d6",
    sobreAcento: "#ffffff",
    fuente: "sans",
    radio: 1,
    anuncio: "Primera sesión de diagnóstico sin costo",
    hero: {
      antetitulo: "Asesoría y diseño",
      titulo: "Agenda en minutos, sin llamadas.",
      cta: "Reservar cita",
      objeto: ["#9dbcff", "#2457d6"],
      forma: "arco",
    },
    categorias: ["Consultoría", "Diseño", "Talleres", "Planes"],
    productos: [
      { nombre: "Sesión estratégica", precio: "$180.000", color: ["#c9d8ff", "#7d9cf0"], forma: "circulo" },
      { nombre: "Plan mensual", precio: "$890.000", color: ["#2f63e0", "#11308a"], forma: "cubo" },
      { nombre: "Taller de marca", precio: "$320.000", color: ["#9ee0d0", "#3fa58e"], forma: "capsula" },
      { nombre: "Auditoría web", precio: "$450.000", color: ["#ffd59e", "#e89a3c"], forma: "arco" },
    ],
    promo: { titulo: "Planes a la medida", texto: "Combina servicios y ahorra 20%" },
  },
];

/* ------------------------------------------------------------------ */
/* Campañas de ejemplo                                                 */
/* ------------------------------------------------------------------ */

const campanas: Campana[] = [
  {
    id: "hero",
    formato: "hero",
    nombre: "Hero banner",
    fecha: "Siempre activo",
    antetitulo: "Nueva colección",
    titulo: "Diseñado para destacar",
    texto: "Tu portada, con la imagen, el mensaje y el botón que elijas.",
    cta: "Comprar ahora",
    colores: ["#0a0a0c", "#e11d2a"],
    anuncio: "Envío gratis en compras desde $150.000",
  },
  {
    id: "temporada",
    formato: "temporada",
    nombre: "Anuncio de temporada",
    fecha: "1 – 24 dic",
    antetitulo: "Temporada navideña",
    titulo: "Regalos que se recuerdan",
    texto: "Se activa en la fecha que elijas y se retira sola al terminar.",
    cta: "Ver regalos",
    colores: ["#0f3d2e", "#e8c26a"],
    anuncio: "Envoltura de regalo sin costo hasta el 24 de diciembre",
  },
  {
    id: "flash",
    formato: "flash",
    nombre: "Promoción especial",
    fecha: "Hoy · 48 h",
    antetitulo: "Oferta relámpago",
    titulo: "-40%",
    texto: "En toda la línea de audio",
    cta: "Aprovechar",
    colores: ["#ff3d5a", "#ffd23f"],
    anuncio: "Últimas horas: -40% en audio",
  },
  {
    id: "producto",
    formato: "producto",
    nombre: "Campaña de producto",
    fecha: "Lanzamiento · 15 nov",
    antetitulo: "Lanzamiento",
    titulo: "Aura One",
    texto: "Un producto, una historia y una página que lo vende.",
    cta: "Reservar",
    colores: ["#efeaff", "#6a4cff"],
    anuncio: "Preventa abierta: Aura One",
  },
  {
    id: "destacada",
    formato: "destacada",
    nombre: "Publicidad destacada",
    fecha: "Patrocinado",
    antetitulo: "Marca invitada",
    titulo: "Studio Brava × tu tienda",
    texto: "Espacios para marcas aliadas, con su identidad y sin romper la tuya.",
    cta: "Ver colección",
    colores: ["#1a1a1a", "#f5f0e8"],
    anuncio: "Nueva alianza: Studio Brava",
  },
  {
    id: "seccion",
    formato: "seccion",
    nombre: "Sección promocional",
    fecha: "Fines de semana",
    antetitulo: "Solo fines de semana",
    titulo: "Arma tu combo",
    texto: "2×1 · Envío gratis · Regalo sorpresa",
    cta: "Armar combo",
    colores: ["#fff4d6", "#ff7a1a"],
    anuncio: "Este fin de semana: 2×1 en seleccionados",
  },
];

/* ------------------------------------------------------------------ */
/* Tiendas reales                                                      */
/* ------------------------------------------------------------------ */

const casos: CasoDemostracion[] = [
  {
    id: "la-gran-cosecha",
    nombre: "La Gran Cosecha",
    rubro: "Frutas y verduras · Soacha",
    plantilla: "Plantilla La Gran Cosecha",
    descripcion:
      "Abastece hogares y negocios con producto fresco del campo. Su tienda cuenta esa historia con fotografía propia, destaca el producto de la semana y tiene un camino aparte para restaurantes y comercios.",
    rasgos: ["Hero fotográfico a pantalla completa", "Catálogo de más de 190 productos con filtros", "Precios por libra, kilo o unidad", "Pedidos por WhatsApp"],
    dominio: "lagrancosecha.kryonx.co",
    escritorio: cosechaEscritorio,
    movil: cosechaMovil,
    recorrido: 70,
  },
  {
    id: "belleza",
    nombre: "Boutique",
    rubro: "Belleza y cuidado personal",
    plantilla: "Plantilla Belleza",
    descripcion:
      "El mismo motor con otra piel: tonos rosa, tipografía suave y un menú por categorías pensado para cosmética. Ninguna línea de código distinta, solo otra plantilla.",
    rasgos: ["Menú por categorías con iconos", "Barra de confianza", "Paleta y tipografía propias", "Pensada primero para el móvil"],
    dominio: "boutique.kryonx.co",
    escritorio: bellezaEscritorio,
    movil: bellezaMovil,
    recorrido: 16,
  },
];

/* ------------------------------------------------------------------ */
/* La página                                                           */
/* ------------------------------------------------------------------ */

export const contenidoPorDefecto: ContenidoSitio = {
  temas,
  navegacion: {
    enlaces: [
      { etiqueta: "Demostración", href: "#demostracion" },
      { etiqueta: "Constructor", href: "#constructor" },
      { etiqueta: "Campañas", href: "#campanas" },
      { etiqueta: "Tiendas", href: "#tiendas" },
      { etiqueta: "Beneficios", href: "#beneficios" },
    ],
    cta: { etiqueta: "Crear mi tienda", href: CREAR_TIENDA },
  },
  secciones: [
    {
      tipo: "hero",
      id: "inicio",
      visible: true,
      datos: {
        insignia: "Constructor de tiendas online",
        titulo: "Crea tu tienda online",
        destacado: "sin límites.",
        subtitulo:
          "Diseña, personaliza y publica una experiencia de venta profesional con Kryon X. Sin plantillas que se repitan, sin código.",
        ctaPrincipal: { etiqueta: "Crear mi tienda", href: CREAR_TIENDA },
        ctaSecundario: { etiqueta: "Ver cómo funciona", href: "#constructor" },
        temas: ["moda", "tecnologia", "belleza", "alimentos"],
        dominio: "tutienda.kryonx.co",
      },
    },
    {
      tipo: "demostraciones",
      id: "demostracion",
      visible: true,
      datos: {
        etiqueta: "Hecho con Kryon X",
        titulo: "Tiendas reales,",
        destacado: "vendiendo hoy.",
        descripcion:
          "Así se ven dos tiendas generadas con Kryon X: mismo motor, misma plataforma, identidades que no se parecen en nada.",
        casos,
      },
    },
    {
      tipo: "constructor",
      id: "constructor",
      visible: true,
      datos: {
        etiqueta: "Construye tu tienda",
        titulo: "Toca cualquier parte.",
        destacado: "Mírala cambiar al instante.",
        descripcion:
          "Cada zona de tu tienda se edita donde está, y lo que cambias es lo que tus clientes ven.",
        tema: "belleza",
        zonas: [
          { id: "home", nombre: "Home", detalle: "Ordena las secciones de tu portada" },
          { id: "navbar", nombre: "Navbar", detalle: "Logo, menú y accesos" },
          { id: "banners", nombre: "Banners", detalle: "Mensajes que cambias en segundos" },
          { id: "carrusel", nombre: "Carruseles", detalle: "Piezas que rotan solas" },
          { id: "productos", nombre: "Productos", detalle: "Grillas de 2, 3 o 4 columnas" },
          { id: "categorias", nombre: "Categorías", detalle: "Accesos directos al catálogo" },
          { id: "promo", nombre: "Promociones", detalle: "Secciones que enciendes cuando quieras" },
          { id: "footer", nombre: "Footer", detalle: "Contacto, redes y enlaces" },
          { id: "estilo", nombre: "Colores y tipografías", detalle: "Tu identidad en toda la tienda" },
          { id: "componentes", nombre: "Componentes", detalle: "Guarda un bloque y reutilízalo" },
          { id: "contenido", nombre: "Contenido visual", detalle: "Imágenes, textos y ritmo" },
        ],
      },
    },
    {
      tipo: "campanas",
      id: "campanas",
      visible: true,
      datos: {
        etiqueta: "Campañas y anuncios",
        titulo: "No solo construyes una tienda.",
        destacado: "La conviertes en un canal de marketing.",
        descripcion:
          "Banners, temporadas, ofertas y lanzamientos viven dentro de tu tienda, programados por fecha.",
        tema: "tecnologia",
        campanas,
      },
    },
    {
      tipo: "tiendas",
      id: "tiendas",
      visible: true,
      datos: {
        etiqueta: "Una plataforma, infinitas tiendas",
        titulo: "El mismo constructor.",
        destacado: "Ninguna tienda igual.",
        descripcion:
          "Kryon X no le impone una plantilla a tu negocio. Cada tienda tiene su tipografía, su color y su ritmo.",
        temas: ["moda", "tecnologia", "alimentos", "belleza", "retail", "servicios"],
      },
    },
    {
      tipo: "beneficios",
      id: "beneficios",
      visible: true,
      datos: {
        etiqueta: "Por qué Kryon X",
        titulo: "Todo lo que tu tienda necesita",
        destacado: "para crecer.",
        tema: "alimentos",
        beneficios: [
          { icono: "pincel", titulo: "Personalización total", texto: "Cada color, fuente y sección responde a tu marca, no a una plantilla." },
          { icono: "rayo", titulo: "Construcción rápida", texto: "De la idea a una tienda publicada en una tarde." },
          { icono: "dispositivos", titulo: "Diseño responsive", texto: "Impecable en el móvil sin diseñarla dos veces." },
          { icono: "bloques", titulo: "Componentes reutilizables", texto: "Guarda una sección y úsala en cualquier página." },
          { icono: "contenido", titulo: "Gestión de contenido", texto: "Textos, imágenes y productos desde un solo panel." },
          { icono: "megafono", titulo: "Campañas promocionales", texto: "Programa banners y promociones por fechas." },
          { icono: "escala", titulo: "Escalabilidad", texto: "Del primer pedido a miles, sobre la misma base." },
          { icono: "huella", titulo: "Una experiencia por negocio", texto: "Tu tienda con identidad propia desde el primer día." },
        ],
      },
    },
    {
      tipo: "conversion",
      id: "empezar",
      visible: true,
      datos: {
        titulo: "Tu próxima tienda",
        destacado: "empieza con Kryon X.",
        texto: "Diseña hoy la tienda que tus clientes van a recordar.",
        ctaPrincipal: { etiqueta: "Crear mi tienda", href: CREAR_TIENDA },
        ctaSecundario: { etiqueta: "Explorar Kryon X", href: "#constructor" },
      },
    },
  ],
  pie: {
    lema: "Constructor de tiendas online.",
    enlaces: [
      { etiqueta: "Demostración", href: "#demostracion" },
      { etiqueta: "Constructor", href: "#constructor" },
      { etiqueta: "Campañas", href: "#campanas" },
      { etiqueta: "Tiendas", href: "#tiendas" },
      { etiqueta: "Beneficios", href: "#beneficios" },
    ],
    legal: "Kryon X · Desarrollo de software",
  },
};
