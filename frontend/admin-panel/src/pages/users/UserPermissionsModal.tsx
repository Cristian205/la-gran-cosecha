import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { Modal } from "../../components/Modal";
import {
  actualizarPermisosUsuario,
  obtenerPermisosDisponibles,
  obtenerPermisosUsuario,
} from "../../api/resources";
import type { ModuloPermisos, PermisoItem, Usuario } from "../../types";
import { extraerMensajeError } from "../../utils";

interface Props {
  usuario: Usuario;
  onCerrar: () => void;
  onGuardado: () => void;
}

// El catálogo del backend no distingue "vista" de "acción" como campo aparte:
// se infiere del verbo de Django en el codename (view_/add_/change_/delete_),
// que es la misma convención que ya usa todo el resto del sistema de permisos.
function esPermisoDeVista(codename: string): boolean {
  return /\.view_/.test(codename);
}

const ICONOS_ACCION: Record<string, LucideIcon> = { add: Plus, change: Pencil, delete: Trash2 };

function iconoAccion(codename: string): LucideIcon {
  const verbo = codename.match(/\.(add|change|delete)_/)?.[1];
  return (verbo && ICONOS_ACCION[verbo]) || Pencil;
}

function GrupoPermisos({
  titulo,
  icono: Icono,
  permisos,
  seleccionados,
  onAlternar,
  iconoPorItem,
}: {
  titulo: string;
  icono: LucideIcon;
  permisos: PermisoItem[];
  seleccionados: Set<string>;
  onAlternar: (codename: string) => void;
  iconoPorItem?: (codename: string) => LucideIcon;
}) {
  if (permisos.length === 0) return null;
  return (
    <div className="permisos-subgrupo">
      <span className="permisos-subgrupo-titulo">
        <Icono size={13} /> {titulo}
      </span>
      <div className="permisos-grid">
        {permisos.map((p) => {
          const IconoItem = iconoPorItem?.(p.codename);
          return (
            <label className="permiso-chip" key={p.codename}>
              <input
                type="checkbox"
                checked={seleccionados.has(p.codename)}
                onChange={() => onAlternar(p.codename)}
              />
              {IconoItem && <IconoItem size={13} />}
              {p.etiqueta}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function UserPermissionsModal({ usuario, onCerrar, onGuardado }: Props) {
  const [catalogo, setCatalogo] = useState<ModuloPermisos[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([obtenerPermisosDisponibles(), obtenerPermisosUsuario(usuario.id)])
      .then(([cat, permisos]) => {
        setCatalogo(cat);
        setSeleccionados(new Set(permisos));
      })
      .catch(() => setError("No se pudieron cargar los permisos."))
      .finally(() => setCargando(false));
  }, [usuario.id]);

  function alternar(codename: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(codename)) next.delete(codename);
      else next.add(codename);
      return next;
    });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await actualizarPermisosUsuario(usuario.id, [...seleccionados]);
      onGuardado();
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudieron guardar los permisos."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      lateral
      titulo={`Permisos de ${usuario.nombre_usuario}`}
      onCerrar={onCerrar}
      footer={
        <>
          <button className="btn secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={guardar} disabled={guardando || cargando}>
            {guardando ? "Guardando…" : "Guardar permisos"}
          </button>
        </>
      }
    >
      {error && <div className="error-box">{error}</div>}

      <div className="ok-box" style={{ display: "flex", gap: ".6rem", alignItems: "flex-start" }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>
          Por cada módulo, elige qué puede <strong>ver</strong> y qué puede{" "}
          <strong>hacer</strong> <strong>{usuario.nombre_usuario}</strong>. Todo lo demás
          quedará bloqueado, incluso si es un usuario ADMIN o ANALISTA.
        </span>
      </div>

      {cargando ? (
        <div className="vacio">Cargando…</div>
      ) : (
        <div className="permisos-lista">
          {catalogo.map((m) => {
            const vistas = m.permisos.filter((p) => esPermisoDeVista(p.codename));
            const acciones = m.permisos.filter((p) => !esPermisoDeVista(p.codename));
            return (
              <div className="permisos-modulo" key={m.modulo}>
                <h3>{m.modulo}</h3>
                <GrupoPermisos
                  titulo="Puede ver"
                  icono={Eye}
                  permisos={vistas}
                  seleccionados={seleccionados}
                  onAlternar={alternar}
                />
                <GrupoPermisos
                  titulo="Puede hacer"
                  icono={Pencil}
                  permisos={acciones}
                  seleccionados={seleccionados}
                  onAlternar={alternar}
                  iconoPorItem={iconoAccion}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
