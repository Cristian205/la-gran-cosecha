import { useState } from "react";
import { actualizarCategoria, crearCategoria } from "../../api/resources";
import { MediaField } from "../../components/MediaField";
import { Modal } from "../../components/Modal";
import type { Categoria, PreguntaFrecuente } from "../../types";
import { extraerMensajeError } from "../../utils";
import "./producto-modal.css";

interface Props {
  categoria: Categoria | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

export function CategoryFormModal({ categoria, onCerrar, onGuardado }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre_categoria ?? "");
  const [abreviatura, setAbreviatura] = useState(categoria?.abreviatura ?? "");
  const [orden, setOrden] = useState(categoria?.orden ?? 0);
  const [estado, setEstado] = useState(categoria?.estado_categoria ?? true);
  const [subtitulo, setSubtitulo] = useState(categoria?.subtitulo ?? "");
  const [ctaTexto, setCtaTexto] = useState(categoria?.cta_texto ?? "");
  const [imagen, setImagen] = useState<File | null>(null);
  // SEO de la página /tienda/<slug>. Todo opcional: vacío, la tienda lo arma
  // con los datos reales de la categoría.
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? "");
  const [seoTitulo, setSeoTitulo] = useState(categoria?.seo_titulo ?? "");
  const [seoDescripcion, setSeoDescripcion] = useState(categoria?.seo_descripcion ?? "");
  const [preguntas, setPreguntas] = useState<PreguntaFrecuente[]>(categoria?.preguntas_frecuentes ?? []);

  function cambiarPregunta(i: number, cambios: Partial<PreguntaFrecuente>) {
    setPreguntas((prev) => prev.map((p, j) => (j === i ? { ...p, ...cambios } : p)));
  }

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !abreviatura.trim()) {
      setError("El nombre y la abreviatura son obligatorios.");
      return;
    }

    const payload = {
      nombre_categoria: nombre.trim(),
      abreviatura: abreviatura.trim(),
      orden,
      estado_categoria: estado,
      subtitulo: subtitulo.trim(),
      cta_texto: ctaTexto.trim(),
      descripcion: descripcion.trim(),
      seo_titulo: seoTitulo.trim(),
      seo_descripcion: seoDescripcion.trim(),
      // Las filas a medio escribir no se guardan (el servidor también las descarta).
      preguntas_frecuentes: preguntas
        .map((p) => ({ pregunta: p.pregunta.trim(), respuesta: p.respuesta.trim() }))
        .filter((p) => p.pregunta && p.respuesta),
    };

    setGuardando(true);
    try {
      if (categoria) {
        await actualizarCategoria(categoria.id, payload, imagen);
      } else {
        await crearCategoria(payload, imagen);
      }
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar la categoría."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={categoria ? "Editar categoría" : "Nueva categoría"}
      onCerrar={onCerrar}
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
          <label>Foto de la categoría</label>
          <MediaField
            valor={imagen}
            urlActual={categoria?.imagen_url ?? null}
            onCambiar={setImagen}
            accept="image/png,image/jpeg,image/webp"
            ayuda="Se usa en los tiles de categoría de Inicio, en vez de un color plano."
          />
        </div>

        <div className="campo">
          <label>Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Verduras" />
        </div>
        <div className="fila">
          <div className="campo">
            <label>Abreviatura * (para el código de producto)</label>
            <input
              value={abreviatura}
              onChange={(e) => setAbreviatura(e.target.value)}
              placeholder="Ej: VER"
            />
          </div>
          <div className="campo">
            <label>Orden</label>
            <input
              type="number"
              value={orden}
              onChange={(e) => setOrden(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="campo">
          <label>Frase publicitaria (opcional)</label>
          <input
            value={subtitulo}
            onChange={(e) => setSubtitulo(e.target.value)}
            placeholder="Ej: Directo del campo. Máxima duración, cero mermas."
            maxLength={160}
          />
        </div>
        <div className="campo">
          <label>Texto del botón (opcional)</label>
          <input
            value={ctaTexto}
            onChange={(e) => setCtaTexto(e.target.value)}
            placeholder="Ej: Abastecer mi Frutería"
            maxLength={60}
          />
          <small className="campo-ayuda">
            Se usan en la variante "vidriera" de categorías de Inicio. Sin ellos, se ve el tile simple de siempre.
          </small>
        </div>

        <fieldset className="campo-grupo-seo">
          <legend>Página de la categoría en Google</legend>
          <p className="campo-ayuda">
            {categoria?.slug ? <>Se publica en <code>/tienda/{categoria.slug}</code>. </> : null}
            Todo es opcional: vacío, la tienda arma el título, la descripción y la introducción con los productos reales
            de la categoría. Escribe solo lo que el catálogo no sabe: a quién le vendes y cómo trabajas.
          </p>

          <div className="campo">
            <label htmlFor="cat-descripcion">Introducción comercial</label>
            <textarea
              id="cat-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              maxLength={1200}
              placeholder="Ej: Abastecemos restaurantes, fruterías y hogares con frutas por libra, caja y canastilla…"
            />
            <small className="campo-ayuda">
              Se muestra bajo el título de la página. Deja una línea en blanco para separar párrafos. {descripcion.length}/1200
            </small>
          </div>

          <div className="campo">
            <label htmlFor="cat-seo-titulo">Título en Google</label>
            <input
              id="cat-seo-titulo"
              value={seoTitulo}
              onChange={(e) => setSeoTitulo(e.target.value)}
              maxLength={70}
              placeholder={`${nombre.trim() || "Frutas"}: precios y presentaciones`}
            />
            <small className="campo-ayuda">El nombre del negocio se añade solo al final. {seoTitulo.length}/70</small>
          </div>

          <div className="campo">
            <label htmlFor="cat-seo-descripcion">Descripción en Google</label>
            <textarea
              id="cat-seo-descripcion"
              value={seoDescripcion}
              onChange={(e) => setSeoDescripcion(e.target.value)}
              rows={2}
              maxLength={160}
              placeholder="Vacía: se genera con la cantidad de productos y algunos ejemplos."
            />
            <small className="campo-ayuda">{seoDescripcion.length}/160</small>
          </div>

          <div className="campo">
            <label>Preguntas frecuentes</label>
            <small className="campo-ayuda">
              Se muestran al final de la página de la categoría. Responde con información real (zonas, horarios,
              pedidos mínimos); si no es segura, mejor no ponerla.
            </small>
            {preguntas.map((p, i) => (
              <div key={i} className="pregunta-frecuente">
                <input
                  aria-label={`Pregunta ${i + 1}`}
                  value={p.pregunta}
                  maxLength={200}
                  onChange={(e) => cambiarPregunta(i, { pregunta: e.target.value })}
                  placeholder="¿Venden por caja o canastilla?"
                />
                <textarea
                  aria-label={`Respuesta ${i + 1}`}
                  value={p.respuesta}
                  maxLength={1000}
                  rows={2}
                  onChange={(e) => cambiarPregunta(i, { respuesta: e.target.value })}
                  placeholder="Respuesta"
                />
                <button
                  type="button"
                  className="btn secundario"
                  onClick={() => setPreguntas((prev) => prev.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              </div>
            ))}
            {preguntas.length < 10 && (
              <button
                type="button"
                className="btn secundario"
                onClick={() => setPreguntas((prev) => [...prev, { pregunta: "", respuesta: "" }])}
              >
                Añadir pregunta
              </button>
            )}
          </div>
        </fieldset>

        <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <input
            type="checkbox"
            checked={estado}
            onChange={(e) => setEstado(e.target.checked)}
            style={{ width: "auto" }}
          />
          Categoría activa
        </label>
      </form>
    </Modal>
  );
}
