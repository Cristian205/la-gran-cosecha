# Inventario del contenido de la tienda pública

Qué ve el cliente en la tienda, de dónde sale y dónde se cambia desde el
panel (`admin-panel`). Regla: **si el administrador puede verlo en la tienda,
debe poder cambiarlo sin tocar código**, salvo los textos funcionales del
sistema (botones de acción, estados, mensajes de error).

Leyenda: **[ADMINISTRABLE]** se cambia desde el panel · **[CÓDIGO]** es
estructural o funcional y se queda en código a propósito.

## Arquitectura (ya existente)

```
Negocio (tenant)
 └── Páginas  (storefront.Pagina: /, /tienda, /nosotros, /contacto, /entrar, …)
      └── Versiones (borrador · publicada · archivadas = historial)
           └── Secciones (bloques): tipo + props + visible por dispositivo
                └── Contenido: props del bloque, o datos que el bloque lee
                    (catálogo, banners, testimonios, beneficios…)
```

- El frontend (`frontend/tienda`) pinta cada sección según su `tipo`
  (`src/bloques/registro.tsx`). Un bloque nuevo trae su formulario: el panel
  lo genera de su `esquema_props`.
- Cabecera y pie son la página reservada `/_layout`; la página 404 es
  `/_no-encontrada`. Mismo editor, mismo borrador/publicar.
- Nada está atado a La Gran Cosecha: cada negocio tiene sus páginas, su tema
  (colores, tipografía, forma de botones) y su contenido.

## Dónde se administra

| En el panel | Qué controla |
|---|---|
| **Tienda → Páginas y secciones** | Qué secciones tiene cada página, en qué orden (arrastrar o ↑↓), en qué dispositivos se ven, todos sus textos, imágenes, videos, botones y destinos; productos destacados; cabecera y pie (`/_layout`). Borrador → vista previa en vivo → Publicar; historial y restaurar. Pestaña **Apariencia**: colores, tipografía, botones. |
| **Tienda → Contenido** | General (logo, nombre, teléfono, WhatsApp, correo, dirección, horario, redes, textos de marca), Banners, Anuncios (carrusel), Ofertas, Beneficios, Testimonios, Archivos (biblioteca de medios). |
| **Catálogo** | Productos, fotos por producto y **por presentación**, categorías (nombre, imagen, subtítulo, texto del botón), precios. |

## Inventario por página

### Cabecera y pie (`/_layout`)
| Elemento | Estado |
|---|---|
| Logo, nombre del negocio | [ADMINISTRABLE] Contenido → General |
| Enlaces del menú (texto, destino, orden) | [ADMINISTRABLE] sección *Cabecera* → Enlaces |
| Avisos superiores (barra promocional) | [ADMINISTRABLE] *Cabecera* → Avisos |
| Botón principal (texto, destino), buscador, total del pedido | [ADMINISTRABLE] *Cabecera* |
| Llamada final del pie, lema, textos de ayuda y entrega, títulos de columnas, enlaces, categorías listadas, redes, términos/privacidad, nota legal | [ADMINISTRABLE] sección *Pie* |
| Teléfono, correo, dirección, horario, redes del pie | [ADMINISTRABLE] Contenido → General |
| Navegación inferior móvil (Inicio/Tienda/Nosotros/Contacto) | [CÓDIGO] navegación estructural protegida |

### Inicio (`/`)
| Sección | Estado |
|---|---|
| Hero de campaña: foto/video (escritorio y móvil), enfoque, antetítulo, titular, subtítulo, dos botones con destino | [ADMINISTRABLE] |
| Más vendidos (carrusel): antetítulo, texto, botón, cantidad, segundos por producto, productos **elegidos a mano** o ranking real | [ADMINISTRABLE] |
| Videos de campaña (2): video, póster, textos, botón | [ADMINISTRABLE] (sin video no se muestran) |
| Historia de marca: capítulos (textos, fotos) | [ADMINISTRABLE] |
| Campaña editorial, Campaña para negocios: fotos, textos, botones | [ADMINISTRABLE] |
| Testimonios editoriales: título; las voces | [ADMINISTRABLE] Contenido → Testimonios (con foto) |
| Cierre: foto, textos, botón, mensaje de WhatsApp | [ADMINISTRABLE] |

### Tienda (`/tienda`)
| Sección | Estado |
|---|---|
| Encabezado del catálogo, repetir pedido, títulos de categorías, favoritos de los negocios (productos elegidos a mano o ranking), barra de filtros, rejilla | [ADMINISTRABLE] textos y opciones |
| Categorías (nombre, imagen, subtítulo, orden) | [ADMINISTRABLE] Catálogo |
| Filtros, orden, "Agregar", cantidades, carrito, checkout | [CÓDIGO] funcional |

### Nosotros (`/nosotros`) y Contacto (`/contacto`)
Todas sus secciones (héroes, historias, procesos, escenas con foto/video,
caminos de contacto, escenarios, WhatsApp, datos, cierres): **[ADMINISTRABLE]**
textos, fotos, videos, listas (añadir, quitar, reordenar) y destinos. Los
datos de contacto salen de Contenido → General.

### Ficha de producto (`/productos/<slug>`)
Nombre, fotos (galería por presentación), precios, variedades, unidades:
**[ADMINISTRABLE]** desde Catálogo. Estructura de la ficha y compra: [CÓDIGO].

## Qué quedó en código y por qué

- **Textos funcionales**: "Ver detalle", "Agregar al pedido", "Limpiar
  filtros", "Agotado", estados de carga y error, confirmaciones del carrito
  y del checkout. Cambiarlos no es una decisión comercial y dejarlos
  editables solo abre la puerta a romper la compra.
- **Estructura**: el diseño de cada tipo de sección, el orden interno de sus
  elementos, la navegación móvil, el carrito y el checkout.
- **Valores por defecto** en los componentes: solo se usan si una página no
  trae la propiedad; todas las páginas publicadas la traen.
- **Páginas de respaldo** (`paginas/ContactPage.tsx`, `AboutPage.tsx`): solo
  para negocios que aún no tienen esa página compuesta.

## Cambios de esta iteración (huecos cerrados)

1. **Tienda** en el menú del panel: "Páginas y secciones" (el constructor, que
   no aparecía en el menú por defecto) y "Contenido".
2. Imágenes y videos de las secciones: subir, reemplazar, elegir de la
   biblioteca y quitar, con vista previa; validación de formato y peso; aviso
   de dimensiones bajas; aviso si el archivo no carga (antes: pegar una URL).
3. Destinos de botones con sugerencias reales (páginas, categorías, secciones
   de contacto) y aviso si no parecen válidos.
4. Listas (slides, pasos, escenas): reordenar, duplicar, plegar; las listas de
   textos simples ya no se rompen al añadir.
5. Productos destacados elegidos a mano (y en orden) en *Más vendidos* y
   *Favoritos de los negocios*; vacío = ranking real de ventas.
6. Banners y carrusel: imagen para móvil y programación por fechas (inicio y
   fin); la tienda solo muestra lo vigente y el panel marca lo programado o
   vencido.
7. Testimonios con foto; beneficios con imagen propia (en lugar del ícono).
8. Esquemas de bloques con `formato` (`imagen`, `video`, `enlace`,
   `productos`): el panel pinta el control correcto a partir de los datos.

## Pendiente / siguiente paso razonable

- Recorte o enfoque visual de imágenes (hoy se escribe "50% 60%").
- Selector de ícono visual para beneficios (hoy, lista de nombres).
- Programación por fechas para secciones enteras (hoy, por banner/anuncio).
- Traducir los `campo` de identificadores internos (ej. el camino de un
  contacto: `pedido`, `cotizacion`) a listas cerradas (`enum`).
