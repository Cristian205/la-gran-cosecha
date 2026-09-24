import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { ProductCard } from "@/componentes/ProductCard";
import { agruparPresentaciones } from "@/componentes/PresentationSelector";
import { CompraProducto } from "@/componentes/tienda/CompraProducto";
import { ImagenProducto } from "@/componentes/tienda/ImagenProducto";
import { pedirAlBackend } from "@/lib/api";
import { desempaquetar } from "@/lib/datos";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import type { Paginated, Producto } from "@/lib/tipos";

/**
 * La ficha de un producto: /productos/<slug>.
 *
 * El catálogo (`/tienda`) es la vitrina completa; esto es la puerta de
 * entrada de UN producto por su propio enlace — lo que permite que "mango"
 * se posicione por separado y que un enlace compartido lleve directo a él,
 * en vez de a la tienda entera con un filtro que hay que explicar.
 *
 * El backend ya traía `slug` en el modelo (pensado para esto: "dos negocios
 * pueden vender ambos un mango y cada uno merece /productos/mango"), pero el
 * serializer público no lo exponía. Se sirve por `?slug=` y no por el pk en
 * la URL para no cambiar cómo el resto del sistema (panel, POS, inventario)
 * ya busca productos por id.
 */
interface Props {
  params: Promise<{ slug: string }>;
}

async function obtenerProductoPorSlug(slug: string): Promise<Producto | null> {
  const pagina = await pedirAlBackend<Paginated<Producto> | Producto[]>(
    "/catalog/products/",
    { params: { slug, page_size: 1 } }
  );
  if (!pagina) return null;
  const [producto] = desempaquetar(pagina);
  return producto ?? null;
}

/**
 * Otros productos de la misma categoría, sin el propio. Se resuelven en el
 * servidor (salen en el HTML, enlazan entre fichas) y solo se muestran si de
 * verdad hay alguno: un "También te puede interesar" vacío, o que repite el
 * producto que se está viendo, es peor que no tenerlo.
 */
async function obtenerRelacionados(producto: Producto): Promise<Producto[]> {
  const pagina = await pedirAlBackend<Paginated<Producto> | Producto[]>("/catalog/products/", {
    params: { categoria: producto.categoria, page_size: 5 },
  });
  if (!pagina) return [];
  return desempaquetar(pagina)
    .filter((p) => p.id !== producto.id)
    .slice(0, 4);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [producto, config] = await Promise.all([
    obtenerProductoPorSlug(slug),
    configuracionDeLaTienda(),
  ]);
  if (!producto) return {};

  const nombreNegocio = config?.nombre_empresa;
  const titulo = `${producto.nombre_producto} · ${producto.categoria_nombre}`;
  const descripcion = `${producto.nombre_producto} para tu negocio${
    nombreNegocio ? `, con ${nombreNegocio}` : ""
  }. Pide en línea por ${producto.unidad_base_nombre ?? "unidad"} y recíbelo donde trabajas.`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/productos/${slug}` },
    openGraph: {
      title: titulo,
      description: descripcion,
      type: "website",
      ...(producto.imagen_url ? { images: [producto.imagen_url] } : {}),
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const [producto, { host }] = await Promise.all([
    obtenerProductoPorSlug(slug),
    negocioDeLaPeticion(),
  ]);

  if (!producto) notFound();

  const relacionados = await obtenerRelacionados(producto);
  const grupos = agruparPresentaciones(producto.presentaciones);
  const unidades = Array.from(
    new Set(producto.presentaciones.map((p) => p.unidad_venta_nombre))
  );

  const base = `https://${host}`;
  const urlProducto = `${base}/productos/${producto.slug}`;
  const precioDesde = producto.precio_desde ? Number(producto.precio_desde) : null;
  const agotado = producto.controla_stock === true && Number(producto.disponible ?? 0) <= 0;

  const jsonLdProducto = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre_producto,
    category: producto.categoria_nombre,
    url: urlProducto,
    ...(producto.imagen_url ? { image: [producto.imagen_url] } : {}),
    ...(precioDesde
      ? {
          offers: {
            "@type": "Offer",
            url: urlProducto,
            priceCurrency: "COP",
            price: precioDesde,
            availability: agotado
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
          },
        }
      : {}),
  };

  const jsonLdMigas = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: base },
      { "@type": "ListItem", position: 2, name: "Tienda", item: `${base}/tienda` },
      {
        "@type": "ListItem",
        position: 3,
        name: producto.categoria_nombre,
        item: `${base}/tienda?categoria=${producto.categoria}`,
      },
      { "@type": "ListItem", position: 4, name: producto.nombre_producto, item: urlProducto },
    ],
  };

  return (
    <div className="ficha contenedor">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProducto) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdMigas) }}
      />

      <nav aria-label="Migas de pan" className="pp-migas">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tienda">Tienda</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/tienda?categoria=${producto.categoria}`}>{producto.categoria_nombre}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{producto.nombre_producto}</span>
      </nav>

      {/* "Esto es lo que estás comprando": la foto grande a un lado y, al
          otro, lo que hay que decidir — variedad, unidad con su precio,
          cantidad — con el mismo panel que la vista rápida del catálogo. */}
      <div className="ficha-cuerpo">
        <div className="ficha-media">
          <ImagenProducto producto={producto} tamanoIcono={200} prioridad />
        </div>

        <div className="ficha-info">
          <Link className="ficha-cat" href={`/tienda?categoria=${producto.categoria}`}>
            {producto.categoria_nombre}
          </Link>
          <h1>{producto.nombre_producto}</h1>

          <CompraProducto producto={producto} />

          <dl className="ficha-datos">
            {unidades.length > 0 && (
              <div>
                <dt>Se vende por</dt>
                <dd>{unidades.join(", ")}</dd>
              </div>
            )}
            {grupos.length > 1 && (
              <div>
                <dt>Variedades</dt>
                <dd>{grupos.map((g) => g.nombre).join(", ")}</dd>
              </div>
            )}
            {producto.codigo_producto && (
              <div>
                <dt>Código</dt>
                <dd>{producto.codigo_producto}</dd>
              </div>
            )}
          </dl>

          <AvisoPrecios compacto />
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="ficha-relacionados" aria-labelledby="relacionados-titulo">
          <h2 id="relacionados-titulo">Más de {producto.categoria_nombre}</h2>
          <div className="pgrid">
            {relacionados.map((p, i) => (
              <ProductCard key={p.id} producto={p} indice={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
