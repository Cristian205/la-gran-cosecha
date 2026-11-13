import {
  Boxes,
  CalendarDays,
  ClipboardList,
  Eye,
  EyeOff,
  LayoutTemplate,
  Lock,
  Package,
  Search,
  ShieldCheck,
  Store,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ModuloPermisos, PermisoItem } from "../../types";

/**
 * Consola de permisos POR VISTAS: una fila por pantalla del panel (Pedidos,
 * Catálogo, Clientes…) con su interruptor de acceso y, al lado, lo que se
 * puede HACER dentro de ella.
 *
 * El catálogo sale del backend (`accounts/permisos.py`): cada módulo es una
 * vista, su permiso `*.view_*` es el acceso y el resto son acciones. Una regla
 * de coherencia, solo de interfaz: sin ver la pantalla no se puede actuar en
 * ella, así que conceder una acción concede también el acceso, y quitar el
 * acceso quita sus acciones. Los módulos sin permiso de vista (Punto de
 * venta) solo tienen acciones.
 *
 * No guarda nada: recibe el conjunto marcado y avisa los cambios. El modal de
 * usuario decide cuándo enviarlos.
 */
const ICONOS_VISTA: Record<string, LucideIcon> = {
  "Catálogo": Package,
  Pedidos: ClipboardList,
  Inventario: Boxes,
  "Punto de venta": Store,
  Reservas: CalendarDays,
  Domicilios: Truck,
  Clientes: Users,
  Usuarios: UserCog,
  Contenido: LayoutTemplate,
};

const esVista = (p: PermisoItem) => /\.view_/.test(p.codename);

type Plantilla = "ninguno" | "consulta" | "completo";

export function ConsolaPermisos({
  catalogo,
  seleccionados,
  onCambiar,
  nombre,
}: {
  catalogo: ModuloPermisos[];
  seleccionados: Set<string>;
  onCambiar: (siguiente: Set<string>) => void;
  /** Para el texto de ayuda ("Lo que podrá hacer Ana"). */
  nombre?: string;
}) {
  const [filtro, setFiltro] = useState("");

  const vistas = useMemo(
    () =>
      catalogo.map((m) => ({
        modulo: m.modulo,
        icono: ICONOS_VISTA[m.modulo] ?? ShieldCheck,
        acceso: m.permisos.find(esVista) ?? null,
        acciones: m.permisos.filter((p) => !esVista(p)),
        todos: m.permisos,
      })),
    [catalogo]
  );

  const visibles = vistas.filter((v) => v.modulo.toLowerCase().includes(filtro.trim().toLowerCase()));
  const conAcceso = vistas.filter((v) => (v.acceso ? seleccionados.has(v.acceso.codename) : v.acciones.some((a) => seleccionados.has(a.codename)))).length;
  const total = vistas.reduce((n, v) => n + v.todos.length, 0);

  function cambiar(mutar: (s: Set<string>) => void) {
    const siguiente = new Set(seleccionados);
    mutar(siguiente);
    onCambiar(siguiente);
  }

  function alternarAcceso(v: (typeof vistas)[number]) {
    if (!v.acceso) return;
    const cod = v.acceso.codename;
    cambiar((s) => {
      if (s.has(cod)) {
        // Sin ver la pantalla no se puede actuar en ella.
        s.delete(cod);
        v.acciones.forEach((a) => s.delete(a.codename));
      } else s.add(cod);
    });
  }

  function alternarAccion(v: (typeof vistas)[number], cod: string) {
    cambiar((s) => {
      if (s.has(cod)) s.delete(cod);
      else {
        s.add(cod);
        if (v.acceso) s.add(v.acceso.codename);
      }
    });
  }

  function vistaCompleta(v: (typeof vistas)[number], marcar: boolean) {
    cambiar((s) => v.todos.forEach((p) => (marcar ? s.add(p.codename) : s.delete(p.codename))));
  }

  function aplicarPlantilla(p: Plantilla) {
    cambiar((s) => {
      for (const v of vistas) {
        for (const permiso of v.todos) s.delete(permiso.codename);
        if (p === "completo") v.todos.forEach((permiso) => s.add(permiso.codename));
        if (p === "consulta" && v.acceso) s.add(v.acceso.codename);
      }
    });
  }

  return (
    <div className="consola">
      <div className="consola-barra">
        <div className="consola-resumen" aria-live="polite">
          <strong>{conAcceso}</strong> de {vistas.length} vistas habilitadas
          <span className="consola-resumen-sec">
            · {seleccionados.size} de {total} permisos
          </span>
        </div>
        <div className="consola-plantillas" role="group" aria-label="Plantillas rápidas">
          <button type="button" onClick={() => aplicarPlantilla("ninguno")}>
            <Lock size={14} aria-hidden="true" /> Sin acceso
          </button>
          <button type="button" onClick={() => aplicarPlantilla("consulta")}>
            <Eye size={14} aria-hidden="true" /> Solo consulta
          </button>
          <button type="button" onClick={() => aplicarPlantilla("completo")}>
            <ShieldCheck size={14} aria-hidden="true" /> Acceso completo
          </button>
        </div>
      </div>

      {vistas.length > 5 && (
        <label className="consola-buscar">
          <Search size={15} aria-hidden="true" />
          <span className="consola-sr">Buscar vista</span>
          <input type="search" placeholder="Buscar vista…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </label>
      )}

      <p className="consola-ayuda">
        Activa las pantallas que {nombre?.trim() ? <strong>{nombre.trim()}</strong> : "este usuario"} podrá abrir y, en
        cada una, lo que podrá hacer. Lo que no actives queda bloqueado. Conceder una acción habilita también la vista.
      </p>

      <ul className="consola-lista">
        {visibles.map((v) => {
          const Icono = v.icono;
          const tieneAcceso = v.acceso ? seleccionados.has(v.acceso.codename) : v.acciones.some((a) => seleccionados.has(a.codename));
          const marcadas = v.todos.filter((p) => seleccionados.has(p.codename)).length;
          const completa = marcadas === v.todos.length;
          return (
            <li key={v.modulo} className={`consola-vista ${tieneAcceso ? "con-acceso" : ""}`}>
              <div className="consola-vista-cab">
                <span className="consola-vista-icono" aria-hidden="true">
                  <Icono size={17} />
                </span>
                <div className="consola-vista-titulo">
                  <strong>{v.modulo}</strong>
                  <small>
                    {v.acceso ? v.acceso.etiqueta : "Sin pantalla de consulta: solo acciones"}
                  </small>
                </div>
                <span className={`consola-estado ${tieneAcceso ? "si" : ""}`}>
                  {tieneAcceso ? (completa ? "Completo" : `${marcadas}/${v.todos.length}`) : "Bloqueada"}
                </span>
                {v.acceso && (
                  <label className="switch consola-switch" title={tieneAcceso ? "Quitar acceso" : "Dar acceso"}>
                    <input
                      type="checkbox"
                      checked={tieneAcceso}
                      onChange={() => alternarAcceso(v)}
                      aria-label={`Acceso a ${v.modulo}`}
                    />
                    <span className="switch-riel" />
                  </label>
                )}
              </div>

              {v.acciones.length > 0 && (
                <div className="consola-acciones" role="group" aria-label={`Acciones en ${v.modulo}`}>
                  {v.acciones.map((a) => {
                    const activa = seleccionados.has(a.codename);
                    return (
                      <button
                        key={a.codename}
                        type="button"
                        role="switch"
                        aria-checked={activa}
                        className={`consola-accion ${activa ? "activa" : ""}`}
                        onClick={() => alternarAccion(v, a.codename)}
                      >
                        <span className="consola-accion-check" aria-hidden="true" />
                        {a.etiqueta}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="consola-todo"
                    onClick={() => vistaCompleta(v, !completa)}
                    aria-label={`${completa ? "Quitar" : "Conceder"} todo en ${v.modulo}`}
                  >
                    {completa ? (
                      <>
                        <EyeOff size={13} aria-hidden="true" /> Quitar todo
                      </>
                    ) : (
                      "Conceder todo"
                    )}
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {visibles.length === 0 && <li className="consola-vacio">Ninguna vista coincide con «{filtro.trim()}».</li>}
      </ul>
    </div>
  );
}
