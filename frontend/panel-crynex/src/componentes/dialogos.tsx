/**
 * Las acciones que cambian algo para un cliente.
 *
 * Todas pasan por aquí y todas dicen tres cosas antes de ejecutarse: a qué
 * empresa afectan, qué va a cambiar y qué consecuencia tiene para su gente.
 * Es la diferencia entre administrar una plataforma y editar una fila.
 */
import { useState } from "react";
import type { EstadoNegocio, Negocio, Plan } from "../api/tipos";
import { ETIQUETA_ESTADO } from "../datos/derivados";
import { moneda } from "../datos/formato";
import { usarPlataforma } from "../datos/plataforma";
import { usarAviso } from "../ui/Notificaciones";
import { Confirmar } from "../ui/Modal";

/** Cambiar de plan: se elige primero y se confirma después, nunca de golpe. */
export function DialogoPlan({
  negocio,
  onCerrar,
}: {
  negocio: Negocio;
  onCerrar: () => void;
}) {
  const { planes, cambiarPlan } = usarPlataforma();
  const avisar = usarAviso();
  const disponibles = planes.filter((p) => p.activo || p.slug === negocio.plan?.slug);
  const [elegido, setElegido] = useState(negocio.plan?.slug ?? "");
  const [trabajando, setTrabajando] = useState(false);

  const plan = disponibles.find((p) => p.slug === elegido) ?? null;
  const cambia = elegido !== "" && elegido !== negocio.plan?.slug;

  async function confirmar() {
    if (!cambia) return onCerrar();
    setTrabajando(true);
    try {
      await cambiarPlan(negocio, elegido);
      avisar(`${negocio.nombre} pasó al plan ${plan?.nombre ?? elegido}.`);
      onCerrar();
    } catch (e) {
      avisar((e as Error).message, "malo");
      setTrabajando(false);
    }
  }

  return (
    <Confirmar
      titulo="Cambiar de plan"
      afecta={negocio.nombre}
      etiquetaAccion={cambia ? "Cambiar el plan" : "Sin cambios"}
      trabajando={trabajando}
      onConfirmar={confirmar}
      onCerrar={onCerrar}
      consecuencias={
        <>
          <p>
            El plan decide qué módulos ve la empresa y hasta dónde puede crecer.
            Los usuarios que estén dentro lo notarán en cuanto recarguen.
          </p>
          {cambia && plan && <ComparacionPlanes desde={negocio.plan?.slug} hasta={plan} />}
        </>
      }
    >
      <ul className="planes-elegir">
        {disponibles.map((p) => (
          <li key={p.slug}>
            <label className={`planes-elegir__fila ${elegido === p.slug ? "esta-elegido" : ""}`}>
              <input
                type="radio"
                name="plan"
                value={p.slug}
                checked={elegido === p.slug}
                onChange={() => setElegido(p.slug)}
              />
              <span className="planes-elegir__nombre">
                {p.nombre}
                {p.slug === negocio.plan?.slug && <span className="tenue"> · actual</span>}
                {!p.activo && <span className="tenue"> · retirado</span>}
              </span>
              <span className="planes-elegir__precio">
                {Number(p.precio_mensual) === 0
                  ? "Gratis"
                  : `${moneda(p.precio_mensual, p.moneda)} /mes`}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Confirmar>
  );
}

/** Qué gana y qué pierde la empresa con el cambio, en permisos. */
function ComparacionPlanes({ desde, hasta }: { desde?: string; hasta: Plan }) {
  const { planes, permisos } = usarPlataforma();
  const anterior = planes.find((p) => p.slug === desde);
  if (!anterior) return null;

  const antes = new Set(anterior.permisos);
  const despues = new Set(hasta.permisos);
  const nombre = (codename: string) =>
    permisos.find((p) => p.codename === codename)?.etiqueta ?? codename;

  const gana = hasta.permisos.filter((c) => !antes.has(c));
  const pierde = anterior.permisos.filter((c) => !despues.has(c));

  if (gana.length === 0 && pierde.length === 0) {
    return <p className="tenue">Los dos planes conceden exactamente los mismos permisos.</p>;
  }

  return (
    <div className="comparacion">
      {pierde.length > 0 && (
        <p className="comparacion__pierde">
          <strong>Pierde {pierde.length}:</strong> {pierde.map(nombre).join(", ")}
        </p>
      )}
      {gana.length > 0 && (
        <p className="comparacion__gana">
          <strong>Gana {gana.length}:</strong> {gana.map(nombre).join(", ")}
        </p>
      )}
    </div>
  );
}

const CONSECUENCIA: Record<EstadoNegocio, string> = {
  ACTIVO: "La empresa vuelve a atender peticiones y su equipo recupera el acceso.",
  PRUEBA: "La empresa queda operativa en modo de prueba.",
  SUSPENDIDO:
    "Su tienda deja de responder y su equipo no podrá entrar al panel. Los datos se conservan.",
  ARCHIVADO:
    "La empresa desaparece de la operación diaria. Los datos se conservan, pero deja de estar disponible.",
};

export function DialogoEstado({
  negocio,
  estado,
  onCerrar,
}: {
  negocio: Negocio;
  estado: EstadoNegocio;
  onCerrar: () => void;
}) {
  const { cambiarEstado } = usarPlataforma();
  const avisar = usarAviso();
  const [trabajando, setTrabajando] = useState(false);
  const peligrosa = estado === "SUSPENDIDO" || estado === "ARCHIVADO";

  async function confirmar() {
    setTrabajando(true);
    try {
      await cambiarEstado(negocio, estado);
      avisar(`${negocio.nombre}: ${ETIQUETA_ESTADO[estado].toLowerCase()}.`);
      onCerrar();
    } catch (e) {
      avisar((e as Error).message, "malo");
      setTrabajando(false);
    }
  }

  return (
    <Confirmar
      titulo={`Marcar como ${ETIQUETA_ESTADO[estado].toLowerCase()}`}
      afecta={negocio.nombre}
      peligrosa={peligrosa}
      etiquetaAccion={ETIQUETA_ESTADO[estado]}
      trabajando={trabajando}
      onConfirmar={confirmar}
      onCerrar={onCerrar}
      consecuencias={
        <>
          <p>{CONSECUENCIA[estado]}</p>
          <p className="tenue">
            Afecta a {negocio.usuarios}{" "}
            {negocio.usuarios === 1 ? "usuario" : "usuarios"} y a{" "}
            {negocio.dominios.length}{" "}
            {negocio.dominios.length === 1 ? "dominio" : "dominios"}.
          </p>
        </>
      }
    />
  );
}
