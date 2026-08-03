import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { obtenerClientes, obtenerPedidos, obtenerProductos } from "../api/resources";
import type { Cliente, Pedido, Producto } from "../types";
import { normalizarTexto } from "../utils";

interface Props {
  onCerrar: () => void;
}

interface PaginaBuscable {
  titulo: string;
  ruta: string;
  icono: LucideIcon;
  palabras: string[];
}

const PAGINAS: PaginaBuscable[] = [
  { titulo: "Dashboard", ruta: "/", icono: LayoutDashboard, palabras: ["dashboard", "inicio", "resumen"] },
  { titulo: "Catálogo", ruta: "/productos", icono: Package, palabras: ["catálogo", "productos"] },
  { titulo: "Pedidos", ruta: "/pedidos", icono: Receipt, palabras: ["pedidos", "órdenes", "ventas"] },
  { titulo: "Clientes", ruta: "/clientes", icono: Users, palabras: ["clientes"] },
  { titulo: "Usuarios", ruta: "/usuarios", icono: ShieldCheck, palabras: ["usuarios", "equipo"] },
  {
    titulo: "Contenido",
    ruta: "/contenido",
    icono: ImageIcon,
    palabras: ["contenido", "banners", "testimonios", "confianza"],
  },
  { titulo: "Perfil", ruta: "/perfil", icono: User, palabras: ["perfil", "cuenta"] },
  { titulo: "Configuración", ruta: "/configuracion", icono: Settings, palabras: ["configuración", "ajustes"] },
  { titulo: "Notificaciones", ruta: "/notificaciones", icono: Bell, palabras: ["notificaciones", "avisos"] },
  { titulo: "Centro de ayuda", ruta: "/ayuda", icono: HelpCircle, palabras: ["ayuda", "soporte", "faq"] },
];

interface ResultadoItem {
  clave: string;
  icono: LucideIcon;
  nombre: string;
  meta?: string;
  ir: () => void;
}

export function CommandPalette({ onCerrar }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setProductos([]);
      setPedidos([]);
      setClientes([]);
      return;
    }
    const id = setTimeout(() => {
      obtenerProductos({ search: texto })
        .then((r) => setProductos(r.slice(0, 5)))
        .catch(() => setProductos([]));
      obtenerPedidos({ search: texto })
        .then((r) => setPedidos(r.slice(0, 5)))
        .catch(() => setPedidos([]));
      obtenerClientes(texto)
        .then((r) => setClientes(r.slice(0, 5)))
        .catch(() => setClientes([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setIndice(0);
  }, [q]);

  const qn = normalizarTexto(q.trim());
  const paginasCoincidentes = useMemo(
    () =>
      qn.length < 2
        ? []
        : PAGINAS.filter(
            (p) =>
              normalizarTexto(p.titulo).includes(qn) ||
              p.palabras.some((palabra) => normalizarTexto(palabra).includes(qn))
          ).slice(0, 5),
    [qn]
  );

  function ir(ruta: string, prefill?: string) {
    onCerrar();
    navigate(prefill ? `${ruta}?q=${encodeURIComponent(prefill)}` : ruta);
  }

  const grupos = useMemo(() => {
    const g: { titulo: string; items: ResultadoItem[] }[] = [];
    if (productos.length > 0) {
      g.push({
        titulo: "Productos",
        items: productos.map((p) => ({
          clave: `p-${p.id}`,
          icono: Package,
          nombre: p.nombre_producto,
          meta: p.categoria_nombre,
          ir: () => ir("/productos", p.nombre_producto),
        })),
      });
    }
    if (pedidos.length > 0) {
      g.push({
        titulo: "Pedidos",
        items: pedidos.map((p) => ({
          clave: `o-${p.id}`,
          icono: Receipt,
          nombre: `Pedido #${p.id} · ${p.cliente_nombre || "—"}`,
          meta: p.estado,
          ir: () => ir("/pedidos", String(p.id)),
        })),
      });
    }
    if (clientes.length > 0) {
      g.push({
        titulo: "Clientes",
        items: clientes.map((c) => ({
          clave: `c-${c.id}`,
          icono: Users,
          nombre: c.nombre_cliente,
          meta: c.telefono_cliente || undefined,
          ir: () => ir("/clientes", c.nombre_cliente),
        })),
      });
    }
    if (paginasCoincidentes.length > 0) {
      g.push({
        titulo: "Páginas",
        items: paginasCoincidentes.map((p) => ({
          clave: `pg-${p.ruta}`,
          icono: p.icono,
          nombre: p.titulo,
          ir: () => ir(p.ruta),
        })),
      });
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, pedidos, clientes, paginasCoincidentes]);

  const planos = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);

  function alPresionarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onCerrar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, planos.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      planos[indice]?.ir();
    }
  }

  const hayTexto = q.trim().length >= 2;
  let contador = -1;

  return (
    <div className="cmdk-overlay" onClick={onCerrar}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={17} />
          <input
            autoFocus
            type="text"
            placeholder="Buscar productos, pedidos, clientes, páginas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={alPresionarTecla}
          />
          <span className="cmdk-atajo">Esc</span>
        </div>

        {hayTexto && (
          <div className="cmdk-lista">
            {planos.length === 0 ? (
              <div className="cmdk-vacio">Sin resultados para "{q.trim()}"</div>
            ) : (
              grupos.map((g) => (
                <div className="cmdk-grupo" key={g.titulo}>
                  <span className="cmdk-grupo-titulo">{g.titulo}</span>
                  {g.items.map((item) => {
                    contador += 1;
                    const posicion = contador;
                    return (
                      <button
                        type="button"
                        key={item.clave}
                        className={`cmdk-item ${posicion === indice ? "activo" : ""}`}
                        onMouseEnter={() => setIndice(posicion)}
                        onClick={item.ir}
                      >
                        <item.icono size={16} />
                        <span className="cmdk-item-nombre">{item.nombre}</span>
                        {item.meta && <span className="cmdk-item-meta">{item.meta}</span>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
