import { CheckCircle2, Circle, Search } from "lucide-react";

/**
 * «Posicionamiento en Google» de un producto: cómo se verá en el buscador,
 * qué le falta y los cuatro campos que lo afinan.
 *
 * Ninguno es obligatorio. Vacíos, la tienda los genera con los datos reales
 * del producto (nombre, variedades, unidades, precios — ver
 * `frontend/tienda/src/lib/seo.ts`), así que el administrador solo escribe
 * cuando quiere decir algo distinto. Lo que de verdad mueve una ficha en
 * Google es la DESCRIPCIÓN (pestaña Información) y la FOTO; por eso el
 * indicador de estado los pide a ellos, no a estos campos.
 */

export interface ValoresSeo {
  seo_titulo: string;
  seo_descripcion: string;
  imagen_alt: string;
  palabra_clave: string;
}

interface Props {
  valores: ValoresSeo;
  onCambiar: (cambios: Partial<ValoresSeo>) => void;
  nombre: string;
  descripcion: string;
  categoria: string;
  tieneFoto: boolean;
  /** Variedades y unidades de las presentaciones activas, para la vista previa. */
  variedades: string[];
  unidades: string[];
}

/** Lo mínimo para que una ficha compita: el resto lo genera la tienda. */
export const DESCRIPCION_MINIMA = 120;

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function enumerar(partes: string[]) {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export interface ComprobacionSeo {
  clave: string;
  texto: string;
  ok: boolean;
}

/** El estado SEO de la ficha, calculado: no se guarda, siempre está al día. */
export function comprobacionesSeo({
  nombre,
  descripcion,
  tieneFoto,
  palabraClave,
}: {
  nombre: string;
  descripcion: string;
  tieneFoto: boolean;
  palabraClave: string;
}): ComprobacionSeo[] {
  const clave = normalizar(palabraClave);
  const texto = normalizar(`${nombre} ${descripcion}`);
  return [
    {
      clave: "descripcion",
      texto: `Descripción comercial de al menos ${DESCRIPCION_MINIMA} caracteres`,
      ok: descripcion.trim().length >= DESCRIPCION_MINIMA,
    },
    { clave: "foto", texto: "Foto propia del producto", ok: tieneFoto },
    {
      clave: "palabra",
      texto: "Palabra clave definida y presente en el nombre o la descripción",
      ok: Boolean(clave) && clave.split(/\s+/).every((p) => texto.includes(p)),
    },
  ];
}

/**
 * «Incompleto» solo cuando falta la descripción: es lo que de verdad deja la
 * ficha sin contenido propio. Con descripción (aunque sea corta) y algo
 * pendiente, «mejorable»; con todo, «completo».
 */
export function nivelSeo(comprobaciones: ComprobacionSeo[], descripcion: string): "completo" | "mejorable" | "incompleto" {
  if (!descripcion.trim()) return "incompleto";
  return comprobaciones.every((c) => c.ok) ? "completo" : "mejorable";
}

const ETIQUETA_NIVEL = { completo: "Completo", mejorable: "Mejorable", incompleto: "Incompleto" } as const;

export function SeoProducto({ valores, onCambiar, nombre, descripcion, categoria, tieneFoto, variedades, unidades }: Props) {
  const nombreLimpio = nombre.trim() || "Nombre del producto";
  const tituloAuto = (() => {
    const v = variedades.filter((x) => !["comun", "normal"].includes(normalizar(x)) && !normalizar(nombreLimpio).includes(normalizar(x)));
    const base = v.length ? `${nombreLimpio} ${enumerar(v.slice(0, 2))}` : nombreLimpio;
    return unidades.length ? `${base}: precio por ${enumerar(unidades.slice(0, 2).map((u) => u.toLowerCase()))}` : base;
  })();
  const descripcionAuto =
    descripcion.trim() ||
    `${nombreLimpio}${unidades.length ? ` por ${enumerar(unidades.slice(0, 3).map((u) => u.toLowerCase()))}` : ""}. ${categoria || "Productos"} para hogares y negocios, con pedido en línea.`;
  const comprobaciones = comprobacionesSeo({ nombre, descripcion, tieneFoto, palabraClave: valores.palabra_clave });
  const nivel = nivelSeo(comprobaciones, descripcion);

  const titulo = valores.seo_titulo.trim() || tituloAuto;
  const meta = valores.seo_descripcion.trim() || descripcionAuto;

  return (
    <section className="prd-grupo prd-seo" aria-labelledby="prd-grupo-seo">
      <h3 id="prd-grupo-seo" className="prd-grupo-titulo">
        Posicionamiento en Google
        <span className={`prd-seo-nivel prd-seo-nivel--${nivel}`}>{ETIQUETA_NIVEL[nivel]}</span>
      </h3>

      <div className="prd-seo-previa" aria-label="Vista previa en Google">
        <p className="prd-seo-previa-titulo">
          <Search size={13} aria-hidden /> {titulo.length > 60 ? `${titulo.slice(0, 59)}…` : titulo}
        </p>
        <p className="prd-seo-previa-texto">{meta.length > 160 ? `${meta.slice(0, 159)}…` : meta}</p>
      </div>

      <ul className="prd-seo-lista">
        {comprobaciones.map((c) => (
          <li key={c.clave} className={c.ok ? "ok" : ""} aria-label={`${c.texto}: ${c.ok ? "cumplido" : "pendiente"}`}>
            {c.ok ? <CheckCircle2 size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
            <span aria-hidden>{c.texto}</span>
          </li>
        ))}
      </ul>

      <div className="campo prd-campo">
        <label htmlFor="pr-palabra-clave">
          Palabra clave principal <span className="prd-opc">Opcional</span>
        </label>
        <input
          id="pr-palabra-clave"
          value={valores.palabra_clave}
          maxLength={80}
          onChange={(e) => onCambiar({ palabra_clave: e.target.value })}
          placeholder={`${nombreLimpio.toLowerCase()} por ${unidades[0]?.toLowerCase() ?? "caja"}`}
          aria-describedby="pr-palabra-clave-ayuda"
        />
        <p className="campo-ayuda" id="pr-palabra-clave-ayuda">
          Lo que escribiría un cliente en Google para encontrar este producto. No se muestra en la tienda: guía la
          descripción.
        </p>
      </div>

      <div className="campo prd-campo">
        <label htmlFor="pr-seo-titulo">
          Título en Google <span className="prd-opc">Automático si se deja vacío</span>
        </label>
        <input
          id="pr-seo-titulo"
          value={valores.seo_titulo}
          maxLength={70}
          onChange={(e) => onCambiar({ seo_titulo: e.target.value })}
          placeholder={tituloAuto}
          aria-describedby="pr-seo-titulo-ayuda"
        />
        <p className="campo-ayuda prd-ayuda-fila" id="pr-seo-titulo-ayuda">
          <span>El nombre del negocio se añade solo al final.</span>
          <span className={`prd-contador ${valores.seo_titulo.length > 55 ? "cerca" : ""}`}>{valores.seo_titulo.length}/70</span>
        </p>
      </div>

      <div className="campo prd-campo">
        <label htmlFor="pr-seo-descripcion">
          Descripción en Google <span className="prd-opc">Automática si se deja vacía</span>
        </label>
        <textarea
          id="pr-seo-descripcion"
          value={valores.seo_descripcion}
          maxLength={160}
          rows={2}
          onChange={(e) => onCambiar({ seo_descripcion: e.target.value })}
          placeholder={descripcionAuto.slice(0, 160)}
          aria-describedby="pr-seo-descripcion-ayuda"
        />
        <p className="campo-ayuda prd-ayuda-fila" id="pr-seo-descripcion-ayuda">
          <span>Vacía, se usa la descripción comercial o una frase con las presentaciones reales.</span>
          <span className={`prd-contador ${valores.seo_descripcion.length > 145 ? "cerca" : ""}`}>
            {valores.seo_descripcion.length}/160
          </span>
        </p>
      </div>

      <div className="campo prd-campo">
        <label htmlFor="pr-imagen-alt">
          Texto alternativo de la foto <span className="prd-opc">Automático si se deja vacío</span>
        </label>
        <input
          id="pr-imagen-alt"
          value={valores.imagen_alt}
          maxLength={125}
          onChange={(e) => onCambiar({ imagen_alt: e.target.value })}
          placeholder={`${nombreLimpio}${variedades[0] ? ` ${variedades[0]}` : ""}`}
          aria-describedby="pr-imagen-alt-ayuda"
        />
        <p className="campo-ayuda" id="pr-imagen-alt-ayuda">
          Describe lo que se ve en la foto («Caja de mango Tommy maduro»). Lo leen Google Imágenes y los lectores de
          pantalla.
        </p>
      </div>
    </section>
  );
}
