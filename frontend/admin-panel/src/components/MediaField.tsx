import { ImagePlus, Library, RefreshCw, Trash2, Undo2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { descargarArchivo, subirArchivo } from "../api/media";
import type { Archivo, DiagnosticoImagen } from "../types";
import { MediaPickerModal } from "./MediaPickerModal";

/** El diagnóstico si la imagen salió de baja calidad; si no, null. */
function diagnosticoBajo(archivo: Archivo): DiagnosticoImagen | null {
  const d = archivo.diagnostico;
  return archivo.calidad === "BAJA" && d.motivos ? (d as DiagnosticoImagen) : null;
}

interface Props {
  valor: File | null;
  urlActual: string | null;
  onCambiar: (file: File | null) => void;
  ayuda?: string;
  accept?: string;
  /** Si se pasa, permite quitar la imagen YA guardada (se aplica al guardar). */
  quitada?: boolean;
  onQuitarActual?: (quitar: boolean) => void;
  /**
   * «fila» (por defecto): miniatura y botones al lado, como siempre.
   * «zona»: zona cuadrada de arrastrar y soltar con la vista previa dentro
   * y las acciones encima de la imagen (Nuevo producto).
   */
  variante?: "fila" | "zona";
  /** Solo en «zona»: lo que va bajo la imagen, dentro de la misma tarjeta. */
  pie?: ReactNode;
}

const ACCEPT_DEFAULT = "image/png,image/jpeg,image/webp,image/svg+xml";

/** Si el archivo es de un tipo que `accept` admite (para lo que llega arrastrado). */
function aceptado(file: File, accept: string): boolean {
  return accept
    .split(",")
    .map((t) => t.trim())
    .some((t) => (t.endsWith("/*") ? file.type.startsWith(t.slice(0, -1)) : file.type === t));
}

const nombreFormatos = (accept: string) =>
  accept
    .split(",")
    .map((t) => t.trim().split("/")[1]?.replace("svg+xml", "svg").replace("jpeg", "jpg").toUpperCase())
    .filter(Boolean)
    .join(", ");

/**
 * Campo de imagen reutilizable: subir un archivo nuevo (que además se
 * refleja en la biblioteca de medios para poder reusarlo después) o elegir
 * uno ya existente de la biblioteca. El resultado siempre es un `File`
 * normal, así que el formulario que lo use no cambia su flujo de guardado.
 */
export function MediaField({
  valor,
  urlActual,
  onCambiar,
  ayuda,
  accept = ACCEPT_DEFAULT,
  quitada = false,
  onQuitarActual,
  variante = "fila",
  pie,
}: Props) {
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  // Lo dice el backend al recibirla en la biblioteca: si está pixelada,
  // borrosa o es pequeña, se avisa aquí mismo, antes de guardar el formulario.
  const [aviso, setAviso] = useState<DiagnosticoImagen | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!valor) {
      setPreviewLocal(null);
      return;
    }
    const url = URL.createObjectURL(valor);
    setPreviewLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [valor]);

  function elegirArchivo(file: File | null) {
    onCambiar(file);
    setAviso(null);
    setRechazo(null);
    if (file) {
      subirArchivo(file)
        .then((archivo) => setAviso(diagnosticoBajo(archivo)))
        .catch(() => {});
    }
  }

  async function elegirDeLaBiblioteca(archivo: Archivo) {
    setPickerAbierto(false);
    try {
      const blob = await descargarArchivo(archivo.id);
      const file = new File([blob], archivo.nombre_original, { type: archivo.content_type });
      onCambiar(file);
      setRechazo(null);
      setAviso(diagnosticoBajo(archivo));
    } catch {
      // si la descarga falla, simplemente no se selecciona nada — no rompe el formulario
    }
  }

  function quitar() {
    if (valor) {
      onCambiar(null);
      setAviso(null);
    } else if (urlActual && onQuitarActual) onQuitarActual(true);
  }

  const preview = previewLocal ?? (quitada ? null : urlActual);
  const picker = pickerAbierto && (
    <MediaPickerModal onCerrar={() => setPickerAbierto(false)} onSeleccionar={elegirDeLaBiblioteca} />
  );
  const inputArchivo = (
    <input
      ref={entrada}
      type="file"
      accept={accept}
      hidden
      onChange={(e) => {
        elegirArchivo(e.target.files?.[0] ?? null);
        e.target.value = "";
      }}
    />
  );

  // ------------------------------------------------------------- «zona»
  if (variante === "zona") {
    const soltar = (e: DragEvent) => {
      e.preventDefault();
      setArrastrando(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!aceptado(file, accept)) {
        setRechazo(`Formato no admitido. Usa ${nombreFormatos(accept)}.`);
        return;
      }
      elegirArchivo(file);
    };
    const puedeQuitar = Boolean(valor) || Boolean(urlActual && onQuitarActual && !quitada);

    return (
      <div className="media-zona-tarjeta">
        <div
          className={`media-zona ${arrastrando ? "arrastrando" : ""} ${preview ? "con-imagen" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
        >
          {inputArchivo}
          {preview ? (
            <>
              <img src={preview} alt="Vista previa de la imagen" />
              <div className="media-zona-acciones">
                <button type="button" onClick={() => entrada.current?.click()} title="Reemplazar imagen">
                  <RefreshCw size={14} aria-hidden /> Reemplazar
                </button>
                <button type="button" onClick={() => setPickerAbierto(true)} title="Elegir de la biblioteca">
                  <Library size={14} aria-hidden />
                  <span className="media-zona-sr">Elegir de la biblioteca</span>
                </button>
                {puedeQuitar && (
                  <button type="button" className="peligro" onClick={quitar} title="Eliminar imagen" aria-label="Eliminar imagen">
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="media-zona-vacia">
              <span className="media-zona-icono" aria-hidden>
                <UploadCloud size={22} />
              </span>
              <p className="media-zona-titulo">{arrastrando ? "Suelta la imagen aquí" : "Arrastra una imagen aquí"}</p>
              <p className="media-zona-sub">{nombreFormatos(accept)}</p>
              <div className="media-zona-botones">
                <button type="button" className="btn primario sm" onClick={() => entrada.current?.click()}>
                  <ImagePlus size={14} aria-hidden /> Subir imagen
                </button>
                <button type="button" className="btn secundario sm" onClick={() => setPickerAbierto(true)}>
                  <Library size={14} aria-hidden /> Elegir de biblioteca
                </button>
              </div>
              {quitada && urlActual && onQuitarActual && (
                <button type="button" className="media-zona-deshacer" onClick={() => onQuitarActual(false)}>
                  <Undo2 size={13} aria-hidden /> Deshacer: conservar la imagen actual
                </button>
              )}
            </div>
          )}
        </div>
        {pie}
        {(rechazo || (valor && aviso) || ayuda) && (
          <div className="media-zona-notas">
            {rechazo ? (
              <p className="media-field-aviso" role="alert">
                {rechazo}
              </p>
            ) : valor && aviso ? (
              <p className="media-field-aviso" role="status">
                <strong>{aviso.motivos[0]}</strong>
                {aviso.recomendacion}
              </p>
            ) : (
              <p className="media-field-ayuda">{quitada && !valor ? "La imagen se quitará al guardar." : ayuda}</p>
            )}
          </div>
        )}
        {picker}
      </div>
    );
  }

  // -------------------------------------------------------------- «fila»
  return (
    <div className="media-field">
      <div className="media-field-preview">
        {preview ? <img src={preview} alt="" /> : <ImagePlus size={26} strokeWidth={1.5} />}
      </div>
      <div className="media-field-cuerpo">
        <div className="media-field-acciones">
          <label className="btn secundario sm">
            Subir archivo
            <input type="file" accept={accept} hidden onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn secundario sm" onClick={() => setPickerAbierto(true)}>
            <Library size={14} /> Elegir de la biblioteca
          </button>
          {valor && (
            <button
              type="button"
              className="btn-icon peligro"
              onClick={() => {
                onCambiar(null);
                setAviso(null);
              }}
              aria-label="Quitar selección"
            >
              <X size={14} />
            </button>
          )}
          {!valor && urlActual && onQuitarActual && (
            <button type="button" className="btn secundario sm" onClick={() => onQuitarActual(!quitada)}>
              {quitada ? "Deshacer" : "Quitar imagen"}
            </button>
          )}
        </div>
        {quitada && !valor ? (
          <p className="media-field-ayuda">La imagen se quitará al guardar.</p>
        ) : (
          ayuda && <p className="media-field-ayuda">{ayuda}</p>
        )}
        {valor && aviso && (
          <p className="media-field-aviso" role="status">
            <strong>{aviso.motivos[0]}</strong>
            {aviso.recomendacion}
          </p>
        )}
      </div>
      {picker}
    </div>
  );
}
