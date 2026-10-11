/**
 * El formulario de una marca y su vista previa.
 *
 * Lo usan Identidad (la marca publicada) y White Label (cualquier marca). La
 * vista previa aplica los tokens del borrador SOLO a su contenedor: es la
 * misma interfaz, con las mismas clases, vestida con otra marca, sin tocar el
 * resto de la pantalla hasta que se publica.
 */
import { useEffect, useRef, type ChangeEvent } from "react";
import { Building2, ImagePlus, LayoutDashboard, Trash2, Users } from "lucide-react";
import { aplicarTokens, contraste, textoSobre } from "../marca/motor";
import { TIPOGRAFIAS, type Marca, type Redondez, type Tipografia } from "../marca/tipos";
import { Campo, Insignia } from "../ui/basicos";
import { usarPlataforma } from "../datos/plataforma";
import { LogoMarca } from "./SelectorMarca";

/** Un logo pesado en `localStorage` llena la cuota enseguida. */
const MAXIMO_LOGO = 400 * 1024;

const REDONDECES: { valor: Redondez; etiqueta: string }[] = [
  { valor: "recta", etiqueta: "Recta" },
  { valor: "media", etiqueta: "Media" },
  { valor: "suave", etiqueta: "Suave" },
];

function leerArchivo(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(archivo);
  });
}

export function EditorMarca({
  marca,
  onCambio,
  onError,
}: {
  marca: Marca;
  onCambio: (marca: Marca) => void;
  onError: (mensaje: string) => void;
}) {
  const fondo = "#08090b";
  const ratioPrimario = contraste(marca.colores.primario, fondo);
  const ratioTexto = contraste(marca.colores.primario, textoSobre(marca.colores.primario));

  function cambiar<K extends keyof Marca>(clave: K, valor: Marca[K]) {
    onCambio({ ...marca, [clave]: valor });
  }

  function color(clave: keyof Marca["colores"], valor: string) {
    onCambio({ ...marca, colores: { ...marca.colores, [clave]: valor } });
  }

  async function subir(e: ChangeEvent<HTMLInputElement>, clave: "logo" | "favicon") {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) return onError("El archivo tiene que ser una imagen.");
    if (archivo.size > MAXIMO_LOGO) return onError("La imagen pesa más de 400 KB. Usa una más ligera.");
    try {
      cambiar(clave, await leerArchivo(archivo));
    } catch {
      onError("No se pudo leer la imagen.");
    }
  }

  return (
    <div className="editor-marca">
      <section className="editor-marca__seccion">
        <h3>Identidad</h3>
        <div className="formulario formulario--dos">
          <Campo etiqueta="Nombre de la marca">
            <input value={marca.nombre} onChange={(e) => cambiar("nombre", e.target.value)} maxLength={40} />
          </Campo>
          <Campo etiqueta="Lema" ayuda="Acompaña al nombre en el selector.">
            <input value={marca.lema} onChange={(e) => cambiar("lema", e.target.value)} maxLength={40} />
          </Campo>
        </div>
        <div className="activos">
          {(["logo", "favicon"] as const).map((clave) => (
            <div key={clave} className="activo">
              <span className="activo__vista">
                {marca[clave] ? <img src={marca[clave]!} alt="" /> : <ImagePlus size={18} />}
              </span>
              <span className="activo__textos">
                <strong>{clave === "logo" ? "Logo" : "Favicon"}</strong>
                <span className="tenue">
                  {clave === "logo" ? "Monograma cuadrado, PNG o SVG" : "32 × 32 px"}
                </span>
              </span>
              <label className="btn btn--secundario btn--pequeno">
                Subir
                <input type="file" accept="image/*" className="oculto" onChange={(e) => subir(e, clave)} />
              </label>
              {marca[clave] && (
                <button
                  type="button"
                  className="icono-boton"
                  onClick={() => cambiar(clave, null)}
                  aria-label={`Quitar el ${clave}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="editor-marca__seccion">
        <h3>Colores</h3>
        <div className="colores">
          {(
            [
              ["primario", "Primario", "Acción principal, selección y foco"],
              ["secundario", "Secundario", "Texto de marca sobre fondo oscuro"],
              ["acento", "Acento", "Detalles; nunca estados"],
            ] as const
          ).map(([clave, etiqueta, ayuda]) => (
            <label key={clave} className="color-campo">
              <input
                type="color"
                value={marca.colores[clave]}
                onChange={(e) => color(clave, e.target.value)}
                aria-label={`Color ${etiqueta.toLowerCase()}`}
              />
              <span className="color-campo__textos">
                <strong>{etiqueta}</strong>
                <span className="tenue">{ayuda}</span>
              </span>
              <input
                className="color-campo__hex"
                value={marca.colores[clave]}
                onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && color(clave, e.target.value)}
                aria-label={`Valor hexadecimal del color ${etiqueta.toLowerCase()}`}
                maxLength={7}
              />
            </label>
          ))}
        </div>
        <p className="contraste">
          <Insignia tono={ratioPrimario >= 3 ? "ok" : "aviso"}>
            {ratioPrimario.toFixed(1)}:1 sobre el fondo
          </Insignia>
          <Insignia tono={ratioTexto >= 4.5 ? "ok" : "aviso"}>
            {ratioTexto.toFixed(1)}:1 texto sobre el botón
          </Insignia>
          <span className="tenue">El texto encima del primario se elige solo.</span>
        </p>
      </section>

      <section className="editor-marca__seccion">
        <h3>Tipografía y forma</h3>
        <div className="formulario formulario--dos">
          <Campo etiqueta="Tipografía">
            <select value={marca.tipografia} onChange={(e) => cambiar("tipografia", e.target.value as Tipografia)}>
              {TIPOGRAFIAS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <div className="campo">
            <span className="campo__etiqueta">Redondez</span>
            <div className="segmentado" role="radiogroup" aria-label="Redondez">
              {REDONDECES.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  role="radio"
                  aria-checked={marca.redondez === r.valor}
                  className={`segmentado__opcion ${marca.redondez === r.valor ? "esta-activa" : ""}`}
                  onClick={() => cambiar("redondez", r.valor)}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** La interfaz en miniatura, vestida con el borrador. */
export function VistaPreviaMarca({ marca }: { marca: Marca }) {
  const caja = useRef<HTMLDivElement>(null);
  // Las cifras de la previa son las de verdad: así se juzga la marca con el
  // contenido que va a llevar, no con números de catálogo.
  const { negocios, usuario } = usarPlataforma();
  const activas = negocios.filter((n) => n.estado === "ACTIVO").length;

  useEffect(() => {
    if (caja.current) aplicarTokens(marca, caja.current);
  }, [marca]);

  return (
    <div className="previa-marca" ref={caja} aria-label={`Vista previa de ${marca.nombre}`}>
      <aside className="previa-marca__lateral">
        <LogoMarca marca={marca} />
        <span className="previa-marca__grupo">Visión general</span>
        <span className="previa-marca__enlace esta-activo">
          <LayoutDashboard size={13} /> Dashboard
        </span>
        <span className="previa-marca__enlace">
          <Building2 size={13} /> Empresas
        </span>
        <span className="previa-marca__enlace">
          <Users size={13} /> Usuarios
        </span>
      </aside>
      <div className="previa-marca__cuerpo">
        <p className="previa-marca__miga">
          {marca.nombre} <span>/</span> Dashboard
          {usuario && <span className="previa-marca__usuario">{usuario.nombre_usuario}</span>}
        </p>
        <p className="previa-marca__titulo">{marca.lema || "Control Center"}</p>
        <div className="previa-marca__kpis">
          <div className="metrica">
            <p className="metrica__etiqueta">Empresas</p>
            <p className="metrica__valor">{String(negocios.length).padStart(2, "0")}</p>
          </div>
          <div className="metrica">
            <p className="metrica__etiqueta">Activas</p>
            <p className="metrica__valor">{String(activas).padStart(2, "0")}</p>
          </div>
        </div>
        <div className="previa-marca__acciones">
          <span className="btn btn--primario btn--pequeno">Acción principal</span>
          <span className="btn btn--secundario btn--pequeno">Secundaria</span>
          <Insignia tono="ok" punto>
            Activa
          </Insignia>
        </div>
        <span className="barra">
          <span style={{ width: "62%", background: "var(--brand-primary)" }} />
        </span>
      </div>
    </div>
  );
}
