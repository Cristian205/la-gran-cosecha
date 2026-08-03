import { Copy, FolderUp, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { eliminarArchivo, obtenerArchivos, subirArchivo } from "../../api/media";
import { ArchivosGrid } from "../../components/ArchivosGrid";
import { Tooltip } from "../../components/Tooltip";
import type { Archivo } from "../../types";
import { extraerMensajeError } from "../../utils";
import { alertaError, confirmarEliminar } from "../../utils/alertas";

const FILTROS: { valor: Archivo["tipo"] | ""; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todos" },
  { valor: "IMAGEN", etiqueta: "Imágenes" },
  { valor: "VIDEO", etiqueta: "Videos" },
  { valor: "DOCUMENTO", etiqueta: "Documentos" },
];

const TIPOS_ACEPTADOS =
  "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,application/pdf";

export function ArchivosTab() {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Archivo["tipo"] | "">("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  function cargar() {
    setCargando(true);
    obtenerArchivos({ tipo: filtro || undefined, search: busqueda || undefined })
      .then(setArchivos)
      .catch(() => setError("No se pudieron cargar los archivos."))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, filtro]);

  async function subir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);
    setSubiendo(true);
    try {
      for (const archivo of Array.from(lista)) {
        await subirArchivo(archivo);
      }
      cargar();
    } catch {
      setError("No se pudo subir uno o más archivos (revisa el formato y el tamaño).");
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(a: Archivo) {
    if (!(await confirmarEliminar(`¿Eliminar "${a.nombre_original}"?`, "Esta acción no se puede deshacer.")))
      return;
    try {
      await eliminarArchivo(a.id);
      cargar();
    } catch (err) {
      alertaError(extraerMensajeError(err, "No se pudo eliminar el archivo."));
    }
  }

  function copiarEnlace(a: Archivo) {
    if (!a.url) return;
    navigator.clipboard.writeText(a.url).then(() => {
      setCopiadoId(a.id);
      setTimeout(() => setCopiadoId(null), 1500);
    });
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>Biblioteca de archivos ({archivos.length})</h2>
        <label className="btn primario sm archivos-subir-btn">
          <FolderUp size={15} /> {subiendo ? "Subiendo…" : "Subir archivos"}
          <input
            type="file"
            multiple
            accept={TIPOS_ACEPTADOS}
            onChange={(e) => subir(e.target.files)}
            disabled={subiendo}
            hidden
          />
        </label>
      </div>

      {error && (
        <div className="error-box" style={{ margin: "0 1.2rem 1rem" }}>
          {error}
        </div>
      )}

      <div className="filtros-bar">
        <div className="buscador">
          <Search size={16} />
          <input
            placeholder="Buscar por nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="segmentado">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={filtro === f.valor ? "activo" : ""}
              onClick={() => setFiltro(f.valor)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 1.2rem 1.2rem" }}>
        <ArchivosGrid
          archivos={archivos}
          cargando={cargando}
          renderAcciones={(a) => (
            <>
              <Tooltip label={copiadoId === a.id ? "¡Copiado!" : "Copiar enlace"}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => copiarEnlace(a)}
                  aria-label="Copiar enlace"
                >
                  <Copy size={15} />
                </button>
              </Tooltip>
              <Tooltip label="Eliminar">
                <button
                  type="button"
                  className="btn-icon peligro"
                  onClick={() => eliminar(a)}
                  aria-label="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </Tooltip>
            </>
          )}
        />
      </div>
    </div>
  );
}
