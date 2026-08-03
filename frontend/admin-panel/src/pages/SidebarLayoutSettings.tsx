import { ChevronDown, ChevronUp, Layers, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { guardarSidebarLayout } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { LAYOUT_POR_DEFECTO, SECCIONES_DISPONIBLES } from "../sidebarConfig";
import type { NodoSidebar } from "../types";
import { extraerMensajeError, tienePermiso } from "../utils";

const SECCIONES_POR_CLAVE = new Map(SECCIONES_DISPONIBLES.map((s) => [s.clave, s]));

function ubicacionActual(layout: NodoSidebar[], clave: string): string {
  for (const nodo of layout) {
    if (nodo.tipo === "item" && nodo.clave === clave) return "";
    if (nodo.tipo === "grupo" && nodo.items.includes(clave)) return nodo.id;
  }
  return "";
}

export function SidebarLayoutSettings() {
  const { usuario, setUsuario } = useAuth();
  const [layout, setLayout] = useState<NodoSidebar[]>(() =>
    usuario?.sidebar_layout && usuario.sidebar_layout.length > 0
      ? usuario.sidebar_layout
      : LAYOUT_POR_DEFECTO
  );
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const grupos = layout.filter(
    (n): n is Extract<NodoSidebar, { tipo: "grupo" }> => n.tipo === "grupo"
  );

  function mover(clave: string, destino: string) {
    setOk(false);
    setLayout((prev) => {
      const sinClave = prev
        .map((n) =>
          n.tipo === "grupo" ? { ...n, items: n.items.filter((c) => c !== clave) } : n
        )
        .filter((n) => !(n.tipo === "item" && n.clave === clave));

      if (destino === "") {
        return [...sinClave, { tipo: "item", clave }];
      }
      return sinClave.map((n) =>
        n.tipo === "grupo" && n.id === destino ? { ...n, items: [...n.items, clave] } : n
      );
    });
  }

  function moverTopLevel(index: number, delta: -1 | 1) {
    setOk(false);
    setLayout((prev) => {
      const destino = index + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[destino]] = [next[destino], next[index]];
      return next;
    });
  }

  function moverEnGrupo(grupoId: string, index: number, delta: -1 | 1) {
    setOk(false);
    setLayout((prev) =>
      prev.map((n) => {
        if (n.tipo !== "grupo" || n.id !== grupoId) return n;
        const destino = index + delta;
        if (destino < 0 || destino >= n.items.length) return n;
        const items = [...n.items];
        [items[index], items[destino]] = [items[destino], items[index]];
        return { ...n, items };
      })
    );
  }

  function renombrarGrupo(id: string, titulo: string) {
    setOk(false);
    setLayout((prev) => prev.map((n) => (n.tipo === "grupo" && n.id === id ? { ...n, titulo } : n)));
  }

  function eliminarGrupo(id: string) {
    setOk(false);
    setLayout((prev) => {
      const index = prev.findIndex((n) => n.tipo === "grupo" && n.id === id);
      if (index === -1) return prev;
      const grupo = prev[index] as Extract<NodoSidebar, { tipo: "grupo" }>;
      const sueltos: NodoSidebar[] = grupo.items.map((clave) => ({ tipo: "item", clave }));
      const next = [...prev];
      next.splice(index, 1, ...sueltos);
      return next;
    });
  }

  function agregarGrupo() {
    if (!nuevoGrupo.trim()) return;
    setOk(false);
    setLayout((prev) => [
      ...prev,
      { tipo: "grupo", id: crypto.randomUUID(), titulo: nuevoGrupo.trim(), items: [] },
    ]);
    setNuevoGrupo("");
  }

  function restablecer() {
    setOk(false);
    setLayout(LAYOUT_POR_DEFECTO);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const actualizado = await guardarSidebarLayout(layout);
      setUsuario(actualizado);
      setOk(true);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar la estructura del menú."));
    } finally {
      setGuardando(false);
    }
  }

  function filaSeccion(clave: string, index: number, total: number, alMover: (delta: -1 | 1) => void) {
    const seccion = SECCIONES_POR_CLAVE.get(clave);
    if (!seccion) return null;
    if (seccion.permiso && !tienePermiso(usuario, seccion.permiso)) return null;
    const Icono = seccion.icon;
    return (
      <div className="sidebar-editor-fila" key={clave}>
        <Icono size={16} />
        <span className="nombre">{seccion.label}</span>
        <select value={ubicacionActual(layout, clave)} onChange={(e) => mover(clave, e.target.value)}>
          <option value="">Nivel superior</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.titulo}
            </option>
          ))}
        </select>
        <div className="sidebar-editor-flechas">
          <button type="button" disabled={index === 0} onClick={() => alMover(-1)} aria-label="Subir">
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => alMover(1)}
            aria-label="Bajar"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="cabecera">
        <h2>
          <Layers size={18} style={{ verticalAlign: "-3px", marginRight: ".4rem" }} />
          Personalizar menú lateral
        </h2>
      </div>
      <div style={{ padding: "1.2rem" }}>
        {error && <div className="error-box">{error}</div>}
        {ok && <div className="ok-box">Estructura guardada correctamente.</div>}
        <p style={{ color: "var(--gris)", fontSize: ".85rem", marginTop: 0 }}>
          Agrupa las secciones como prefieras: los grupos se muestran como menús desplegables
          en tu sidebar. Esta preferencia es solo tuya.
        </p>

        {layout.map((nodo, index) =>
          nodo.tipo === "item" ? (
            filaSeccion(nodo.clave, index, layout.length, (d) => moverTopLevel(index, d))
          ) : (
            <div className="sidebar-editor-grupo" key={nodo.id}>
              <div className="sidebar-editor-grupo-cab">
                <input value={nodo.titulo} onChange={(e) => renombrarGrupo(nodo.id, e.target.value)} />
                <div className="sidebar-editor-flechas">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moverTopLevel(index, -1)}
                    aria-label="Subir grupo"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === layout.length - 1}
                    onClick={() => moverTopLevel(index, 1)}
                    aria-label="Bajar grupo"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-icon peligro"
                  onClick={() => eliminarGrupo(nodo.id)}
                  aria-label="Eliminar grupo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {nodo.items.length === 0 ? (
                <div className="sidebar-editor-vacio">Sin secciones asignadas todavía.</div>
              ) : (
                nodo.items.map((clave, i) =>
                  filaSeccion(clave, i, nodo.items.length, (d) => moverEnGrupo(nodo.id, i, d))
                )
              )}
            </div>
          )
        )}

        <div className="sidebar-editor-nuevo-grupo">
          <input
            placeholder="Nombre del nuevo grupo"
            value={nuevoGrupo}
            onChange={(e) => setNuevoGrupo(e.target.value)}
          />
          <button type="button" className="btn secundario sm" onClick={agregarGrupo}>
            <Plus size={14} /> Nuevo grupo
          </button>
        </div>

        <div className="sidebar-editor-acciones">
          <button type="button" className="btn secundario" onClick={restablecer}>
            <RotateCcw size={15} /> Restablecer
          </button>
          <button type="button" className="btn primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
