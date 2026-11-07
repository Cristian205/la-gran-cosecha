import { ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CAMPOS_FACTURA, vistaPreviaFactura } from "../../api/content";
import type { SiteConfig } from "../../types";

/** Espera tras la última tecla antes de volver a pedir el PDF. */
const ESPERA_MS = 700;

/**
 * La factura de un pedido de prueba, tal como saldrá impresa, al lado del
 * formulario de Facturación. No es un dibujo aproximado: el backend la genera
 * con la misma plantilla y el mismo motor (WeasyPrint) que la factura real,
 * con los datos del formulario aunque aún no se hayan guardado y con
 * productos y precios reales del catálogo. Se vuelve a pedir sola al editar.
 */
export function VistaPreviaFactura({ config, facturaLogo }: { config: SiteConfig; facturaLogo: File | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const urlActual = useRef<string | null>(null);

  // Solo los campos que cambian la factura: editar otra cosa no la regenera.
  const clave = useMemo(
    () => JSON.stringify(CAMPOS_FACTURA.map((c) => config[c])) + (facturaLogo ? `${facturaLogo.name}:${facturaLogo.size}` : ""),
    [config, facturaLogo]
  );

  useEffect(() => {
    const control = new AbortController();
    setCargando(true);
    const t = setTimeout(() => {
      vistaPreviaFactura(config, facturaLogo, control.signal)
        .then((pdf) => {
          const nueva = URL.createObjectURL(pdf);
          if (urlActual.current) URL.revokeObjectURL(urlActual.current);
          urlActual.current = nueva;
          setUrl(nueva);
          setError(null);
        })
        .catch((e) => {
          if (control.signal.aborted) return;
          setError(e?.response?.status === 403 ? "No tiene permiso para ver la vista previa." : "No se pudo generar la vista previa.");
        })
        .finally(() => {
          if (!control.signal.aborted) setCargando(false);
        });
    }, ESPERA_MS);
    return () => {
      clearTimeout(t);
      control.abort();
    };
    // `clave` resume lo que importa de `config` y del logo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);

  useEffect(() => () => {
    if (urlActual.current) URL.revokeObjectURL(urlActual.current);
  }, []);

  return (
    <aside className="factura-previa" aria-labelledby="factura-previa-titulo">
      <div className="factura-previa-cab">
        <div>
          <h3 id="factura-previa-titulo">
            <FileText size={16} aria-hidden="true" /> Vista previa
          </h3>
          <p>Pedido de prueba con productos de tu catálogo. Así se imprimirá.</p>
        </div>
        <div className="factura-previa-acciones">
          <span className={`factura-previa-estado ${cargando ? "visible" : ""}`} role="status" aria-live="polite">
            {cargando && (
              <>
                <Loader2 size={14} className="girando" aria-hidden="true" /> Actualizando…
              </>
            )}
          </span>
          {url && (
            <a className="btn secundario sm" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} aria-hidden="true" /> Abrir
            </a>
          )}
        </div>
      </div>

      <div className={`factura-previa-hoja ${cargando && url ? "actualizando" : ""}`}>
        {error ? (
          <div className="factura-previa-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn secundario sm" onClick={() => setIntento((n) => n + 1)}>
              <RefreshCw size={14} aria-hidden="true" /> Reintentar
            </button>
          </div>
        ) : url ? (
          <iframe title="Vista previa de la factura" src={`${url}#toolbar=0&navpanes=0&view=FitH`} />
        ) : (
          <div className="factura-previa-cargando">
            <Loader2 size={22} className="girando" aria-hidden="true" />
            <span>Generando la factura de prueba…</span>
          </div>
        )}
      </div>
      <p className="factura-previa-nota">
        Los cambios se ven aquí al instante, pero solo se aplican a las facturas cuando guardas.
      </p>
    </aside>
  );
}
