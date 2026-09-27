import { AlertTriangle, ImagePlus, Library, Trash2, Upload, Video } from "lucide-react";
import { useRef, useState } from "react";
import { subirArchivo } from "../../../api/media";
import { MediaPickerModal } from "../../../components/MediaPickerModal";
import type { Archivo } from "../../../types";
import { extraerMensajeError } from "../../../utils";

/**
 * Una foto o un video de un bloque: subir, reemplazar, elegir de la
 * biblioteca o quitar, con vista previa. Antes era un campo de texto donde
 * había que pegar una URL — algo que un administrador no debería tener que
 * saber hacer.
 *
 * Lo que se guarda en el bloque sigue siendo la URL (el bloque no cambia):
 * subir un archivo lo lleva primero a la biblioteca de medios del negocio —su
 * prefijo en el bucket— y se usa la URL pública que devuelve.
 *
 * # Validación
 *
 * Tipo y peso ANTES de subir (el servidor también valida). Al cargar la vista
 * previa se miden las dimensiones y se avisa si quedan por debajo de lo
 * recomendado para ese uso: no se bloquea —una foto pequeña es mejor que
 * ninguna—, se advierte. Si la URL guardada no carga, se dice en vez de
 * mostrar un marco roto.
 */
const LIMITES = {
  imagen: { tipos: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"], mb: 8, acepta: "image/*" },
  video: { tipos: ["video/mp4", "video/webm"], mb: 60, acepta: "video/mp4,video/webm" },
} as const;

/**
 * La dirección para PREVISUALIZAR un archivo. Las fotos de la tienda pueden
 * guardarse como ruta propia de la tienda (`/img/home/…`), que el panel —otro
 * dominio— no sirve: se resuelven contra la dirección de la tienda.
 */
export function urlDeVista(valor: string): string {
  if (!valor.startsWith("/") || valor.startsWith("//")) return valor;
  const tienda = String(import.meta.env.VITE_TIENDA_URL ?? "").replace(/\/+$/, "");
  return tienda ? `${tienda}${valor}` : valor;
}

/** Ancho mínimo sugerido según para qué es la foto (por el nombre del campo). */
function anchoRecomendado(clave: string): number | null {
  if (/movil/.test(clave)) return 800;
  if (/^(imagen|fondo|poster_url)$/.test(clave)) return 1600;
  if (/foto|logo/.test(clave)) return 400;
  return null;
}

export function CampoMedio({
  clave,
  tipo,
  etiqueta,
  ayuda,
  valor,
  onCambio,
}: {
  clave: string;
  tipo: "imagen" | "video";
  etiqueta: string;
  ayuda?: string;
  valor: string;
  onCambio: (url: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rota, setRota] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const limites = LIMITES[tipo];
  // Los esquemas viejos dicen "Foto (URL)": ya no hay que pegar ninguna URL.
  etiqueta = etiqueta.replace(/\s*\(URL[^)]*\)/i, "").replace(/\s*\(MP4[^)]*\)/i, "");
  const minimo = tipo === "imagen" ? anchoRecomendado(clave) : null;

  async function subir(archivo: File | null) {
    if (!archivo) return;
    setError(null);
    setAviso(null);
    if (!limites.tipos.includes(archivo.type as never)) {
      setError(tipo === "imagen" ? "Formato no permitido: usa JPG, PNG, WEBP, GIF o SVG." : "Formato no permitido: usa MP4 o WEBM.");
      return;
    }
    if (archivo.size > limites.mb * 1024 * 1024) {
      setError(`El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${limites.mb} MB.`);
      return;
    }
    setSubiendo(true);
    try {
      const guardado = await subirArchivo(archivo);
      if (!guardado.url) throw new Error("sin url");
      setRota(false);
      onCambio(guardado.url);
    } catch (e) {
      setError(extraerMensajeError(e, "No se pudo subir el archivo. Intenta de nuevo."));
    } finally {
      setSubiendo(false);
    }
  }

  function elegir(archivo: Archivo) {
    setBiblioteca(false);
    if (!archivo.url) return;
    setError(null);
    setRota(false);
    onCambio(archivo.url);
  }

  function medir(img: HTMLImageElement) {
    setRota(false);
    if (minimo && img.naturalWidth > 0 && img.naturalWidth < minimo) {
      setAviso(`Mide ${img.naturalWidth}×${img.naturalHeight}px: para este espacio se recomienda al menos ${minimo}px de ancho, o se verá borrosa.`);
    } else {
      setAviso(null);
    }
  }

  return (
    <div className="campo">
      <label>{etiqueta}</label>
      <div className={`campo-medio ${valor ? "con-valor" : ""}`}>
        <button
          type="button"
          className="campo-medio-previa"
          onClick={() => input.current?.click()}
          aria-label={valor ? `Reemplazar ${etiqueta.toLowerCase()}` : `Subir ${etiqueta.toLowerCase()}`}
          disabled={subiendo}
        >
          {valor && !rota ? (
            tipo === "imagen" ? (
              <img src={urlDeVista(valor)} alt="" onLoad={(e) => medir(e.currentTarget)} onError={() => setRota(true)} />
            ) : (
              <video src={urlDeVista(valor)} muted playsInline preload="metadata" onError={() => setRota(true)} />
            )
          ) : rota ? (
            <AlertTriangle size={20} />
          ) : tipo === "imagen" ? (
            <ImagePlus size={22} strokeWidth={1.5} />
          ) : (
            <Video size={22} strokeWidth={1.5} />
          )}
          {subiendo && <span className="campo-medio-subiendo">Subiendo…</span>}
        </button>
        <div className="campo-medio-acciones">
          <div>
            <button type="button" className="btn secundario btn-pequeno" onClick={() => input.current?.click()} disabled={subiendo}>
              <Upload size={13} /> {valor ? "Reemplazar" : "Subir"}
            </button>
            {tipo === "imagen" && (
              <button type="button" className="btn secundario btn-pequeno" onClick={() => setBiblioteca(true)} disabled={subiendo}>
                <Library size={13} /> Biblioteca
              </button>
            )}
            {valor && (
              <button
                type="button"
                className="btn-icon peligro"
                onClick={() => {
                  onCambio("");
                  setAviso(null);
                  setRota(false);
                }}
                aria-label={`Quitar ${etiqueta.toLowerCase()}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {rota && <p className="campo-error">No se pudo cargar este archivo: reemplázalo o quítalo.</p>}
          {error && <p className="campo-error">{error}</p>}
          {aviso && <p className="campo-aviso">{aviso}</p>}
          {!error && !aviso && !rota && (
            <p className="campo-ayuda">
              {ayuda ||
                (tipo === "imagen"
                  ? `JPG, PNG o WEBP hasta ${limites.mb} MB${minimo ? ` · ideal ${minimo}px de ancho o más` : ""}.`
                  : `MP4 hasta ${limites.mb} MB. Se reproduce en silencio y en bucle.`)}
            </p>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={limites.acepta}
        hidden
        onChange={(e) => {
          void subir(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {biblioteca && <MediaPickerModal onCerrar={() => setBiblioteca(false)} onSeleccionar={elegir} />}
    </div>
  );
}
