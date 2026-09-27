/**
 * Cuándo se muestra una pieza: desde / hasta, ambos opcionales.
 *
 * Sin fechas se muestra mientras esté activa (lo de siempre). Con ellas, la
 * tienda la enciende y la apaga sola: la promoción del lunes se deja lista el
 * viernes y la de fin de mes se retira sin que nadie se acuerde.
 *
 * El campo `datetime-local` trabaja en la hora del navegador; lo que se
 * guarda es ISO con zona, así que "el lunes a las 6" es el lunes a las 6 del
 * negocio y no del servidor.
 */
function aLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function aIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function estadoDeVigencia(inicio?: string | null, fin?: string | null): "programado" | "vencido" | null {
  const ahora = Date.now();
  if (inicio && new Date(inicio).getTime() > ahora) return "programado";
  if (fin && new Date(fin).getTime() < ahora) return "vencido";
  return null;
}

export function Vigencia({
  inicio,
  fin,
  onCambio,
}: {
  inicio: string | null;
  fin: string | null;
  onCambio: (v: { inicio: string | null; fin: string | null }) => void;
}) {
  const invertido = Boolean(inicio && fin && new Date(inicio) > new Date(fin));
  const estado = estadoDeVigencia(inicio, fin);

  return (
    <div className="campo">
      <label>Programar (opcional)</label>
      {/* Dos fechas no caben lado a lado en el panel lateral: se acomodan
          solas y bajan de línea cuando no hay ancho. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0 .75rem" }}>
        <div className="campo" style={{ minWidth: 0 }}>
          <label>Mostrar desde</label>
          <input
            type="datetime-local"
            style={{ width: "100%", minWidth: 0 }}
            value={aLocal(inicio)}
            onChange={(e) => onCambio({ inicio: aIso(e.target.value), fin })}
          />
        </div>
        <div className="campo" style={{ minWidth: 0 }}>
          <label>Mostrar hasta</label>
          <input
            type="datetime-local"
            style={{ width: "100%", minWidth: 0 }}
            value={aLocal(fin)}
            onChange={(e) => onCambio({ inicio, fin: aIso(e.target.value) })}
          />
        </div>
      </div>
      {invertido ? (
        <p className="campo-ayuda" style={{ color: "var(--rojo-texto)" }}>
          La fecha de fin es anterior a la de inicio: así no se mostraría nunca.
        </p>
      ) : estado === "programado" ? (
        <p className="campo-ayuda">Programado: todavía no se ve en la tienda.</p>
      ) : estado === "vencido" ? (
        <p className="campo-ayuda">Vencido: ya no se ve en la tienda.</p>
      ) : (
        <p className="campo-ayuda">Sin fechas se muestra mientras esté activo.</p>
      )}
    </div>
  );
}
