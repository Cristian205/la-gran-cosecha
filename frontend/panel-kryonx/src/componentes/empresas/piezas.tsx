/**
 * Las piezas de una empresa, las mismas en la tabla y en las tarjetas.
 *
 * Ninguna lleva colores ni la marca de Kryon X escritos: todo sale de los
 * tokens (`--brand-*`, `--success`, `--danger`…), así que con otra marca se
 * ven con su color sin tocar una línea.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  IdCard,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  OctagonAlert,
  PlayCircle,
  Receipt,
  Users,
} from "lucide-react";
import type { EstadoNegocio, Negocio } from "../../api/tipos";
import { razonDe, nivelDe, type Indicador, type Salud } from "../../datos/derivados";
import { relativo } from "../../datos/formato";
import { Menu, OpcionMenu, SeparadorMenu } from "../../ui/Menu";

// ---------------------------------------------------------------- avatar

/**
 * El logo de la tienda de la empresa; sin logo (o si no carga), su inicial.
 * Es la misma pieza en la tabla, las tarjetas, la ficha y el selector de
 * workspaces: cuando una tienda sube su logo, aparece en todas a la vez.
 */
export function AvatarEmpresa({
  negocio,
  tamano = "m",
  className = "",
}: {
  negocio: Pick<Negocio, "nombre" | "logo_url">;
  tamano?: "s" | "m" | "l" | "xl";
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  const conLogo = Boolean(negocio.logo_url) && !fallo;
  return (
    <span
      className={`emp-avatar emp-avatar--${tamano} ${conLogo ? "emp-avatar--logo" : ""} ${className}`}
      aria-hidden="true"
    >
      {conLogo ? (
        <img src={negocio.logo_url!} alt="" loading="lazy" onError={() => setFallo(true)} />
      ) : (
        negocio.nombre.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

// ------------------------------------------------------------- identidad

/** Logo (inicial) + nombre + identificador y alta. El nombre manda; lo demás es contexto. */
export function IdentidadEmpresa({
  negocio,
  grande = false,
  enlace = true,
}: {
  negocio: Negocio;
  grande?: boolean;
  enlace?: boolean;
}) {
  const contenido = (
    <>
      <AvatarEmpresa negocio={negocio} tamano={grande ? "l" : "m"} />
      <span className="emp-identidad__textos">
        <span className="emp-identidad__nombre">{negocio.nombre}</span>
        <span className="emp-identidad__meta">
          <code>{negocio.slug}</code>
          {!grande && (
            <span title={`Alta: ${negocio.fecha_creacion.slice(0, 10)}`}>
              · alta {relativo(negocio.fecha_creacion)}
            </span>
          )}
        </span>
      </span>
    </>
  );
  const clase = `emp-identidad ${grande ? "emp-identidad--grande" : ""}`;
  return enlace ? (
    <Link to={`/empresas/${negocio.id}`} className={clase} onClick={(e) => e.stopPropagation()}>
      {contenido}
    </Link>
  ) : (
    <span className={clase}>{contenido}</span>
  );
}

// ----------------------------------------------------------------- salud

const SALUD: Record<Salud, { etiqueta: string; icono: typeof CheckCircle2 }> = {
  ok: { etiqueta: "Saludable", icono: CheckCircle2 },
  aviso: { etiqueta: "Advertencia", icono: AlertTriangle },
  malo: { etiqueta: "Crítica", icono: OctagonAlert },
};

/**
 * La salud de una empresa: la de su peor alerta. Icono + texto (nunca solo el
 * color) y, si hay problema, el motivo en una línea debajo. El rojo marca el
 * indicador; la fila o la tarjeta no se pintan.
 */
export function SaludEmpresa({ salud, motivo }: { salud: Salud; motivo?: string | null }) {
  const { etiqueta, icono: Icono } = SALUD[salud];
  return (
    <span className={`emp-salud emp-salud--${salud}`}>
      <span className="emp-salud__estado">
        <Icono size={13} aria-hidden="true" />
        {etiqueta}
      </span>
      {salud !== "ok" && motivo && <span className="emp-salud__motivo">{motivo}</span>}
    </span>
  );
}

// ------------------------------------------------------------------- uso

/**
 * El consumo que más aprieta, como barra + porcentaje. Al 100% lo dice con
 * palabras ("Límite de dominios"), no solo con el color de la barra.
 */
export function UsoEmpresa({ indicador, ancho = false }: { indicador: Indicador; ancho?: boolean }) {
  const razon = razonDe(indicador);
  if (razon === null) return <span className="emp-uso emp-uso--sin">sin medición</span>;
  const pct = Math.round(razon * 100);
  const enLimite = razon >= 1;
  return (
    <span
      className={`emp-uso ${ancho ? "emp-uso--ancho" : ""}`}
      title={`${indicador.etiqueta}: ${indicador.usado} de ${indicador.limite}`}
    >
      <span className="emp-uso__fila">
        <span
          className={`emp-uso__barra emp-uso__barra--${nivelDe(indicador)}`}
          role="progressbar"
          aria-label={`Uso de ${indicador.etiqueta.toLowerCase()}`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="emp-uso__cifra">{pct}%</span>
      </span>
      {enLimite && (
        <span className="emp-uso__limite">Límite de {indicador.etiqueta.toLowerCase()}</span>
      )}
    </span>
  );
}

// --------------------------------------------------------------- módulos

export function ModulosEmpresa({ modulos }: { modulos: number }) {
  if (modulos === 0) return <span className="tenue">—</span>;
  return (
    <span className="emp-cifra" title={`${modulos} módulos con permisos concedidos`}>
      <Layers size={13} aria-hidden="true" /> {modulos}
    </span>
  );
}

export function UsuariosEmpresa({ usados, limite }: { usados: number; limite: number | null }) {
  return (
    <span className="emp-cifra">
      <strong>{usados}</strong>
      {limite !== null && <span className="tenue"> / {limite}</span>}
    </span>
  );
}

// ------------------------------------------------------- acción principal

/** "Abrir workspace →": entra al entorno de la empresa (su ficha). */
export function BotonWorkspace({ negocio }: { negocio: Negocio }) {
  return (
    <Link
      to={`/empresas/${negocio.id}`}
      className="emp-workspace"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Abrir el workspace de ${negocio.nombre}`}
    >
      Abrir workspace <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

// ---------------------------------------------------- acciones secundarias

export interface ManejadoresAcciones {
  onCambiarPlan: (negocio: Negocio) => void;
  onAplicarPlantilla?: (negocio: Negocio) => void;
  onCambiarEstado: (negocio: Negocio, estado: EstadoNegocio) => void;
}

/** El "•••": las mismas acciones en la fila y en la tarjeta. */
export function AccionesEmpresa({
  negocio,
  onCambiarPlan,
  onAplicarPlantilla,
  onCambiarEstado,
}: { negocio: Negocio } & ManejadoresAcciones) {
  const navegar = useNavigate();
  const base = `/empresas/${negocio.id}`;
  const ir = (cerrar: () => void, ruta: string) => {
    cerrar();
    navegar(ruta);
  };
  return (
    <Menu etiqueta={`Acciones de ${negocio.nombre}`}>
      {(cerrar) => (
        <>
          <OpcionMenu icono={<ArrowRight size={14} />} onClick={() => ir(cerrar, base)}>
            Abrir workspace
          </OpcionMenu>
          <OpcionMenu icono={<Receipt size={14} />} onClick={() => ir(cerrar, `${base}/suscripcion`)}>
            Ver suscripción
          </OpcionMenu>
          <OpcionMenu icono={<Users size={14} />} onClick={() => ir(cerrar, `${base}/usuarios`)}>
            Gestionar usuarios
          </OpcionMenu>
          <OpcionMenu icono={<LayoutGrid size={14} />} onClick={() => ir(cerrar, `${base}/modulos`)}>
            Configurar módulos
          </OpcionMenu>
          <OpcionMenu icono={<IdCard size={14} />} onClick={() => ir(cerrar, `${base}/identidad`)}>
            Editar identidad corporativa
          </OpcionMenu>
          <SeparadorMenu />
          <OpcionMenu
            icono={<Layers size={14} />}
            onClick={() => {
              cerrar();
              onCambiarPlan(negocio);
            }}
          >
            Cambiar de plan…
          </OpcionMenu>
          {onAplicarPlantilla && (
            <OpcionMenu
              icono={<LayoutTemplate size={14} />}
              onClick={() => {
                cerrar();
                onAplicarPlantilla(negocio);
              }}
            >
              Aplicar plantilla…
            </OpcionMenu>
          )}
          <SeparadorMenu />
          {negocio.estado === "SUSPENDIDO" ? (
            <OpcionMenu
              icono={<PlayCircle size={14} />}
              onClick={() => {
                cerrar();
                onCambiarEstado(negocio, "ACTIVO");
              }}
            >
              Reactivar…
            </OpcionMenu>
          ) : (
            <OpcionMenu
              icono={<Ban size={14} />}
              peligrosa
              onClick={() => {
                cerrar();
                onCambiarEstado(negocio, "SUSPENDIDO");
              }}
            >
              Suspender…
            </OpcionMenu>
          )}
        </>
      )}
    </Menu>
  );
}
