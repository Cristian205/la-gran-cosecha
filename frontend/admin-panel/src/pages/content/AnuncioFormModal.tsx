import { useState } from "react";
import { actualizarAnuncio, crearAnuncio } from "../../api/content";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import type { Anuncio } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  anuncio: Anuncio | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function AnuncioFormModal({ anuncio, onCerrar, onGuardado }: Props) {
  const [etiqueta, setEtiqueta] = useState(anuncio?.etiqueta ?? "");
  const [titulo, setTitulo] = useState(anuncio?.titulo ?? "");
  const [texto, setTexto] = useState(anuncio?.texto ?? "");
  const [ctaTexto, setCtaTexto] = useState(anuncio?.cta_texto ?? "Ver productos");
  const [ctaHref, setCtaHref] = useState(anuncio?.cta_href ?? "/tienda");
  const [orden, setOrden] = useState(anuncio?.orden ?? 0);
  const [activo, setActivo] = useState(anuncio?.activo ?? true);
  const [imagen, setImagen] = useState<File | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    const payload = {
      etiqueta,
      titulo,
      texto,
      cta_texto: ctaTexto,
      cta_href: ctaHref,
      orden,
      activo,
    };

    setGuardando(true);
    try {
      if (anuncio) {
        await actualizarAnuncio(anuncio.id, payload, imagen);
      } else {
        await crearAnuncio(payload, imagen);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el anuncio."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={anuncio ? "Editar anuncio" : "Nuevo anuncio"}
      onCerrar={onCerrar}
      lateral
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}

        <div className="campo">
          <label>Imagen del anuncio</label>
          <MediaField
            valor={imagen}
            urlActual={anuncio?.imagen_url ?? null}
            onCambiar={setImagen}
            accept="image/png,image/jpeg,image/webp"
          />
          <small>Sin imagen, la tienda muestra un marcador de posición de la marca.</small>
        </div>
        <div className="campo">
          <label>Etiqueta (ej: Oferta especial)</label>
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
        </div>
        <div className="campo">
          <label>Título *</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="campo">
          <label>Texto</label>
          <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="fila">
          <div className="campo">
            <label>Texto del botón</label>
            <input value={ctaTexto} onChange={(e) => setCtaTexto(e.target.value)} />
          </div>
          <div className="campo">
            <label>Enlace del botón</label>
            <input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} />
          </div>
        </div>
        <div className="fila">
          <div className="campo">
            <label>Orden</label>
            <input
              type="number"
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value) || 0)}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: "1.6rem" }}>
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              style={{ width: "auto" }}
            />
            Activo
          </label>
        </div>
      </form>
    </Modal>
  );
}
