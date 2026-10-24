import { ImagePlus, Library, X } from "lucide-react";
import { useEffect, useState } from "react";
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
}

const ACCEPT_DEFAULT = "image/png,image/jpeg,image/webp,image/svg+xml";

/**
 * Campo de imagen reutilizable: subir un archivo nuevo (que además se
 * refleja en la biblioteca de medios para poder reusarlo después) o elegir
 * uno ya existente de la biblioteca. El resultado siempre es un `File`
 * normal, así que el formulario que lo use no cambia su flujo de guardado.
 */
export function MediaField({ valor, urlActual, onCambiar, ayuda, accept = ACCEPT_DEFAULT, quitada = false, onQuitarActual }: Props) {
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  // Lo dice el backend al recibirla en la biblioteca: si está pixelada,
  // borrosa o es pequeña, se avisa aquí mismo, antes de guardar el formulario.
  const [aviso, setAviso] = useState<DiagnosticoImagen | null>(null);

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
      setAviso(diagnosticoBajo(archivo));
    } catch {
      // si la descarga falla, simplemente no se selecciona nada — no rompe el formulario
    }
  }

  const preview = previewLocal ?? (quitada ? null : urlActual);

  return (
    <div className="media-field">
      <div className="media-field-preview">
        {preview ? <img src={preview} alt="" /> : <ImagePlus size={26} strokeWidth={1.5} />}
      </div>
      <div className="media-field-cuerpo">
        <div className="media-field-acciones">
          <label className="btn secundario sm">
            Subir archivo
            <input
              type="file"
              accept={accept}
              hidden
              onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            />
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
            <button
              type="button"
              className="btn secundario sm"
              onClick={() => onQuitarActual(!quitada)}
            >
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

      {pickerAbierto && (
        <MediaPickerModal
          onCerrar={() => setPickerAbierto(false)}
          onSeleccionar={elegirDeLaBiblioteca}
        />
      )}
    </div>
  );
}
