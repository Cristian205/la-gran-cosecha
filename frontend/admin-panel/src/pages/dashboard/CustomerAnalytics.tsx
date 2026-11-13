import { ArrowRight, Repeat, UserCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../theme/ThemeContext";
import { CuerpoModulo, EmptyState, InfoTip, Tarjeta } from "./estados";
import { numero, porcentaje, variacion } from "./formato";
import { etiquetaDeCubeta, etiquetaDeEje, referenciaAnterior } from "./periodo";
import type { AnaliticaClientes } from "./tipos";
import { useModulo } from "./useModulo";
import { VariacionChip } from "./Variacion";

/**
 * Clientes y crecimiento.
 *
 * Cinco conceptos que NO son lo mismo y aquí no se mezclan (definiciones en
 * `apps/orders/analitica.py`): registrado (existe, compre o no), nuevo por
 * registro, nuevo por primera compra, activo (compró en el período) y
 * recurrente (activo que ya había comprado antes).
 */
export function CustomerAnalytics({ puedeVerClientes }: { puedeVerClientes: boolean }) {
  const { estado, recargar } = useModulo("clientes");
  return (
    <Tarjeta
      titulo="Clientes y crecimiento"
      subtitulo="Captación y comportamiento de compra del período"
      info="Una compra es un pedido ENTREGADO. «Nuevo por primera compra» mira la primera compra histórica del cliente; «nuevo por registro», la fecha en que se creó su ficha."
      accion={
        puedeVerClientes ? (
          <Link className="db-enlace" to="/clientes">
            Ver clientes <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : undefined
      }
      className="db-clientes"
      actualizando={estado.tipo === "listo" && estado.actualizando}
    >
      <CuerpoModulo estado={estado} filas={8} error="No pudimos cargar los clientes." onReintentar={recargar}>
        {(d) => <Contenido datos={d} />}
      </CuerpoModulo>
    </Tarjeta>
  );
}

function Contenido({ datos }: { datos: AnaliticaClientes }) {
  const ref = referenciaAnterior(datos.periodo);
  const ant = datos.anterior;

  return (
    <>
      <dl className="db-cifras">
        <Cifra
          icono={Users}
          titulo="Registrados"
          valor={datos.registrados}
          pie={`${numero(datos.nuevos_registro)} nuevos por registro`}
          info="Todos los clientes con ficha al cierre del período, hayan comprado o no."
        />
        <Cifra
          icono={UserCheck}
          titulo="Activos"
          valor={datos.activos}
          var={<VariacionChip variacion={variacion(datos.activos, ant?.activos)} referencia={ref} compacta />}
          info="Clientes con al menos una compra entregada en el período."
        />
        <Cifra
          icono={UserPlus}
          titulo="Nuevos (1.ª compra)"
          valor={datos.nuevos_compra}
          var={<VariacionChip variacion={variacion(datos.nuevos_compra, ant?.nuevos_compra)} referencia={ref} compacta />}
          info="Clientes cuya primera compra histórica fue en este período. No depende de cuándo se registraron."
        />
        <Cifra
          icono={Repeat}
          titulo="Recurrentes"
          valor={datos.recurrentes}
          var={<VariacionChip variacion={variacion(datos.recurrentes, ant?.recurrentes)} referencia={ref} compacta />}
          info="Clientes que compraron en el período y ya habían comprado antes de él."
        />
        <Cifra
          icono={UserMinus}
          titulo="Sin comprar recientemente"
          valor={datos.inactivos}
          tono="ambar"
          pie={`Más de ${datos.dias_inactividad} días sin comprar`}
          info={`Clientes que compraron alguna vez, pero cuya última compra tiene más de ${datos.dias_inactividad} días al cierre del período. Son ${porcentaje(
            datos.con_compras ? (datos.inactivos / datos.con_compras) * 100 : 0,
            0
          )} de quienes han comprado.`}
        />
      </dl>

      <div className="db-clientes-graficas">
        <Distribucion datos={datos} />
        <Evolucion datos={datos} />
        <Frecuencia datos={datos} />
      </div>
    </>
  );
}

function Cifra({
  icono: Icono,
  titulo,
  valor,
  pie,
  var: chip,
  info,
  tono,
}: {
  icono: typeof Users;
  titulo: string;
  valor: number;
  pie?: string;
  var?: React.ReactNode;
  info: string;
  tono?: "ambar";
}) {
  return (
    <div className={`db-cifra ${tono ? `db-cifra--${tono}` : ""}`}>
      <dt>
        <Icono size={14} aria-hidden="true" />
        {titulo}
        <InfoTip texto={info} />
      </dt>
      <dd>{numero(valor)}</dd>
      {chip}
      {pie && <p>{pie}</p>}
    </div>
  );
}

function useColores() {
  const { tema } = useTheme();
  return tema === "oscuro"
    ? { verde: "#34d399", azul: "#60a5fa", eje: "#8b95a7", grid: "#232b3a", vacio: "#232b3a" }
    : { verde: "#15803d", azul: "#2563eb", eje: "#64748b", grid: "#e8edf3", vacio: "#e8edf3" };
}

/** A. Nuevos vs. recurrentes entre los compradores del período. */
function Distribucion({ datos }: { datos: AnaliticaClientes }) {
  const c = useColores();
  const total = datos.activos;
  const partes = [
    { nombre: "Nuevos", valor: datos.nuevos_compra, color: c.verde },
    { nombre: "Recurrentes", valor: datos.recurrentes, color: c.azul },
  ];
  return (
    <figure className="db-mini">
      <figcaption>Nuevos vs. recurrentes</figcaption>
      {total === 0 ? (
        <EmptyState icono={Users} titulo="Sin compradores en el período" />
      ) : (
        <div className="db-dona">
          <div className="db-dona-grafica" role="img" aria-label={`${datos.nuevos_compra} nuevos y ${datos.recurrentes} recurrentes`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={partes} dataKey="valor" nameKey="nombre" innerRadius="68%" outerRadius="100%" stroke="none" paddingAngle={partes.every((p) => p.valor) ? 2 : 0} animationDuration={500}>
                  {partes.map((p) => (
                    <Cell key={p.nombre} fill={p.color} />
                  ))}
                </Pie>
                {/* La dona es pequeña: el globo puede salir de su cuadro en vez de taparla. */}
                <Tooltip
                  content={<GloboSimple sufijo="clientes" total={total} />}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 20 }}
                />

              </PieChart>
            </ResponsiveContainer>
            <span className="db-dona-centro">
              <strong>{numero(total)}</strong>
              compradores
            </span>
          </div>
          <ul className="db-dona-leyenda">
            {partes.map((p) => (
              <li key={p.nombre}>
                <span className="db-punto" style={{ background: p.color }} aria-hidden="true" />
                {p.nombre}
                <strong>{numero(p.valor)}</strong>
                <span className="db-tenue">{porcentaje((p.valor / total) * 100, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}

/** B. Cuántos clientes nuevos entraron en cada cubeta, por compra y por registro. */
function Evolucion({ datos }: { datos: AnaliticaClientes }) {
  const c = useColores();
  const g = datos.periodo.granularidad;
  const puntos = useMemo(
    () => datos.evolucion.map((p) => ({ ...p, eje: etiquetaDeEje(p.inicio, g) })),
    [datos, g]
  );
  const hay = datos.evolucion.some((p) => p.primera_compra || p.registro);
  return (
    <figure className="db-mini db-mini--ancha">
      <figcaption>
        Captación de clientes
        <span className="db-leyenda db-leyenda--inline" aria-hidden="true">
          <span><span className="db-punto" style={{ background: c.verde }} /> 1.ª compra</span>
          <span><span className="db-punto" style={{ background: c.azul }} /> Registro</span>
        </span>
      </figcaption>
      {!hay ? (
        <EmptyState icono={UserPlus} titulo="Sin clientes nuevos en el período" />
      ) : (
        <div className="db-grafica db-grafica--mini" role="img" aria-label="Clientes nuevos por primera compra y por registro a lo largo del período">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={puntos} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="eje" tick={{ fontSize: 10.5, fill: c.eje }} axisLine={false} tickLine={false} minTickGap={14} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10.5, fill: c.eje }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: c.grid, opacity: 0.5 }}
                content={<GloboEvolucion granularidad={g} />}
              />
              <Bar dataKey="primera_compra" name="Primera compra" fill={c.verde} radius={[3, 3, 0, 0]} maxBarSize={14} animationDuration={500} />
              <Bar dataKey="registro" name="Registro" fill={c.azul} radius={[3, 3, 0, 0]} maxBarSize={14} animationDuration={500} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

/** C. Cuántas veces compró cada comprador en el período. */
function Frecuencia({ datos }: { datos: AnaliticaClientes }) {
  const max = Math.max(...datos.frecuencia.map((f) => f.clientes), 1);
  return (
    <figure className="db-mini">
      <figcaption>Frecuencia de compra</figcaption>
      {datos.activos === 0 ? (
        <EmptyState icono={Repeat} titulo="Sin compras en el período" />
      ) : (
        <ul className="db-barras">
          {datos.frecuencia.map((f, i) => (
            <li key={f.clave} style={{ "--i": i } as CSSProperties} title={`${f.clientes} clientes con ${f.etiqueta}`}>
              <span className="db-barras-nombre">{f.etiqueta}</span>
              <span className="db-barras-pista" aria-hidden="true">
                <span style={{ transform: `scaleX(${f.clientes / max})` }} />
              </span>
              <span className="db-barras-valor">{numero(f.clientes)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function GloboSimple({
  active,
  payload,
  sufijo,
  total,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  sufijo: string;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="db-globo">
      <p className="db-globo-fecha">{p.name}</p>
      <p className="db-globo-valor">
        {numero(p.value)} {sufijo}
      </p>
      <p className="db-globo-sub">{porcentaje((p.value / total) * 100)} de los compradores</p>
    </div>
  );
}

function GloboEvolucion({
  active,
  payload,
  granularidad,
}: {
  active?: boolean;
  payload?: { payload: unknown }[];
  granularidad: AnaliticaClientes["periodo"]["granularidad"];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { inicio: string; primera_compra: number; registro: number };
  return (
    <div className="db-globo">
      <p className="db-globo-fecha">{etiquetaDeCubeta(p.inicio, granularidad)}</p>
      <p className="db-globo-sub">
        <strong>{p.primera_compra}</strong> por primera compra
      </p>
      <p className="db-globo-sub">
        <strong>{p.registro}</strong> por registro
      </p>
    </div>
  );
}
