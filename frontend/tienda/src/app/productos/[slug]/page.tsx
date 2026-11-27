import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvisoPrecios } from "@/componentes/AvisoPrecios";
import { ProductCard } from "@/componentes/ProductCard";
import { FichaCompra } from "@/componentes/tienda/FichaCompra";
import { Migas } from "@/componentes/tienda/Migas";
import { pedirAlBackend } from "@/lib/api";
import { desempaquetar } from "@/lib/datos";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import {
  categoriasDeLaTienda,
  datosEstructuradosDeProducto,
  descripcionDeProducto,
  hrefDeCategoria,
  migasEstructuradas,
  nombreDePresentacion,
  precioCOP,
  resumenDeVentaProducto,
  tituloDeProducto,
} from "@/lib/seo";
import type { Paginated, Producto } from "@/lib/tipos";

/**
 * La ficha de un producto: /productos/<slug>.
 *
 * El catálogo (`/tienda`) es la vitrina completa; esto es la puerta de
 * entrada de UN producto por su propio enlace — lo que permite que "mango"
 * se posicione por separado y que un enlace compartido lleve directo a él.
 *
 * Todo lo que Google necesita sale en el HTML del servidor: título y
 * descripción propios (armados con las presentaciones reales, ver
 * `lib/seo.ts`), la tabla de presentaciones y precios, las migas hasta la
 * página de su categoría y enlaces a otros productos de la misma categoría.
 */
interface Props {
  params: Promise<{ slug: string }>;
}

async function obtenerProductoPorSlug(slug: string): Promise<Producto | null> {
  const pagina = await pedirAlBackend<Paginated<Producto> | Producto[]>("/catalog/products/", {
    params: { slug, page_size: 1 },
  });
  if (!pagina) return null;
  const [producto] = desempaquetar(pagina);
  // El filtro por slug es exacto, pero se comprueba igual: si el backend
  // ignorara el parámetro, devolvería el primer producto del catálogo y esta
  // URL mostraría (e indexaría) un producto que no es el suyo.
  return producto && producto.slug === slug ? producto : null;
}

/**
 * Productos de la misma categoría, sin el propio.
 *
 * Antes eran «los 4 primeros de la categoría», los mismos en todas las fichas:
 * esos cuatro recibían enlaces desde todas partes y los demás desde ninguna.
 * Ahora son los que SIGUEN a este en el orden de la categoría (dando la vuelta
 * al final), así que cada producto recibe enlaces de sus vecinos y ninguno se
 * queda huérfano.
 */
const RELACIONADOS = 4;

async function obtenerRelacionados(producto: Producto): Promise<{ lista: Producto[]; total: number }> {
  const pagina = await pedirAlBackend<Paginated<Producto> | Producto[]>("/catalog/products/", {
    params: { categoria: producto.categoria, page_size: 200 },
  });
  if (!pagina) return { lista: [], total: 0 };
  const todos = desempaquetar(pagina);
  const total = Array.isArray(pagina) ? todos.length : pagina.count;
  const posicion = todos.findIndex((p) => p.id === producto.id);
  const otros = posicion < 0 ? todos : [...todos.slice(posicion + 1), ...todos.slice(0, posicion)];
  return { lista: otros.filter((p) => p.id !== producto.id).slice(0, RELACIONADOS), total };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [producto, config] = await Promise.all([obtenerProductoPorSlug(slug), configuracionDeLaTienda()]);
  if (!producto) return {};

  const titulo = tituloDeProducto(producto);
  const descripcion = descripcionDeProducto(producto, config?.nombre_empresa);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/productos/${producto.slug}` },
    openGraph: {
      title: titulo,
      description: descripcion,
      type: "website",
      url: `/productos/${producto.slug}`,
      ...(producto.imagen_url ? { images: [producto.imagen_url] } : {}),
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const [producto, { host }, config, categorias] = await Promise.all([
    obtenerProductoPorSlug(slug),
    negocioDeLaPeticion(),
    configuracionDeLaTienda(),
    categoriasDeLaTienda(),
  ]);

  if (!producto) notFound();
  const nombreNegocio = config?.nombre_empresa;
  const { lista: relacionados, total: totalCategoria } = await obtenerRelacionados(producto);

  const categoria = categorias.find((c) => c.id === producto.categoria);
  const hrefCategoria = hrefDeCategoria(categoria ?? { id: producto.categoria });

  const base = `https://${host}`;
  // Todas las fotos reales del producto: la general y las de sus presentaciones.
  const imagenes = Array.from(
    new Set([producto.imagen_url, ...producto.presentaciones.map((p) => p.imagen_url)].filter(Boolean))
  ) as string[];

  const jsonLdProducto = datosEstructuradosDeProducto(producto, {
    base,
    negocio: nombreNegocio,
    imagenes,
  });
  const jsonLdMigas = migasEstructuradas(base, [
    { nombre: "Inicio", ruta: "/" },
    { nombre: "Tienda", ruta: "/tienda" },
    { nombre: producto.categoria_nombre, ruta: hrefCategoria },
    { nombre: producto.nombre_producto, ruta: `/productos/${producto.slug}` },
  ]);

  const descripcionPropia = producto.descripcion?.trim();
  const resumen = resumenDeVentaProducto(producto);
  const presentaciones = producto.presentaciones.filter((p) => Number(p.precio_unitario) > 0);

  return (
    <div className="ficha contenedor">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProducto) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdMigas) }} />

      <Migas
        migas={[
          { etiqueta: "Inicio", href: "/" },
          { etiqueta: "Tienda", href: "/tienda" },
          { etiqueta: producto.categoria_nombre, href: hrefCategoria },
          { etiqueta: producto.nombre_producto },
        ]}
      />

      {/* "Esto es lo que estás comprando": la galería a un lado y, al otro,
          lo que hay que decidir — variedad, unidad con su precio, cantidad —.
          Comparten la selección: elegir la presentación cambia la foto. */}
      <FichaCompra
        producto={producto}
        cabecera={
          <>
            <Link className="ficha-cat" href={hrefCategoria}>
              {producto.categoria_nombre}
            </Link>
            <h1>{producto.nombre_producto}</h1>
            {/* La descripción del negocio si la escribió; si no, lo que el
                catálogo dice de cómo se vende (nunca una frase de relleno). */}
            {(descripcionPropia || resumen) && (
              <p className="ficha-descripcion">{descripcionPropia || resumen}</p>
            )}
          </>
        }
        // Solo lo que no está ya arriba: variedades, presentaciones y
        // categoría ya se ven en el panel — una información, un lugar.
        pie={
          <div className="ficha-meta">
            <AvisoPrecios compacto />
            {producto.codigo_producto && (
              <p className="ficha-codigo">
                Código <span>{producto.codigo_producto}</span>
              </p>
            )}
          </div>
        }
      />

      {/* Todas las presentaciones de un vistazo, en HTML plano: el selector de
          arriba enseña una a la vez, y esta tabla es lo que distingue de
          verdad la ficha del mango de la del lulo para quien la lee y para
          Google. Solo con más de una: con una, ya está todo arriba. */}
      {presentaciones.length > 1 && (
        <section className="ficha-presentaciones" aria-labelledby="presentaciones-titulo">
          <h2 id="presentaciones-titulo">Presentaciones y precios de {producto.nombre_producto.toLowerCase()}</h2>
          <div className="ficha-presentaciones-marco">
            <table>
              <thead>
                <tr>
                  <th scope="col">Presentación</th>
                  <th scope="col">Se vende por</th>
                  <th scope="col">Precio</th>
                </tr>
              </thead>
              <tbody>
                {presentaciones.map((p) => (
                  <tr key={p.id}>
                    <td>{nombreDePresentacion(p, producto)}</td>
                    <td>{p.unidad_venta_nombre}</td>
                    <td>{precioCOP(Number(p.precio_unitario))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {relacionados.length > 0 && (
        <section className="ficha-relacionados" aria-labelledby="relacionados-titulo">
          <div className="ficha-relacionados-cabecera">
            <h2 id="relacionados-titulo">Más de {producto.categoria_nombre}</h2>
            <Link href={hrefCategoria} className="ficha-relacionados-todo">
              Ver {totalCategoria > 0 ? `los ${totalCategoria} productos` : "todo"} de {producto.categoria_nombre.toLowerCase()}
            </Link>
          </div>
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
