import { useState } from "react";
import { actualizarBanner, crearBanner } from "../../api/content";
import { MediaField } from "../../components/MediaField";
import { Vigencia } from "./Vigencia";
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
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [imagenMovil, setImagenMovil] = useState<File | null>(null);
  const [quitarMovil, setQuitarMovil] = useState(false);
  const [vigencia, setVigencia] = useState({ inicio: banner?.fecha_inicio ?? null, fin: banner?.fecha_fin ?? null });

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
      fecha_inicio: vigencia.inicio,
      fecha_fin: vigencia.fin,
    };
    const imagenes = {
      imagen: imagen ?? (quitarImagen ? ("quitar" as const) : null),
      imagen_movil: imagenMovil ?? (quitarMovil ? ("quitar" as const) : null),
    };

    if (vigencia.inicio && vigencia.fin && new Date(vigencia.inicio) > new Date(vigencia.fin)) {
      setError("La fecha de fin es anterior a la de inicio.");
      return;
    }

    setGuardando(true);
    try {
      if (banner) {
        await actualizarBanner(banner.id, payload, imagenes);
      } else {
        await crearBanner(payload, imagenes);
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
            onCambiar={(f) => {
              setImagen(f);
              if (f) setQuitarImagen(false);
            }}
            quitada={quitarImagen}
            onQuitarActual={setQuitarImagen}
            accept="image/png,image/jpeg,image/webp"
          />
        </div>
        <div className="campo">
          <label>Imagen para móvil (opcional)</label>
          <MediaField
            valor={imagenMovil}
            urlActual={banner?.imagen_movil_url ?? null}
            onCambiar={(f) => {
              setImagenMovil(f);
              if (f) setQuitarMovil(false);
            }}
            quitada={quitarMovil}
            onQuitarActual={setQuitarMovil}
            accept="image/png,image/jpeg,image/webp"
            ayuda="Vertical o recortada para celular. Sin ella, se usa la de escritorio."
          />
        </div>
        <Vigencia inicio={vigencia.inicio} fin={vigencia.fin} onCambio={setVigencia} />
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
