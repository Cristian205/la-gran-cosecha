# sitio-kryonx → sitio comercial de Crafteech

La página de ventas de **Crafteech**: presenta sus tres modalidades —Commerce
(tienda autogestionable), Custom (desarrollo a la medida) y Growth
(acompañamiento)— y recoge solicitudes comerciales. Vive aparte de la tienda
multiempresa porque `www` no es ningún negocio (ver `tienda/src/lib/negocio.ts`).

> La carpeta conserva el nombre `sitio-kryonx` (de cuando la marca era Kryon X)
> para no romper la configuración de despliegue que apunta a ella. El contenido
> y el paquete ya son de Crafteech.

    npm install
    npm run dev       # http://localhost:5177
    npm run build     # tsc + vite build
    npm run preview

## Variables de entorno

Copia `.env.example` a `.env`.

| Variable | Qué hace |
| --- | --- |
| `VITE_WHATSAPP_NUMERO` | WhatsApp comercial, con indicativo (`573001234567`). **Sin definir, no se pinta ningún botón de WhatsApp.** Ningún número vive en el código. |
| `VITE_API_URL` | URL del backend donde se guardan las solicitudes del formulario (`https://api…`). Vacía: mismo origen; en desarrollo, el proxy de Vite manda `/api` a `http://localhost:8000`. |

En producción, el backend tiene que listar el origen del sitio en
`CORS_ALLOWED_ORIGINS` (por ejemplo `https://www.crafteech.com`).

## Las ocho escenas

La página es una lista de escenas (`src/contenido/porDefecto.ts`), pintadas por
`src/secciones/registro.tsx`:

| # | Escena | Archivo | Luz |
| --- | --- | --- | --- |
| 01 | Hero | `Hero.tsx` | grafito |
| 02 | Dos caminos, una marca | `Caminos.tsx` | nube |
| 03 | Experiencias por industria | `Experiencias.tsx` | grafito |
| 04 | Personalización real | `Personalizacion.tsx` | nube |
| 05 | Proyectos destacados | `Proyectos.tsx` | grafito |
| 06 | Proceso de trabajo | `Proceso.tsx` | nube 2 |
| 07 | Soluciones y planes | `Soluciones.tsx` | nube |
| 08 | Cierre y contacto | `Contacto.tsx` | grafito |

Ninguna escena lleva texto escrito: todo sale de `ContenidoSitio`
(`src/contenido/tipos.ts`), que es serializable —sin JSX, colores como texto—.
El día que se administre desde el panel basta con que `ProveedorContenido`
(`src/contenido/usarContenido.tsx`) lo pida al backend y caiga a
`contenidoPorDefecto` si falla.

## Reglas de contenido

Conviene respetarlas al editar `porDefecto.ts`:

- **Sin datos inventados**: no hay precios, clientes, testimonios, cifras ni
  resultados comerciales. Cada plan lleva a una cotización.
- **Solo lo que el producto hace hoy.**
- **Real ≠ conceptual**: `CasoProyecto.tipo` es `"real"` o `"concepto"`. Un
  concepto se rotula «Demostración conceptual» y no lleva enlace. Hoy el único
  caso real es La Gran Cosecha.
- Las tiendas de `temas.ts` son **maquetas** (volúmenes CSS y textos de
  ejemplo), no clientes.

## Cómo está armada

    src/contenido/    tipos, temas de tienda de ejemplo, contenido por defecto
    src/secciones/    una escena por archivo, navegación, pie y registro
    src/componentes/  piezas compartidas; la principal es TiendaMaqueta
    src/lib/          analítica, contacto (WhatsApp + envío) y modalidad elegida
    src/estilos/      base (tokens), maqueta (la tienda en miniatura) y secciones

**`TiendaMaqueta`** es una tienda en miniatura que se pinta a partir de un
`TemaTienda`. Se usa en el hero, en las experiencias y en el taller de
personalización. Mide todo en `em` sacado del ancho del contenedor (`cqi`) y
cambia a versión móvil con una consulta de contenedor. Los productos son
volúmenes CSS, no fotos: no pesan y cambian de color con el tema.

## Identidad «Digital Fusion»

Graphite `#101311` (escenas de impacto), Cloud `#F5F6F2` (editoriales),
Electric Lime `#B7F34A` (lo que actúa) y Slate `#777E79` (lo que acompaña).
Manrope para titulares y contenido; Inter para interfaces.

El Slate puro no llega a 4,5:1 como texto pequeño, así que el texto secundario
usa `--texto-sobre-claro` y `--texto-sobre-oscuro`; y el Lima no se lee como
texto sobre Cloud, donde se usa como marcador o como `--lima-texto`.

## Conversión

Todo botón es un enlace real y mide su clic. Un botón que expresa interés en
una modalidad (`Enlace.solucion`) deja elegida esa modalidad para el formulario
del cierre y para el mensaje de WhatsApp.

El formulario hace `POST /api/contact/solicitudes-comerciales/` (backend:
`apps/contact`, modelo `SolicitudComercial`, 5 solicitudes por hora por IP y
una trampa anti-bots). Si el envío falla, la persona conserva lo escrito y se
le ofrece seguir por WhatsApp con el mensaje armado.

### Analítica

`src/lib/analitica.ts` no elige proveedor: publica cada evento en `gtag`,
`dataLayer` o `plausible` si están instalados, y siempre como `CustomEvent`
`crafteech:evento`. Los nombres son un contrato:

`cta_click` · `solucion_seleccionada` · `proyecto_visto` ·
`formulario_iniciado` · `formulario_enviado` · `formulario_error` ·
`contacto_whatsapp`

## SEO

`index.html` lleva título, descripción, canónica, Open Graph, Twitter Card y
datos estructurados (Organization, WebSite y un OfferCatalog con las tres
soluciones, sin precios). `public/` trae `robots.txt`, `sitemap.xml`,
`site.webmanifest`, los iconos y `og-crafteech.png` (1200×630).

## Animación

Motion para entradas, scroll y microinteracciones; Lenis para el scroll suave.
Con `prefers-reduced-motion` Lenis no arranca y `MotionConfig
reducedMotion="user"` deja cada pieza ya colocada. Sin scroll hijacking: el
scroll es siempre el nativo de la ventana.
