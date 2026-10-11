/**
 * La foto de un banner, una por pantalla.
 *
 *     Escritorio   `imagen`          la principal, la que se ve si no hay otra
 *     Tablet       `imagen_tablet`   opcional
 *     Móvil        `imagen_movil`    opcional
 *
 * con su encuadre (`enfoque`, `enfoque_tablet`, `enfoque_movil`). Solo se
 * ofrecen las pantallas que el esquema del bloque declara: enseñar «Tablet» en
 * un bloque cuya tienda no la lee sería prometer algo que no pasa.
 *
 * La pantalla elegida aquí ES la de la vista previa: elegir «Móvil» para subir
 * su foto pone la previa en móvil, que es donde se puede juzgar el recorte.
 */
import { CheckCircle2, Info } from "lucide-react";
import type { CampoEsquema } from "../../../api/tienda";
import { DISPOSITIVOS, type ClaveDispositivo } from "../dispositivos";
import { CampoEncuadre } from "./CampoEncuadre";
import { CampoMedio } from "./CampoMedio";

const CLAVES: Record<ClaveDispositivo, { imagen: string; enfoque: string; ancho: number }> = {
  escritorio: { imagen: "imagen", enfoque: "enfoque", ancho: 1600 },
  tablet: { imagen: "imagen_tablet", enfoque: "enfoque_tablet", ancho: 1200 },
  movil: { imagen: "imagen_movil", enfoque: "enfoque_movil", ancho: 800 },
};

/** Las propiedades que este control se queda (las demás las pinta el formulario). */
export function clavesDeImagenes(esquema: CampoEsquema | undefined): string[] {
  const props = esquema?.properties ?? {};
  if (!props.imagen || !(props.imagen_movil || props.imagen_tablet)) return [];
  return Object.values(CLAVES)
    .flatMap((c) => [c.imagen, c.enfoque])
    .filter((clave) => clave in props);
}

export function ImagenesPorDispositivo({
  esquema,
  valores,
  onCambio,
  pantalla,
  onPantalla,
}: {
  esquema: CampoEsquema | undefined;
  valores: Record<string, unknown>;
  onCambio: (cambios: Record<string, unknown>) => void;
  pantalla: ClaveDispositivo;
  onPantalla: (clave: ClaveDispositivo) => void;
}) {
  const props = esquema?.properties ?? {};
  const disponibles = DISPOSITIVOS.filter((d) => CLAVES[d.clave].imagen in props);
  const actual = disponibles.find((d) => d.clave === pantalla) ?? disponibles[0];
  const claves = CLAVES[actual.clave];
  const texto = (clave: string) => (typeof valores[clave] === "string" ? (valores[clave] as string) : "");

  const principal = texto("imagen");
  const propia = texto(claves.imagen);
  const esEscritorio = actual.clave === "escritorio";
  const enUso = propia || principal;
  const encuadreEscritorio = texto("enfoque") || String(props.enfoque?.default ?? "50% 50%");

  return (
    <div className="imagenes-dispositivo">
      <div className="imagenes-pestanas" role="tablist" aria-label="Pantalla de la foto">
        {disponibles.map(({ clave, nombre, icono: Icono }) => {
          const tiene = Boolean(texto(CLAVES[clave].imagen));
          return (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={actual.clave === clave}
              className={actual.clave === clave ? "activo" : ""}
              onClick={() => onPantalla(clave)}
            >
              <Icono size={14} aria-hidden="true" />
              {nombre}
              {tiene && <span className="imagenes-punto" title="Tiene foto propia" />}
            </button>
          );
        })}
      </div>

      <div className="imagenes-panel" role="tabpanel">
        <div className="imagenes-cabecera">
          <strong>
            Foto de {actual.nombre.toLowerCase()}
            <span className={`imagenes-etiqueta ${esEscritorio ? "obligatoria" : ""}`}>
              {esEscritorio ? "Principal" : "Opcional"}
            </span>
          </strong>
        </div>

        <CampoMedio
          key={actual.clave}
          clave={claves.imagen}
          tipo="imagen"
          etiqueta={`Foto de ${actual.nombre.toLowerCase()}`}
          sinEtiqueta
          anchoMinimo={claves.ancho}
          ayuda={`Recomendado ${actual.recomendado} · JPG, PNG o WEBP · máx. 8 MB.`}
          valor={propia}
          onCambio={(url) => onCambio({ [claves.imagen]: url })}
        />

        {esEscritorio && !principal && (
          <p className="imagenes-nota aviso">
            <Info size={13} aria-hidden="true" /> Sin foto principal el banner se ve sobre un fondo liso.
          </p>
        )}
        {!esEscritorio && !propia && (
          <p className="imagenes-nota">
            <Info size={13} aria-hidden="true" />
            {principal
              ? `Sin foto propia: en ${actual.nombre.toLowerCase()} se usa la de escritorio, recortada con el encuadre de abajo.`
              : "Sin foto propia: se usará la de escritorio cuando la subas."}
          </p>
        )}
        {!esEscritorio && propia && (
          <p className="imagenes-nota ok">
            <CheckCircle2 size={13} aria-hidden="true" /> En {actual.nombre.toLowerCase()} se ve esta foto en lugar de la de escritorio.
          </p>
        )}

        {claves.enfoque in props && (
          <CampoEncuadre
            key={`encuadre-${actual.clave}`}
            valor={texto(claves.enfoque)}
            porDefecto={String(props[claves.enfoque]?.default ?? "50% 50%")}
            heredado={esEscritorio ? undefined : encuadreEscritorio}
            imagen={enUso}
            proporcion={actual.proporcion}
            onCambio={(v) => onCambio({ [claves.enfoque]: v })}
          />
        )}
      </div>
    </div>
  );
}
