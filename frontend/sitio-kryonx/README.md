# sitio-kryonx

La página de ventas de Kryon X: vende el constructor de tiendas a quien todavía
no es cliente. Vive aparte de la tienda multiempresa porque `www` no es ningún
negocio (ver `tienda/src/lib/negocio.ts`).

    npm install
    npm run dev       # http://localhost:5177
    npm run build

## Cómo está armada

    src/contenido/    los textos y datos de cada sección (tipos + valores por defecto)
    src/secciones/    una sección por archivo, y registro.tsx que las pinta en orden
    src/componentes/  piezas compartidas; la principal es TiendaMaqueta
    src/estilos/      base (tokens), maqueta (la tienda en miniatura) y secciones

**`TiendaMaqueta`** es una tienda en miniatura que se pinta a partir de un
`TemaTienda`. Se usa en el hero, el constructor, las campañas, la vitrina y la
demostración responsive: si cada sección dibujara la suya, el código estaría
desmintiendo lo que la página promete. Mide todo en `em` sacado del ancho del
contenedor (`cqi`) y cambia a versión móvil con una consulta de contenedor.

Los productos son volúmenes CSS, no fotos: no pesan, cambian de color con el
tema y no parecen fotos de banco.

## Administrarlo desde el sistema

Ninguna sección lleva texto escrito: todo sale de `ContenidoSitio`
(`src/contenido/tipos.ts`), que es serializable —sin JSX, iconos por nombre,
colores como texto—. Las secciones son una lista con `tipo`, `id`, `visible`
y `datos`, que es lo que un editor necesita para reordenarlas o apagarlas.

Para servirlo desde el backend basta con que `ProveedorContenido`
(`src/contenido/usarContenido.tsx`) lo pida y caiga a `contenidoPorDefecto`
mientras carga o si falla. Ninguna sección cambia.

## Animación

Motion para entradas, scroll y microinteracciones; Lenis para el scroll suave.
Nada de Three.js: los efectos de profundidad salen de CSS 3D y Motion por una
fracción del peso. Con `prefers-reduced-motion` Lenis no arranca, Motion
coloca cada pieza sin animarla y la galería horizontal pasa a carrusel nativo.
