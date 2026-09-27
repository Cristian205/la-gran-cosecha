import { ImagePlus, Library, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { descargarArchivo, subirArchivo } from "../../api/media";
import { MediaPickerModal } from "../../components/MediaPickerModal";
import type { Archivo } from "../../types";

/**
 * La foto de UNA presentación, en pequeño: cabe en la fila de la
 * presentación sin convertir el formulario en una galería.
 *
 * Mismo criterio que `MediaField` (la foto del producto): subir un archivo
 * nuevo —que además queda en la biblioteca para reusarlo— o elegir uno de la
 * biblioteca. El formulario recibe un `File` o la orden de quitar la actual,
 * y guarda todo junto al pulsar "Guardar".
 */
interface Props {
  /** La foto que ya tiene la presentación, si tiene. */
  urlActual: string | null;
  /** El archivo nuevo elegido (aún sin guardar). */
  archivo: File | null;
  /** Se pidió quitar la foto actual. */
  quitar: boolean;
  nombre: string;
  onCambiar: (cambio: { archivo: File | null; quitar: boolean }) => void;
}

const ACEPTA = "image/png,image/jpeg,image/webp";

export function FotoPresentacion({ urlActual, archivo, quitar, nombre, onCambiar }: Props) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [biblioteca, setBiblioteca] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!archivo) {
      setPrevia(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const imagen = previa ?? (quitar ? null : urlActual);
  const etiqueta = nombre.trim() || "esta presentación";

  function elegir(file: File | null) {
    if (!file) return;
    onCambiar({ archivo: file, quitar: false });
    subirArchivo(file).catch(() => {});
  }

  async function desdeBiblioteca(a: Archivo) {
    setBiblioteca(false);
    try {
      const blob = await descargarArchivo(a.id);
      onCambiar({ archivo: new File([blob], a.nombre_original, { type: a.content_type }), quitar: false });
    } catch {
      // Si la descarga falla no se elige nada; el formulario sigue igual.
    }
  }

  return (
    <div className="pres-foto">
      <button
        type="button"
        className={`pres-foto-marco ${imagen ? "con-foto" : ""}`}
        onClick={() => input.current?.click()}
        aria-label={imagen ? `Cambiar la foto de ${etiqueta}` : `Subir una foto de ${etiqueta}`}
      >
        {imagen ? <img src={imagen} alt="" /> : <ImagePlus size={20} strokeWidth={1.6} />}
        {archivo && <span className="pres-foto-nueva">Nueva</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACEPTA}
        hidden
        onChange={(e) => {
          elegir(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <div className="pres-foto-acciones">
        <span className="pres-foto-titulo">Foto de la presentación</span>
        <div>
          <button type="button" className="pres-foto-btn" onClick={() => input.current?.click()}>
            <Upload size={13} /> Subir
          </button>
          <button type="button" className="pres-foto-btn" onClick={() => setBiblioteca(true)}>
            <Library size={13} /> Biblioteca
          </button>
          {imagen && (
            <button
              type="button"
              className="pres-foto-btn peligro"
              onClick={() => onCambiar({ archivo: null, quitar: Boolean(urlActual) })}
              aria-label={`Quitar la foto de ${etiqueta}`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <span className="pres-foto-ayuda">
          {imagen ? "Se muestra al elegir esta presentación en la tienda." : "Opcional: sin foto, se usa la del producto."}
        </span>
      </div>
      {biblioteca && <MediaPickerModal onCerrar={() => setBiblioteca(false)} onSeleccionar={desdeBiblioteca} />}
    </div>
  );
}
