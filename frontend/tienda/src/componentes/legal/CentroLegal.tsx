import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, ChevronRight, History, Info, Scale, ShieldAlert, Store } from "lucide-react";
import type { ReactNode } from "react";
import { fechaLegible, textoPlano } from "@/lib/legal/datos";
import { GRUPOS } from "@/lib/legal/politicas";
import { centroLegal } from "@/lib/legal/servidor";
import type { BloqueLegal, DatosLegales, Politica } from "@/lib/legal/tipos";
import { NavegacionLegal, NavegacionLegalMovil, type EnlacePolitica } from "./NavegacionLegal";
import { Canales, PiezaLegal, TablaDatos } from "./PiezasLegales";
import { TextoLegal } from "./TextoLegal";

/**
 * El armazón de las páginas legales: cabecera, navegación entre políticas y
 * contenido. Se pinta en el servidor —el texto legal tiene que llegar dentro
 * del HTML, para el rastreador y para quien lo imprime— y solo la navegación
 * es de cliente, porque sigue el scroll.
 */
function Armazon({
  politicas,
  activa,
  secciones,
  cabecera,
  children,
}: {
  politicas: Politica[];
  activa: string;
  secciones: { id: string; titulo: string }[];
  cabecera: ReactNode;
  children: ReactNode;
}) {
  const enlaces: EnlacePolitica[] = politicas.map(({ slug, tituloCorto, grupo }) => ({ slug, tituloCorto, grupo }));
  const nav = { politicas: enlaces, grupos: GRUPOS, activa, secciones };

  return (
    <div className="legal">
      <header className="legal-cabecera">
        <div className="contenedor legal-cabecera-interior">{cabecera}</div>
      </header>
      <NavegacionLegalMovil {...nav} />
      <div className="contenedor legal-cuerpo">
        <aside className="legal-lateral">
          <NavegacionLegal {...nav} />
        </aside>
        <div className="legal-principal">{children}</div>
      </div>
    </div>
  );
}

function Migas({ titulo }: { titulo?: string }) {
  return (
    <nav className="legal-migas" aria-label="Ruta">
      <Link href="/">Inicio</Link>
      <ChevronRight size={13} aria-hidden="true" />
      {titulo ? <Link href="/legal">Centro legal</Link> : <span aria-current="page">Centro legal</span>}
      {titulo && (
        <>
          <ChevronRight size={13} aria-hidden="true" />
          <span aria-current="page">{titulo}</span>
        </>
      )}
    </nav>
  );
}

function FechaActualizacion({ iso }: { iso: string }) {
  const legible = fechaLegible(iso);
  return (
    <span className="legal-fecha">
      <CalendarClock size={15} aria-hidden="true" />
      Última actualización:{" "}
      {legible ? (
        <time dateTime={iso}>{legible}</time>
      ) : (
        <mark className="legal-pendiente" title="Se fija al publicar la política desde la administración">
          [FECHA]
        </mark>
      )}
    </span>
  );
}

function Bloque({ bloque, datos }: { bloque: BloqueLegal; datos: DatosLegales }) {
  switch (bloque.tipo) {
    case "p":
      return (
        <p>
          <TextoLegal texto={bloque.texto} datos={datos} />
        </p>
      );
    case "lista": {
      const Etiqueta = bloque.ordenada ? "ol" : "ul";
      return (
        <Etiqueta className={`legal-lista ${bloque.ordenada ? "legal-lista--pasos" : ""}`}>
          {bloque.items.map((item, i) => (
            <li key={i}>
              <TextoLegal texto={item} datos={datos} />
            </li>
          ))}
        </Etiqueta>
      );
    }
    case "aviso":
      return (
        <aside className={`legal-aviso legal-aviso--${bloque.tono ?? "info"}`}>
          {bloque.tono === "importante" ? <ShieldAlert size={19} aria-hidden="true" /> : <Info size={19} aria-hidden="true" />}
          <div>
            {bloque.titulo && <strong>{bloque.titulo}</strong>}
            <p>
              <TextoLegal texto={bloque.texto} datos={datos} />
            </p>
          </div>
        </aside>
      );
    case "datos":
      return <TablaDatos filas={bloque.filas} datos={datos} />;
    case "componente":
      return <PiezaLegal nombre={bloque.nombre} datos={datos} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */

export async function PaginaPolitica({ slug }: { slug: string }) {
  const centro = await centroLegal();
  const indice = centro?.politicas.findIndex((p) => p.slug === slug) ?? -1;
  if (!centro || indice < 0) notFound();

  const { datos, politicas } = centro;
  const politica = politicas[indice];
  const anterior = politicas[indice - 1];
  const siguiente = politicas[indice + 1];

  return (
    <Armazon
      politicas={politicas}
      activa={slug}
      secciones={politica.secciones.map(({ id, titulo }) => ({ id, titulo }))}
      cabecera={
        <>
          <Migas titulo={politica.tituloCorto} />
          <h1 className="legal-titulo">{politica.titulo}</h1>
          <p className="legal-resumen">
            <TextoLegal texto={politica.resumen} datos={datos} />
          </p>
          <div className="legal-meta">
            <FechaActualizacion iso={politica.actualizado} />
            <Link href="/tienda" className="legal-volver">
              <Store size={15} aria-hidden="true" /> Volver a la tienda
            </Link>
          </div>
        </>
      }
    >
      <article className="legal-articulo">
        {politica.secciones.map((seccion, i) => (
          <section key={seccion.id} id={seccion.id} className="legal-seccion">
            <h2>
              <span className="legal-seccion-numero">{String(i + 1).padStart(2, "0")}</span>
              {seccion.titulo}
            </h2>
            {seccion.bloques.map((bloque, j) => (
              <Bloque key={j} bloque={bloque} datos={datos} />
            ))}
          </section>
        ))}

        <footer className="legal-cierre">
          <p className="legal-cierre-fecha">
            <FechaActualizacion iso={politica.actualizado} />
          </p>

          {politica.historial.length > 0 && (
            <details className="legal-historial">
              <summary>
                <History size={15} aria-hidden="true" /> Historial de versiones ({politica.historial.length})
              </summary>
              <ol>
                {[...politica.historial].reverse().map((h, i) => (
                  <li key={`${h.fecha}-${i}`}>
                    <time dateTime={h.fecha}>{fechaLegible(h.fecha) ?? h.fecha}</time>
                    <span>{h.cambio}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <nav className="legal-paginacion" aria-label="Otras políticas">
            {anterior ? (
              <Link href={`/${anterior.slug}`} className="legal-paginacion-enlace">
                <ArrowLeft size={16} aria-hidden="true" />
                <span>
                  <small>Anterior</small>
                  {anterior.tituloCorto}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {siguiente && (
              <Link href={`/${siguiente.slug}`} className="legal-paginacion-enlace legal-paginacion-enlace--siguiente">
                <span>
                  <small>Siguiente</small>
                  {siguiente.tituloCorto}
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </nav>

          <div className="legal-ayuda">
            <div>
              <strong>¿Tienes una duda sobre esta política?</strong>
              <span>Escríbenos y te respondemos por nuestros canales oficiales.</span>
            </div>
            <Link href="/contacto-y-peticiones" className="btn primario btn-sm">
              Ir a PQRS
            </Link>
          </div>
        </footer>
      </article>
    </Armazon>
  );
}

/* ------------------------------------------------------------------ */

export async function IndiceCentroLegal() {
  const centro = await centroLegal();
  if (!centro) notFound();
  const { datos, politicas } = centro;

  return (
    <Armazon
      politicas={politicas}
      activa=""
      secciones={[]}
      cabecera={
        <>
          <Migas />
          <h1 className="legal-titulo">
            <Scale size={30} aria-hidden="true" className="legal-titulo-icono" /> Centro legal
          </h1>
          <p className="legal-resumen">
            Todo lo que necesitas saber para comprar en {datos.empresa.nombre_comercial ?? "nuestra tienda"} con confianza:
            cómo funcionan tus pedidos, cómo cuidamos tus datos y cómo contactarnos.
          </p>
          <div className="legal-meta">
            <Link href="/tienda" className="legal-volver">
              <Store size={15} aria-hidden="true" /> Volver a la tienda
            </Link>
          </div>
        </>
      }
    >
      <div className="legal-articulo">
        {Object.entries(GRUPOS).map(([grupo, nombre]) => (
          <section key={grupo} className="legal-seccion">
            <h2>{nombre}</h2>
            <div className="legal-tarjetas">
              {politicas
                .filter((p) => p.grupo === grupo)
                .map((p) => (
                  <Link key={p.slug} href={`/${p.slug}`} className="legal-tarjeta">
                    <strong>{p.titulo}</strong>
                    {/* Texto plano: la tarjeta entera ya es un enlace, y un
                        resumen con enlaces dejaría un <a> dentro de otro. */}
                    <span>{textoPlano(p.resumen, datos)}</span>
                    <span className="legal-tarjeta-ir">
                      Leer <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}

        <section className="legal-seccion">
          <h2>Quiénes somos</h2>
          <PiezaLegal nombre="identificacion" datos={datos} />
        </section>
        <section className="legal-seccion">
          <h2>Canales oficiales</h2>
          <Canales datos={datos} />
        </section>
      </div>
    </Armazon>
  );
}
