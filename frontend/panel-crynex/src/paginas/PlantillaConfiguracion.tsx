/**
 * La ficha de la plantilla y las acciones de plataforma, en un diálogo aparte.
 *
 * Es exactamente el contenido que antes vivía en la pestaña "Ficha" —nombre,
 * slug, sector, descripción, imagen de muestra, orden, resumen, probar en una
 * empresa, enlace de prueba, asignar, retirar/reactivar— solo que ya no
 * compite por espacio con "Secciones": construir una página y administrar la
 * plantilla son tareas distintas, y esta se abre a un clic (el engranaje de la
 * barra superior) en vez de ser una pestaña permanente.
 *
 * Se reutiliza `Modal` en vez de inventar un panel deslizante nuevo: el
 * formulario es largo pero no tan largo como para necesitar una superficie
 * propia, y así no se introduce un segundo patrón de diálogo en el sistema.
 */
import { useState } from "react";
import { Boton, Dato } from "../ui/basicos";
import { Modal } from "../ui/Modal";
import type { EnlaceDePrueba, NegocioBreve, Plantilla } from "../api/tienda";

interface Props {
  borrador: Plantilla;
  onCambiar: (borrador: Plantilla) => void;
  negocios: NegocioBreve[];
  negocioPrueba: number | "";
  onCambiarNegocioPrueba: (v: number | "") => void;
  enlace: EnlaceDePrueba | null;
  probando: boolean;
  asignando: boolean;
  cambiado: boolean;
  onGenerarEnlace: () => void;
  onAsignar: () => void;
  onCopiarEnlace: () => void;
  onCerrar: () => void;
}

export function PlantillaConfiguracion({
  borrador,
  onCambiar,
  negocios,
  negocioPrueba,
  onCambiarNegocioPrueba,
  enlace,
  probando,
  asignando,
  cambiado,
  onGenerarEnlace,
  onAsignar,
  onCopiarEnlace,
  onCerrar,
}: Props) {
  const [seccion, setSeccion] = useState<"ficha" | "probar">("ficha");

  return (
    <Modal
      titulo="Configuración de la plantilla"
      descripcion={borrador.nombre}
      ancho={560}
      onCerrar={onCerrar}
    >
      <nav className="pestanas" style={{ marginBottom: 16 }}>
        <button type="button" className={seccion === "ficha" ? "active" : undefined} onClick={() => setSeccion("ficha")}>
          Ficha
        </button>
        <button type="button" className={seccion === "probar" ? "active" : undefined} onClick={() => setSeccion("probar")}>
          Probar y asignar
        </button>
      </nav>

      {seccion === "ficha" && (
        <div className="formulario">
          <label className="campo">
            <span className="campo__etiqueta">Nombre</span>
            <input
              value={borrador.nombre}
              onChange={(e) => onCambiar({ ...borrador, nombre: e.target.value })}
            />
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Identificador</span>
            <input value={borrador.slug} readOnly spellCheck={false} />
            <span className="campo__ayuda">
              No se cambia: las tiendas ya adoptadas lo tienen anotado en su historial.
            </span>
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Sector</span>
            <input
              value={borrador.sector}
              placeholder="Alimentos, Moda, Restaurante…"
              onChange={(e) => onCambiar({ ...borrador, sector: e.target.value })}
            />
            <span className="campo__ayuda">
              Agrupa las plantillas en la galería y guía la elección al dar de alta un cliente.
            </span>
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Descripción</span>
            <textarea
              rows={3}
              value={borrador.descripcion}
              placeholder="Para quién es y qué trae."
              onChange={(e) => onCambiar({ ...borrador, descripcion: e.target.value })}
            />
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Imagen de muestra</span>
            <input
              value={borrador.vista_previa}
              placeholder="https://…"
              spellCheck={false}
              onChange={(e) => onCambiar({ ...borrador, vista_previa: e.target.value })}
            />
            <span className="campo__ayuda">Una captura de cómo queda. Se enseña al elegir plantilla.</span>
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Orden en la galería</span>
            <input
              type="number"
              min={0}
              value={borrador.orden}
              onChange={(e) => onCambiar({ ...borrador, orden: Number(e.target.value) })}
            />
          </label>

          <div className="campo">
            <span className="campo__etiqueta">Resumen</span>
            <dl className="datos">
              <Dato etiqueta="Secciones">
                {Object.values(borrador.paginas).reduce((n, c) => n + c.length, 0)} en{" "}
                {Object.keys(borrador.paginas).length} páginas
              </Dato>
              <Dato etiqueta="Aspecto">{Object.keys(borrador.tema_valores ?? {}).length} ajustes</Dato>
            </dl>
          </div>

          <hr className="constructor__separador" />

          <div className="ficha__acciones">
            <Boton onClick={() => onCambiar({ ...borrador, activa: !borrador.activa })}>
              {borrador.activa ? "Retirar del catálogo" : "Reactivar"}
            </Boton>
          </div>
          <span className="campo__ayuda">
            Retirarla impide adoptarla en clientes nuevos. Las tiendas que salieron de ella no
            cambian: al adoptarla se copió, no se enlazó.
          </span>
        </div>
      )}

      {seccion === "probar" && (
        <div className="formulario">
          {/*
            Probar y asignar, en ese orden y separados a proposito.

            La previa de al lado ensena la plantilla con datos de ejemplo en un
            marco estrecho; lo que decide si un molde sirve es verlo con el
            catalogo real de alguien y a pantalla completa. El enlace hace eso
            sin escribir nada. Asignar si escribe, y por eso va debajo y dice lo
            que hace.
          */}
          <div className="campo">
            <span className="campo__etiqueta">Probar en una empresa</span>
            <select
              value={negocioPrueba}
              onChange={(e) => onCambiarNegocioPrueba(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Elige una empresa…</option>
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
            </select>
            <span className="campo__ayuda">Con su catálogo, sus fotos y sus precios. No le cambia nada.</span>
          </div>

          <div className="ficha__acciones">
            <Boton disabled={negocioPrueba === "" || probando || cambiado} onClick={onGenerarEnlace}>
              {probando ? "Generando…" : "Enlace de prueba"}
            </Boton>
            <Boton disabled={negocioPrueba === "" || asignando || cambiado} onClick={onAsignar}>
              {asignando ? "Asignando…" : "Asignar a esta empresa"}
            </Boton>
          </div>
          {cambiado && (
            <span className="campo__ayuda">
              Guarda los cambios antes: el enlace y la asignación leen lo que hay en el servidor,
              no lo que tienes a medias aquí.
            </span>
          )}

          {enlace && (
            <div className="campo">
              <span className="campo__etiqueta">Enlace para {enlace.negocio}</span>
              <input readOnly value={enlace.url} spellCheck={false} />
              <div className="ficha__acciones">
                <Boton onClick={onCopiarEnlace}>Copiar</Boton>
                <Boton onClick={() => window.open(enlace.url, "_blank")}>Abrir</Boton>
              </div>
              <span className="campo__ayuda">
                Vale {enlace.horas} horas. Compone {enlace.rutas.join(", ")} sobre la tienda real;
                lo publicado no se toca y los visitantes siguen viendo lo de siempre.
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
