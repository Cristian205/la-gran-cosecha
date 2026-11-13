import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Building2,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  Receipt,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
  MessageCircle,
  Paintbrush,
  Tag,
  Workflow,
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
  { titulo: "Dashboard", ruta: "/", icono: LayoutDashboard, palabras: ["dashboard", "inicio", "resumen", "ventas"] },
  { titulo: "Catálogo", ruta: "/productos", icono: Package, palabras: ["catálogo", "productos"] },
  { titulo: "Pedidos", ruta: "/pedidos", icono: Receipt, palabras: ["pedidos", "órdenes", "ventas"] },
  { titulo: "Clientes", ruta: "/clientes", icono: Users, palabras: ["clientes"] },
  { titulo: "Usuarios", ruta: "/usuarios", icono: ShieldCheck, palabras: ["usuarios", "equipo"] },
  {
    titulo: "Configuración",
    ruta: "/contenido",
    icono: Settings2,
    palabras: [
      "configuración",
      "contenido",
      "negocio",
      "módulos",
      "páginas",
      "secciones",
      "banners",
      "testimonios",
      "confianza",
    ],
  },
  { titulo: "Tu negocio", ruta: "/contenido?seccion=negocio/operacion", icono: Building2, palabras: ["negocio", "módulos", "capacidades"] },
  { titulo: "Páginas de la tienda", ruta: "/contenido?seccion=contenido/paginas", icono: LayoutTemplate, palabras: ["páginas", "secciones", "textos", "inicio", "nosotros", "contacto"] },
  { titulo: "Identidad del negocio", ruta: "/contenido?seccion=negocio/identidad", icono: Tag, palabras: ["logo", "nombre", "marca", "redes"] },
  { titulo: "Apariencia de la tienda", ruta: "/contenido?seccion=diseno/apariencia", icono: Paintbrush, palabras: ["colores", "fuente", "tipografía", "botones", "diseño"] },
  { titulo: "Automatizaciones", ruta: "/contenido?seccion=automatizaciones/reglas", icono: Workflow, palabras: ["reglas", "avisos", "automático", "plantillas", "ejecuciones"] },
  { titulo: "WhatsApp", ruta: "/contenido?seccion=integraciones/whatsapp", icono: MessageCircle, palabras: ["whatsapp", "meta", "twilio", "integración", "alertas"] },
  { titulo: "Perfil", ruta: "/perfil", icono: User, palabras: ["perfil", "cuenta"] },
  { titulo: "Preferencias", ruta: "/configuracion", icono: Settings, palabras: ["preferencias", "ajustes", "contraseña"] },
  { titulo: "Notificaciones", ruta: "/notificaciones", icono: Bell, palabras: ["notificaciones", "avisos"] },
  { titulo: "Centro de ayuda", ruta: "/ayuda", icono: HelpCircle, palabras: ["ayuda", "soporte", "faq"] },
];

interface ResultadoItem {
  clave: string;
  icono: LucideIcon;
  nombre: string;
  /** Segunda línea: a quién o a qué pertenece (cliente, categoría, teléfono). */
  detalle?: string;
  meta?: string;
  ir: () => void;
}

/** "ENTREGADO" → "Entregado". */
const estadoLegible = (e: string) => e.charAt(0) + e.slice(1).toLowerCase();

export function CommandPalette({ onCerrar }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [indice, setIndice] = useState(0);
  /** Cuántas de las tres búsquedas siguen en camino. */
  const [buscando, setBuscando] = useState(0);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setProductos([]);
      setPedidos([]);
      setClientes([]);
      return;
    }
    let vigente = true;
    const fin = () => vigente && setBuscando((n) => Math.max(0, n - 1));
    const id = setTimeout(() => {
      setBuscando(3);
      obtenerProductos({ search: texto })
        .then((r) => vigente && setProductos(r.slice(0, 5)))
        .catch(() => vigente && setProductos([]))
        .finally(fin);
      obtenerPedidos({ search: texto })
        .then((r) => vigente && setPedidos(r.slice(0, 5)))
        .catch(() => vigente && setPedidos([]))
        .finally(fin);
      obtenerClientes(texto)
        .then((r) => vigente && setClientes(r.slice(0, 5)))
        .catch(() => vigente && setClientes([]))
        .finally(fin);
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(id);
      setBuscando(0);
    };
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
    if (pedidos.length > 0) {
      g.push({
        titulo: "Pedidos",
        items: pedidos.map((p) => ({
          clave: `o-${p.id}`,
          icono: Receipt,
          nombre: `Pedido #${p.id}`,
          detalle: p.cliente_nombre || "Sin cliente",
          meta: estadoLegible(p.estado),
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
          detalle: c.telefono_cliente || undefined,
          ir: () => ir("/clientes", c.nombre_cliente),
        })),
      });
    }
    if (productos.length > 0) {
      g.push({
        titulo: "Productos",
        items: productos.map((p) => ({
          clave: `p-${p.id}`,
          icono: Package,
          nombre: p.nombre_producto,
          detalle: p.categoria_nombre || undefined,
          ir: () => ir("/productos", p.nombre_producto),
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

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(".cmdk-item.activo")?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const hayTexto = q.trim().length >= 2;
  let contador = -1;

  return (
    <div className="cmdk-overlay" onClick={onCerrar}>
      <div className="cmdk-panel" role="dialog" aria-label="Buscar en el panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            type="text"
            placeholder="Buscar pedidos, clientes o productos..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={alPresionarTecla}
            aria-label="Buscar pedidos, clientes o productos"
          />
          {buscando > 0 && <span className="cmdk-buscando" aria-label="Buscando" />}
          <kbd className="cmdk-atajo">Esc</kbd>
        </div>

        <div className="cmdk-lista" ref={lista}>
          {!hayTexto ? (
            <div className="cmdk-vacio">
              <strong>Busca en todo el panel</strong>
              Escribe al menos 2 caracteres: número de pedido, nombre o teléfono de un cliente, o un producto.
            </div>
          ) : planos.length === 0 ? (
            <div className="cmdk-vacio">
              {buscando > 0 ? "Buscando…" : <>Sin resultados para «{q.trim()}»</>}
            </div>
          ) : (
            grupos.map((g) => (
              <div className="cmdk-grupo" key={g.titulo} role="group" aria-label={g.titulo}>
                <span className="cmdk-grupo-titulo">
                  {g.titulo}
                  <span className="cmdk-grupo-n">{g.items.length}</span>
                </span>
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
                      <span className="cmdk-item-icono" aria-hidden="true">
                        <item.icono size={16} />
                      </span>
                      <span className="cmdk-item-texto">
                        <span className="cmdk-item-nombre">{item.nombre}</span>
                        {item.detalle && <span className="cmdk-item-detalle">{item.detalle}</span>}
                      </span>
                      {item.meta && <span className="cmdk-item-meta">{item.meta}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-pie" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
