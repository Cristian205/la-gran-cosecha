import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BellRing,
  BookOpen,
  CalendarDays,
  Clock,
  Flag,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "../../components/Modal";
import {
  obtenerAlertasCliente,
  obtenerHojaDeVidaCliente,
  type AlertaCliente,
  type HojaDeVidaCliente,
} from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";
import type { Cliente } from "../../types";
import { formatoPrecio } from "../../utils";

interface Props {
  cliente: Cliente;
  puedeEditar: boolean;
  onEditar: () => void;
  onCerrar: () => void;
}

type Pestana = "hoja" | "info" | "pedidos";

const ICONO_HITO: Record<string, LucideIcon> = {
  REGISTRO: UserRound,
  PRIMER_PEDIDO: Flag,
  DATOS: ShieldCheck,
  WHATSAPP: MessageCircle,
  MAYOR: Trophy,
  ULTIMO: Clock,
};

function fechaLarga(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function mesYAnio(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function haceDias(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

function listaNatural(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * El relato de la hoja de vida, armado SOLO con los datos: cada frase sale de
 * un número que el backend calculó. Si un dato no existe, su frase no aparece.
 */
function relato(nombre: string, negocio: string, h: HojaDeVidaCliente): string[] {
  const frases: string[] = [];
  // El nombre completo y no el primero: muchos clientes son negocios
  // («Frutería Doña Rosa»), y «Frutería es cliente…» no se lee como nadie.
  if (h.cliente_desde) frases.push(`${nombre.trim()} es cliente de ${negocio} desde ${mesYAnio(h.cliente_desde)}.`);
  if (h.total_pedidos === 0) {
    frases.push("Todavía no ha hecho ningún pedido.");
    return frases;
  }
  frases.push(
    h.total_pedidos === 1
      ? `Ha hecho un pedido, por ${formatoPrecio(h.valor_total)}.`
      : `Ha hecho ${h.total_pedidos} pedidos por ${formatoPrecio(h.valor_total)} en total, unos ${formatoPrecio(
          h.ticket_promedio ?? 0
        )} cada vez.`
  );
  if (h.frecuencia_dias !== null) {
    const cada = Math.round(h.frecuencia_dias);
    frases.push(cada <= 1 ? "Pide casi a diario." : `En promedio vuelve a pedir cada ${cada} días.`);
  }
  if (h.dia_favorito) frases.push(`Suele pedir los ${h.dia_favorito.dia}.`);
  const favoritos = h.productos_favoritos.slice(0, 3).map((p) => p.nombre);
  if (favoritos.length) frases.push(`Lo que más pide: ${listaNatural(favoritos)}.`);
  if (h.lineas_fuera_de_catalogo > 0)
    frases.push(
      `Ha pedido ${h.lineas_fuera_de_catalogo} ${
        h.lineas_fuera_de_catalogo === 1 ? "producto" : "productos"
      } fuera del catálogo.`
    );
  if (h.dias_desde_ultimo !== null) frases.push(`Su último pedido fue ${haceDias(h.dias_desde_ultimo)}.`);
  return frases;
}

function Cifra({ icono: Icono, etiqueta, valor, nota }: { icono: LucideIcon; etiqueta: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="ficha-cifra">
      <span className="ficha-cifra-icono" aria-hidden="true">
        <Icono size={16} />
      </span>
      <div>
        <div className="ficha-cifra-etiqueta">{etiqueta}</div>
        <div className="ficha-cifra-valor">{valor}</div>
        {nota && <div className="ficha-cifra-nota">{nota}</div>}
      </div>
    </div>
  );
}

function Dato({ icono: Icono, etiqueta, children }: { icono: LucideIcon; etiqueta: string; children: ReactNode }) {
  return (
    <div className="ficha-dato">
      <Icono size={16} aria-hidden="true" />
      <div>
        <dt>{etiqueta}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

/**
 * La ficha de un cliente, de solo lectura: su hoja de vida (la historia con
 * el negocio, de un vistazo), sus datos y sus pedidos recientes. Para cambiar
 * algo, «Editar cliente» abre el editor de siempre.
 */
export function ClientViewModal({ cliente, puedeEditar, onEditar, onCerrar }: Props) {
  const id = useId();
  const { marca, negocioActivo } = useAuth();
  const negocio = marca?.nombreEmpresa || negocioActivo?.nombre || "el negocio";
  const [pestana, setPestana] = useState<Pestana>("hoja");
  const [hoja, setHoja] = useState<HojaDeVidaCliente | null>(null);
  const [catalogo, setCatalogo] = useState<AlertaCliente[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerHojaDeVidaCliente(cliente.id)
      .then(setHoja)
      .catch(() => setError("No se pudo cargar la hoja de vida de este cliente."));
    obtenerAlertasCliente()
      .then(setCatalogo)
      .catch(() => setCatalogo([]));
  }, [cliente.id]);

  const refPestanas = useRef<(HTMLButtonElement | null)[]>([]);
  const pestanas: { clave: Pestana; etiqueta: string; icono: LucideIcon }[] = [
    { clave: "hoja", etiqueta: "Hoja de vida", icono: BookOpen },
    { clave: "info", etiqueta: "Información", icono: UserRound },
    { clave: "pedidos", etiqueta: "Pedidos", icono: Receipt },
  ];
  function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = pestanas.findIndex((p) => p.clave === pestana);
    const siguiente = (i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
    setPestana(pestanas[siguiente].clave);
    refPestanas.current[siguiente]?.focus();
  }

  const alertasActivas = catalogo.filter((a) => cliente.alertas?.[a.codigo]);
  const maxVeces = Math.max(1, ...(hoja?.productos_favoritos.map((p) => p.veces) ?? [1]));

  return (
    <Modal
      amplio
      ancho
      titulo={cliente.nombre_cliente}
      subtitulo="Ficha del cliente"
      onCerrar={onCerrar}
      cerrarConEscape
      footer={
        <>
          <button type="button" className="btn secundario" onClick={onCerrar}>
            Cerrar
          </button>
          {puedeEditar && (
            <button type="button" className="btn primario btn-con-icono" onClick={onEditar}>
              <Pencil size={15} aria-hidden="true" /> Editar cliente
            </button>
          )}
        </>
      }
    >
      <div className="ficha-cliente">
        <div className="gestion-tabs ficha-tabs" role="tablist" aria-label="Secciones de la ficha" onKeyDown={alTeclado}>
          {pestanas.map((p, i) => {
            const Icono = p.icono;
            const activa = pestana === p.clave;
            return (
              <button
                key={p.clave}
                ref={(el) => {
                  refPestanas.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${p.clave}`}
                aria-selected={activa}
                aria-controls={`${id}-panel-${p.clave}`}
                tabIndex={activa ? 0 : -1}
                className={activa ? "activo" : ""}
                onClick={() => setPestana(p.clave)}
              >
                <Icono size={15} aria-hidden="true" /> {p.etiqueta}
              </button>
            );
          })}
        </div>

        {error && <div className="error-box">{error}</div>}

        {/* ------------------------------------------------ hoja de vida */}
        <div role="tabpanel" id={`${id}-panel-hoja`} aria-labelledby={`${id}-tab-hoja`} hidden={pestana !== "hoja"}>
          {!hoja && !error ? (
            <div className="vacio">Cargando…</div>
          ) : hoja ? (
            <>
              <div className="ficha-portada">
                <span className="ficha-avatar" aria-hidden="true">
                  {iniciales(cliente.nombre_cliente)}
                </span>
                <div className="ficha-portada-texto">
                  <span className={`ficha-relacion ${hoja.relacion.codigo}`} title={hoja.relacion.regla}>
                    {hoja.relacion.etiqueta}
                  </span>
                  <p className="ficha-relato">{relato(cliente.nombre_cliente, negocio, hoja).join(" ")}</p>
                  <p className="ficha-regla">
                    <strong>¿Por qué «{hoja.relacion.etiqueta.toLowerCase()}»?</strong> {hoja.relacion.regla}
                  </p>
                </div>
              </div>

              <div className="ficha-cifras">
                <Cifra icono={ShoppingBag} etiqueta="Pedidos" valor={hoja.total_pedidos} />
                <Cifra icono={Receipt} etiqueta="Valor total" valor={formatoPrecio(hoja.valor_total)} />
                <Cifra
                  icono={Star}
                  etiqueta="Ticket promedio"
                  valor={hoja.ticket_promedio ? formatoPrecio(hoja.ticket_promedio) : "—"}
                />
                <Cifra
                  icono={Repeat}
                  etiqueta="Frecuencia"
                  valor={hoja.frecuencia_dias !== null ? `cada ${Math.round(hoja.frecuencia_dias)} días` : "—"}
                  nota={hoja.frecuencia_dias === null && hoja.total_pedidos > 0 ? "Con un solo pedido aún no se sabe" : undefined}
                />
                <Cifra
                  icono={Clock}
                  etiqueta="Último pedido"
                  valor={hoja.dias_desde_ultimo !== null ? haceDias(hoja.dias_desde_ultimo) : "—"}
                />
              </div>

              <div className="ficha-columnas">
                <section className="ficha-bloque" aria-labelledby={`${id}-favoritos`}>
                  <h3 id={`${id}-favoritos`}>
                    <Package size={15} aria-hidden="true" /> Lo que más pide
                  </h3>
                  {hoja.productos_favoritos.length === 0 ? (
                    <p className="ficha-vacio">Sin pedidos todavía.</p>
                  ) : (
                    <ol className="ficha-favoritos">
                      {hoja.productos_favoritos.map((p) => (
                        <li key={p.nombre}>
                          <span className="ficha-favorito-nombre">{p.nombre}</span>
                          <span className="ficha-barra" aria-hidden="true">
                            <span style={{ width: `${(p.veces / maxVeces) * 100}%` }} />
                          </span>
                          <span className="ficha-favorito-veces">
                            {p.veces} {p.veces === 1 ? "vez" : "veces"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {hoja.productos_distintos > hoja.productos_favoritos.length && (
                    <p className="ficha-vacio">{hoja.productos_distintos} productos distintos en total.</p>
                  )}
                </section>

                <section className="ficha-bloque" aria-labelledby={`${id}-historia`}>
                  <h3 id={`${id}-historia`}>
                    <CalendarDays size={15} aria-hidden="true" /> Su historia
                  </h3>
                  <ol className="ficha-linea">
                    {hoja.hitos.map((h, i) => {
                      const Icono = ICONO_HITO[h.tipo] ?? Flag;
                      return (
                        <li key={`${h.tipo}-${i}`}>
                          <span className="ficha-linea-punto" aria-hidden="true">
                            <Icono size={13} />
                          </span>
                          <div>
                            <div className="ficha-linea-texto">
                              {h.texto}
                              {h.valor && ` · ${formatoPrecio(h.valor)}`}
                            </div>
                            <time className="ficha-linea-fecha" dateTime={h.fecha}>
                              {fechaLarga(h.fecha)}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </div>
            </>
          ) : null}
        </div>

        {/* --------------------------------------------------- información */}
        <div role="tabpanel" id={`${id}-panel-info`} aria-labelledby={`${id}-tab-info`} hidden={pestana !== "info"}>
          <dl className="ficha-datos">
            <Dato icono={UserRound} etiqueta="Nombre">
              {cliente.nombre_cliente}
            </Dato>
            <Dato icono={ShieldCheck} etiqueta="Cédula">
              {cliente.documento_cliente || "—"}
            </Dato>
            <Dato icono={Phone} etiqueta="Teléfono">
              {cliente.telefono_cliente || "—"}
            </Dato>
            <Dato icono={MapPin} etiqueta="Dirección">
              {cliente.direccion_cliente || "—"}
            </Dato>
            <Dato icono={MessageCircle} etiqueta="WhatsApp">
              {cliente.acepta_whatsapp
                ? "Acepta recibir mensajes"
                : cliente.whatsapp_decidido_en
                  ? "No acepta mensajes"
                  : "Aún no se le ha preguntado"}
            </Dato>
            <Dato icono={ShieldCheck} etiqueta="Tratamiento de datos">
              {cliente.autorizo_datos_en ? `Autorizado el ${fechaLarga(cliente.autorizo_datos_en)}` : "Sin autorizar todavía"}
            </Dato>
          </dl>
          <section className="ficha-bloque" aria-labelledby={`${id}-alertas`}>
            <h3 id={`${id}-alertas`}>
              <BellRing size={15} aria-hidden="true" /> Alertas activas ({alertasActivas.length})
            </h3>
            {alertasActivas.length === 0 ? (
              <p className="ficha-vacio">No tiene alertas activas.</p>
            ) : (
              <ul className="ficha-chips">
                {alertasActivas.map((a) => (
                  <li key={a.codigo} className={a.tipo === "MARKETING" ? "marketing" : ""}>
                    {a.nombre}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------ pedidos */}
        <div role="tabpanel" id={`${id}-panel-pedidos`} aria-labelledby={`${id}-tab-pedidos`} hidden={pestana !== "pedidos"}>
          {!hoja ? (
            !error && <div className="vacio">Cargando…</div>
          ) : hoja.pedidos_recientes.length === 0 ? (
            <div className="vacio">Este cliente todavía no tiene pedidos.</div>
          ) : (
            <>
              <p className="ficha-vacio">
                {hoja.total_pedidos > hoja.pedidos_recientes.length
                  ? `Los ${hoja.pedidos_recientes.length} más recientes de ${hoja.total_pedidos}.`
                  : `${hoja.total_pedidos} ${hoja.total_pedidos === 1 ? "pedido" : "pedidos"}.`}
              </p>
              <ul className="ficha-pedidos">
                {hoja.pedidos_recientes.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>Pedido #{p.id}</strong>
                      <span>
                        {fechaLarga(p.fecha)} · {p.productos} {p.productos === 1 ? "producto" : "productos"}
                      </span>
                    </div>
                    <span className={`badge ${p.estado}`}>{p.estado_etiqueta}</span>
                    <strong className="ficha-pedido-total">{formatoPrecio(p.total)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
