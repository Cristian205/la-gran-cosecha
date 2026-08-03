import { ImagePlus, Library, X } from "lucide-react";
import { useEffect, useState } from "react";
import { subirArchivo } from "../api/media";
import type { Archivo } from "../types";
import { MediaPickerModal } from "./MediaPickerModal";

interface Props {
  valor: File | null;
  urlActual: string | null;
  onCambiar: (file: File | null) => void;
  ayuda?: string;
  accept?: string;
}

const ACCEPT_DEFAULT = "image/png,image/jpeg,image/webp,image/svg+xml";

/**
 * Campo de imagen reutilizable: subir un archivo nuevo (que además se
 * refleja en la biblioteca de medios para poder reusarlo después) o elegir
 * uno ya existente de la biblioteca. El resultado siempre es un `File`
 * normal, así que el formulario que lo use no cambia su flujo de guardado.
 */
export function MediaField({ valor, urlActual, onCambiar, ayuda, accept = ACCEPT_DEFAULT }: Props) {
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);

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
    if (file) {
      subirArchivo(file).catch(() => {});
    }
  }

  async function elegirDeLaBiblioteca(archivo: Archivo) {
    setPickerAbierto(false);
    if (!archivo.url) return;
    try {
      const resp = await fetch(archivo.url);
      const blob = await resp.blob();
      const file = new File([blob], archivo.nombre_original, { type: archivo.content_type });
      onCambiar(file);
    } catch {
      // si el fetch falla, simplemente no se selecciona nada — no rompe el formulario
    }
  }

  const preview = previewLocal ?? urlActual;

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
              onClick={() => onCambiar(null)}
              aria-label="Quitar selección"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {ayuda && <p className="media-field-ayuda">{ayuda}</p>}
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
