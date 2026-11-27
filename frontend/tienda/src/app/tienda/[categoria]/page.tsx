import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/componentes/ProductCard";
import { Migas } from "@/componentes/tienda/Migas";
import { pedirAlBackend } from "@/lib/api";
import { desempaquetar } from "@/lib/datos";
import { configuracionDeLaTienda, negocioDeLaPeticion } from "@/lib/negocio";
import {
  categoriasDeLaTienda,
  descripcionDeCategoria,
  hrefDeCategoria,
  introduccionDeCategoria,
  migasEstructuradas,
  preguntasDeCategoria,
  tituloDeCategoria,
} from "@/lib/seo";
import type { Categoria, Paginated, Producto } from "@/lib/tipos";
import { subtituloCategoria } from "@/lib/utiles";

/**
 * La página de una categoría: /tienda/<slug> (/tienda/frutas, /tienda/granos…).
 *
 * Hasta ahora una categoría solo existía como filtro (`/tienda?categoria=2`),
 * con la canónica apuntando a `/tienda`: para Google no había ninguna página
 * de «frutas» que indexar, y como el catálogo carga por scroll infinito, el
 * HTML que recibe el rastreador solo enlazaba 24 de los 194 productos. El
 * resto solo se conocía por el sitemap, sin un solo enlace interno: es la
 * receta de «Descubierta: actualmente sin indexar».
 *
 * Esta página es el remedio: cada categoría con su título, su introducción y
 * TODOS sus productos como enlaces HTML normales, en el HTML del servidor.
 * Con más de `POR_PAGINA` productos se pagina con enlaces reales
 * (`?pagina=2`), no con un botón.
 *
 * La experiencia de compra no cambia: las tarjetas son las mismas del
 * catálogo (vista rápida, agregar al pedido), y `/tienda` sigue siendo la
 * vitrina interactiva con sus filtros.
 */
const POR_PAGINA = 48;

interface Props {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function numeroDePagina(valor: string | string[] | undefined): number | null {
  if (valor === undefined) return 1;
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

async function categoriaPorSlug(slug: string): Promise<Categoria | null> {
  const categorias = await categoriasDeLaTienda();
  return categorias.find((c) => c.slug === slug) ?? null;
}

async function productosDe(categoria: Categoria, pagina: number) {
  return pedirAlBackend<Paginated<Producto>>("/catalog/products/", {
    params: { categoria: categoria.id, page_size: POR_PAGINA, page: pagina },
  });
}

function rutaDePagina(base: string, pagina: number): string {
  return pagina <= 1 ? base : `${base}?pagina=${pagina}`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ categoria: slug }, parametros] = await Promise.all([params, searchParams]);
  const pagina = numeroDePagina(parametros.pagina);
  const [categoria, config] = await Promise.all([categoriaPorSlug(slug), configuracionDeLaTienda()]);
  if (!categoria || !pagina) return {};

  const datos = await productosDe(categoria, pagina);
  if (!datos) return {};
  const productos = desempaquetar(datos);
  const ruta = rutaDePagina(`/tienda/${slug}`, pagina);
  const sufijo = pagina > 1 ? ` (página ${pagina})` : "";

  return {
    title: `${tituloDeCategoria(categoria)}${sufijo}`,
    description: descripcionDeCategoria(categoria, productos, datos.count, config?.nombre_empresa),
    // Cada página de la serie es canónica de sí misma: apuntarlas todas a la
    // primera le diría a Google que ignore los productos de las siguientes.
    alternates: { canonical: ruta },
    openGraph: {
      title: categoria.nombre_categoria,
      url: ruta,
      ...(categoria.imagen_url ? { images: [categoria.imagen_url] } : {}),
    },
  };
}

export default async function PaginaCategoria({ params, searchParams }: Props) {
  const [{ categoria: slug }, parametros] = await Promise.all([params, searchParams]);
  const pagina = numeroDePagina(parametros.pagina);
  if (!pagina) notFound();

  const [categoria, { host }, config, categorias] = await Promise.all([
    categoriaPorSlug(slug),
    negocioDeLaPeticion(),
    configuracionDeLaTienda(),
    categoriasDeLaTienda(),
  ]);
  if (!categoria) notFound();

  const datos = await productosDe(categoria, pagina);
  const productos = datos ? desempaquetar(datos) : [];
  // Sin productos no hay página: una categoría vacía (o una página de la serie
  // que no existe) es contenido pobre, y responde 404.
  if (!datos || productos.length === 0) notFound();

  const total = datos.count;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const rutaBase = `/tienda/${slug}`;
  const base = `https://${host}`;
  const propio = categoria.subtitulo?.trim();
  const lema = subtituloCategoria(categoria.nombre_categoria, propio);
  const intro = categoria.descripcion?.trim() ?? "";
  const preguntas = preguntasDeCategoria(categoria);
  const otras = categorias.filter((c) => c.id !== categoria.id && (c.num_productos ?? 1) > 0);

  const jsonLdMigas = migasEstructuradas(base, [
    { nombre: "Inicio", ruta: "/" },
    { nombre: "Tienda", ruta: "/tienda" },
    { nombre: categoria.nombre_categoria, ruta: rutaBase },
  ]);
  const jsonLdLista = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: categoria.nombre_categoria,
    url: `${base}${rutaDePagina(rutaBase, pagina)}`,
    ...(config?.nombre_empresa ? { isPartOf: { "@id": `${base}/#sitio` } } : {}),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: productos.map((p, i) => ({
        "@type": "ListItem",
        position: (pagina - 1) * POR_PAGINA + i + 1,
        url: `${base}/productos/${p.slug}`,
        name: p.nombre_producto,
      })),
    },
  };

  return (
    <div className="ficha contenedor vista-tienda pagina-categoria">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdMigas) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLista) }} />

      <Migas
        migas={[
          { etiqueta: "Inicio", href: "/" },
          { etiqueta: "Tienda", href: "/tienda" },
          { etiqueta: categoria.nombre_categoria },
        ]}
      />

      <header className="catalogo-cabecera categoria-cabecera">
        {lema && <p className="catalogo-kicker">{lema}</p>}
        <h1>{categoria.nombre_categoria}</h1>
        {/* La introducción del negocio (panel), solo en la primera página: en
            las siguientes repetirla sería contenido duplicado. Debajo, lo que
            el catálogo dice de la categoría, que siempre es cierto. */}
        {pagina === 1 &&
          intro
            .split(/\n{2,}/)
            .filter((parrafo) => parrafo.trim())
            .map((parrafo, i) => (
              <p key={i} className="catalogo-subtitulo categoria-intro">
                {parrafo.trim()}
              </p>
            ))}
        <p className="catalogo-subtitulo">
          {introduccionDeCategoria(categoria, productos, total)}
          {pagina > 1 && ` Página ${pagina} de ${paginas}.`}
        </p>
      </header>

      <div className="pgrid">
        {productos.map((p, i) => (
          <ProductCard key={p.id} producto={p} indice={i} mostrarCategoria={false} />
        ))}
      </div>

      {paginas > 1 && (
        <nav className="categoria-paginas" aria-label={`Páginas de ${categoria.nombre_categoria}`}>
          {pagina > 1 && (
            <Link href={rutaDePagina(rutaBase, pagina - 1)} rel="prev">
              Anterior
            </Link>
          )}
          {Array.from({ length: paginas }, (_, i) => i + 1).map((n) =>
            n === pagina ? (
              <span key={n} aria-current="page">
                {n}
              </span>
            ) : (
              <Link key={n} href={rutaDePagina(rutaBase, n)}>
                {n}
              </Link>
            )
          )}
          {pagina < paginas && (
            <Link href={rutaDePagina(rutaBase, pagina + 1)} rel="next">
              Siguiente
            </Link>
          )}
        </nav>
      )}

      {pagina === 1 && preguntas.length > 0 && (
        <section className="categoria-preguntas" aria-labelledby="preguntas-categoria">
          <h2 id="preguntas-categoria">Preguntas frecuentes sobre {categoria.nombre_categoria.toLowerCase()}</h2>
          {preguntas.map((p, i) => (
            <details key={i}>
              <summary>{p.pregunta}</summary>
              <p>{p.respuesta}</p>
            </details>
          ))}
        </section>
      )}

      {otras.length > 0 && (
        <nav className="categoria-otras" aria-labelledby="otras-categorias">
          <h2 id="otras-categorias">Otras categorías</h2>
          <ul>
            {otras.map((c) => (
              <li key={c.id}>
                <Link href={hrefDeCategoria(c)}>{c.nombre_categoria}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
