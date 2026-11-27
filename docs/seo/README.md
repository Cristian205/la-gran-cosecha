# Contenido SEO del catálogo

`contenido-la-gran-cosecha.json` es una **propuesta** de contenido para la tienda de La Gran Cosecha:

- descripciones de 180 de los 194 productos;
- palabra clave por producto;
- título, descripción, introducción y preguntas frecuentes de las 7 categorías;
- títulos SEO del inicio y del catálogo.

Está escrita solo con datos reales del catálogo (variedades, unidades de venta) y usos culinarios de conocimiento general. No afirma procedencia, calidad, certificaciones ni beneficios.

## Antes de importar

1. Revisar el archivo, sobre todo las preguntas frecuentes. Cualquier dato del negocio que no sea cierto se corrige o se borra.
2. Los 14 productos sin propuesta no se pudieron identificar con certeza y los describe el negocio desde el panel: `base-marinero`, `c1`, `colicero`, `curua`, `instacream`, `j1`, `matrix`, `millos`, `mute`, `ochuas`, `p3`, `ricato`, `tallos` y `tipitin`.

## Importar

Primero se despliega la migración `catalog.0017_campos_seo`. Después:

```bash
# Simulación: dice qué cambiaría, no guarda nada
python manage.py importar_contenido_seo ../docs/seo/contenido-la-gran-cosecha.json

# Aplicar
python manage.py importar_contenido_seo ../docs/seo/contenido-la-gran-cosecha.json --aplicar
```

El comando funciona así:

- Solo **llena campos vacíos**: lo que el negocio ya escribió en el panel no se toca sin `--sobrescribir`.
- Nunca modifica nombres, precios, presentaciones, estados ni categorías de un producto.
- Puede ejecutarse varias veces sin efectos adicionales.

Después de importar, todo se edita desde el panel:

- **Producto**: pestaña *Publicación* → sección *Posicionamiento en Google*.
- **Categoría**: *Categorías* → editar → *Página de la categoría en Google*.
