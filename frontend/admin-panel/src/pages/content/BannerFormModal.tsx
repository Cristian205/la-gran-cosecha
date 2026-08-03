import { useState } from "react";
import { actualizarBanner, crearBanner } from "../../api/content";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import type { PromoBanner } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  banner: PromoBanner | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function BannerFormModal({ banner, onCerrar, onGuardado }: Props) {
  const [etiqueta, setEtiqueta] = useState(banner?.etiqueta ?? "");
  const [titulo, setTitulo] = useState(banner?.titulo ?? "");
  const [texto, setTexto] = useState(banner?.texto ?? "");
  const [ctaTexto, setCtaTexto] = useState(banner?.cta_texto ?? "Ver tienda");
  const [ctaHref, setCtaHref] = useState(banner?.cta_href ?? "/tienda");
  const [orden, setOrden] = useState(banner?.orden ?? 0);
  const [activo, setActivo] = useState(banner?.activo ?? true);
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
      if (banner) {
        await actualizarBanner(banner.id, payload, imagen);
      } else {
        await crearBanner(payload, imagen);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar el banner."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={banner ? "Editar banner" : "Nuevo banner"}
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
          <label>Imagen del banner</label>
          <MediaField
            valor={imagen}
            urlActual={banner?.imagen_url ?? null}
            onCambiar={setImagen}
            accept="image/png,image/jpeg,image/webp"
          />
        </div>
        <div className="campo">
          <label>Etiqueta (ej: 🌱 Directo del campo)</label>
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
