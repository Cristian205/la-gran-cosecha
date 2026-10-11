/**
 * Design System: la documentación viva del Control Center.
 *
 * Nada de esta página es una imagen ni una copia: los colores se leen de los
 * tokens en el momento —así que cambian con la marca publicada— y cada pieza
 * es el componente de verdad que usan las demás pantallas. Si algo se ve mal
 * aquí, se ve mal en todo el panel, que es justo para lo que sirve.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Building2, Check, LayoutDashboard, Plus, Search, Users } from "lucide-react";
import { usarMarca } from "../marca/ProveedorMarca";
import { Aviso, Boton, Campo, EstadoVacio, Insignia, Tarjeta } from "../ui/basicos";
import { Modal } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";
import { BarraSegmentada, BarrasHorizontales, GraficoArea, Sparkline } from "../ui/Graficos";
import { IndicadorUso } from "../ui/Uso";
import { EncabezadoPagina, TarjetaMetrica } from "../componentes/piezas";

const TOKENS_COLOR: { grupo: string; tokens: string[] }[] = [
  { grupo: "Marca", tokens: ["--brand-primary", "--brand-primary-strong", "--brand-on-primary", "--brand-secondary", "--brand-accent"] },
  { grupo: "Superficies", tokens: ["--background", "--surface-1", "--surface-2", "--surface-3", "--border", "--border-strong"] },
  { grupo: "Texto", tokens: ["--text-primary", "--text-secondary", "--text-muted"] },
  { grupo: "Estados", tokens: ["--success", "--warning", "--danger", "--info"] },
];

const TOKENS_FORMA = ["--radius-sm", "--radius-md", "--radius-lg", "--shadow-sm", "--shadow-md", "--duration"];

const ESCALA: { nombre: string; clase: string; uso: string }[] = [
  { nombre: "Display", clase: "tipo-display", uso: "Cifras protagonistas" },
  { nombre: "Heading", clase: "tipo-heading", uso: "Título de página" },
  { nombre: "Subheading", clase: "tipo-subheading", uso: "Título de tarjeta" },
  { nombre: "Body", clase: "tipo-body", uso: "Texto de lectura" },
  { nombre: "Label", clase: "tipo-label", uso: "Etiquetas y encabezados de tabla" },
  { nombre: "Caption", clase: "tipo-caption", uso: "Contexto y notas" },
];

function leerTokens(nombres: string[]): Record<string, string> {
  const estilo = getComputedStyle(document.documentElement);
  return Object.fromEntries(nombres.map((n) => [n, estilo.getPropertyValue(n).trim()]));
}

function Seccion({ id, titulo, descripcion, children }: { id: string; titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section className="ds-seccion" id={id} aria-labelledby={`${id}-titulo`}>
      <header className="ds-seccion__cabecera">
        <h2 id={`${id}-titulo`}>{titulo}</h2>
        <p className="tenue">{descripcion}</p>
      </header>
      {children}
    </section>
  );
}

export function DesignSystem() {
  const { activa } = usarMarca();
  const avisar = usarAviso();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [modal, setModal] = useState(false);
  const [segmento, setSegmento] = useState("semana");

  // Se releen al cambiar de marca: el motor acaba de escribir otros valores.
  useEffect(() => {
    const todos = [...TOKENS_COLOR.flatMap((g) => g.tokens), ...TOKENS_FORMA, "--font-sans"];
    const id = requestAnimationFrame(() => setValores(leerTokens(todos)));
    return () => cancelAnimationFrame(id);
  }, [activa]);

  const indice = [
    ["tokens", "Tokens"],
    ["tipografia", "Tipografía"],
    ["botones", "Botones"],
    ["campos", "Campos"],
    ["estados", "Estados"],
    ["tarjetas", "Tarjetas"],
    ["tablas", "Tablas"],
    ["navegacion", "Navegación"],
    ["graficas", "Gráficas"],
    ["avisos", "Avisos y diálogos"],
  ];

  return (
    <>
      <EncabezadoPagina
        antetitulo="Marca"
        titulo="Design System"
        descripcion={`Los tokens y componentes de los que está hecho el Control Center, vestidos ahora con ${activa.nombre}. Cualquier plantilla futura se construye con estas mismas piezas.`}
      />

      <nav className="ds-indice" aria-label="Secciones del Design System">
        {indice.map(([id, nombre]) => (
          <a key={id} href={`#${id}`}>
            {nombre}
          </a>
        ))}
      </nav>

      <Seccion id="tokens" titulo="Tokens" descripcion="La única fuente de color, forma y tiempo. Ningún componente escribe un color.">
        <div className="ds-tokens">
          {TOKENS_COLOR.map((g) => (
            <div key={g.grupo} className="ds-tokens__grupo">
              <p className="ds-etiqueta">{g.grupo}</p>
              {g.tokens.map((t) => (
                <div key={t} className="ds-token">
                  <span className="ds-token__muestra" style={{ background: `var(${t})` }} />
                  <code>{t}</code>
                  <span className="ds-token__valor">{valores[t] || "—"}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="ds-tokens__grupo">
            <p className="ds-etiqueta">Forma y tiempo</p>
            {TOKENS_FORMA.map((t) => (
              <div key={t} className="ds-token">
                <span
                  className="ds-token__muestra ds-token__muestra--forma"
                  style={t.startsWith("--radius") ? { borderRadius: `var(${t})` } : t.startsWith("--shadow") ? { boxShadow: `var(${t})` } : undefined}
                />
                <code>{t}</code>
                <span className="ds-token__valor">{valores[t] || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion id="tipografia" titulo="Tipografía" descripcion={`${activa.tipografia}. Seis niveles; las cifras son siempre tabulares.`}>
        <div className="tarjeta ds-escala">
          {ESCALA.map((e) => (
            <div key={e.nombre} className="ds-escala__fila">
              <span className="ds-etiqueta">{e.nombre}</span>
              <span className={e.clase}>{e.nombre === "Display" ? "$1.250.000" : "Control Center de la plataforma"}</span>
              <span className="tenue">{e.uso}</span>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion id="botones" titulo="Botones" descripcion="Una sola acción primaria por vista. El peligro es rojo y nada más lo es.">
        <div className="tarjeta ds-muestrario">
          <Boton variante="primario" icono={<Plus size={14} />}>Primario</Boton>
          <Boton>Secundario</Boton>
          <Boton variante="fantasma">Fantasma</Boton>
          <Boton variante="peligro">Peligro</Boton>
          <Boton cargando>Guardando</Boton>
          <Boton disabled>Deshabilitado</Boton>
          <Boton tamano="pequeno" variante="primario">Pequeño</Boton>
        </div>
      </Seccion>

      <Seccion id="campos" titulo="Campos" descripcion="Etiqueta siempre visible; la ayuda explica la consecuencia, no el formato.">
        <div className="tarjeta ds-campos">
          <Campo etiqueta="Nombre de la empresa" ayuda="Así la verán sus clientes.">
            <input placeholder="La Gran Cosecha" />
          </Campo>
          <Campo etiqueta="Plan">
            <select defaultValue="">
              <option value="">Elige un plan</option>
              <option>Básico</option>
            </select>
          </Campo>
          <div className="filtros__buscar">
            <Search size={15} />
            <input placeholder="Buscar…" aria-label="Ejemplo de búsqueda" />
          </div>
        </div>
      </Seccion>

      <Seccion id="estados" titulo="Estados" descripcion="El color dice algo del estado; sin estado, gris.">
        <div className="tarjeta ds-muestrario">
          <Insignia tono="ok" punto>Activa</Insignia>
          <Insignia tono="info" punto>En prueba</Insignia>
          <Insignia tono="aviso" punto>Por vencer</Insignia>
          <Insignia tono="malo" punto>Suspendida</Insignia>
          <Insignia>Archivada</Insignia>
          <span className="salud-empresa salud-empresa--ok"><span className="pulso pulso--ok" />Saludable</span>
          <span className="salud-empresa salud-empresa--malo"><span className="pulso pulso--malo" />Crítica</span>
        </div>
        <div className="tarjeta ds-usos">
          <IndicadorUso indicador={{ clave: "a", etiqueta: "Usuarios", usado: 3, limite: 10 }} />
          <IndicadorUso indicador={{ clave: "b", etiqueta: "Dominios", usado: 4, limite: 5 }} />
          <IndicadorUso indicador={{ clave: "c", etiqueta: "Productos", usado: 5, limite: 5 }} />
          <IndicadorUso indicador={{ clave: "d", etiqueta: "Almacenamiento", usado: null, limite: 1024, unidad: "mb", sinDato: true }} />
        </div>
      </Seccion>

      <Seccion id="tarjetas" titulo="Tarjetas" descripcion="Superficie, borde casi invisible y el número como protagonista.">
        <div className="kpis">
          <TarjetaMetrica etiqueta="KPI" icono={<Building2 size={15} />} valor="03" variacion={{ texto: "+2", sentido: "sube" }} contexto="este mes" grafico={<Sparkline valores={[1, 1, 2, 2, 3, 3]} />} />
          <TarjetaMetrica etiqueta="Con aviso" valor="01" tono="aviso" contexto="requiere atención" />
          <TarjetaMetrica etiqueta="Crítica" valor="01" tono="malo" contexto="sin respuesta" />
        </div>
      </Seccion>

      <Seccion id="tablas" titulo="Tablas" descripcion="Cabecera discreta, filas que respiran. En el móvil cada fila se vuelve tarjeta.">
        <div className="marco-tabla">
          <table className="tabla tabla--tarjetas">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Estado</th>
                <th className="num">Usuarios</th>
              </tr>
            </thead>
            <tbody>
              {[["Ejemplo uno", "ok", "Activa", 4], ["Ejemplo dos", "info", "En prueba", 1]].map(([n, tono, e, u]) => (
                <tr key={String(n)}>
                  <td className="celda-principal">
                    <span className="empresa">
                      <span className="avatar-empresa">{String(n)[0]}</span>
                      <span className="empresa__nombre">{n}</span>
                    </span>
                  </td>
                  <td data-etiqueta="Estado"><Insignia tono={tono as "ok"} punto>{e}</Insignia></td>
                  <td className="num" data-etiqueta="Usuarios">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion id="navegacion" titulo="Navegación" descripcion="Activo con la marca; el resto, en texto secundario.">
        <div className="tarjeta ds-navegacion">
          <div className="ds-lateral">
            <span className="lateral__enlace active"><LayoutDashboard size={16} /> Dashboard</span>
            <span className="lateral__enlace"><Building2 size={16} /> Empresas</span>
            <span className="lateral__enlace"><Users size={16} /> Usuarios</span>
          </div>
          <div className="segmentado" role="tablist" aria-label="Ejemplo de control segmentado">
            {["dia", "semana", "mes"].map((s) => (
              <button key={s} type="button" role="tab" aria-selected={segmento === s} className={`segmentado__opcion ${segmento === s ? "esta-activa" : ""}`} onClick={() => setSegmento(s)}>
                {s === "dia" ? "Día" : s === "semana" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion id="graficas" titulo="Gráficas" descripcion="Pocas, limpias y de un solo color salvo cuando el color es un estado.">
        <div className="rejilla-dos">
          <Tarjeta titulo="Línea">
            <GraficoArea etiqueta="Serie de ejemplo" puntos={[{ etiqueta: "ene", valor: 1 }, { etiqueta: "feb", valor: 2 }, { etiqueta: "mar", valor: 2 }, { etiqueta: "abr", valor: 4 }, { etiqueta: "may", valor: 5 }, { etiqueta: "jun", valor: 7 }]} />
          </Tarjeta>
          <Tarjeta titulo="Barras y reparto">
            <BarrasHorizontales filas={[{ etiqueta: "Plan A", valor: 8 }, { etiqueta: "Plan B", valor: 5 }, { etiqueta: "Plan C", valor: 2 }]} />
            <div className="mt-4">
              <BarraSegmentada partes={[{ etiqueta: "Activas", valor: 6, tono: "ok" }, { etiqueta: "Prueba", valor: 2, tono: "info" }, { etiqueta: "Suspendidas", valor: 1, tono: "malo" }]} />
            </div>
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion id="avisos" titulo="Avisos y diálogos" descripcion="Los errores se quedan hasta leerse; las confirmaciones dicen a quién afectan.">
        <div className="ds-avisos">
          <Aviso tono="malo">No se pudo guardar el plan: el nombre ya existe.</Aviso>
          <Aviso tono="aviso">La renovación vence en 5 días.</Aviso>
          <Aviso tono="ok">Los cambios se guardaron.</Aviso>
        </div>
        <div className="tarjeta ds-muestrario">
          <Boton icono={<Bell size={14} />} onClick={() => avisar("Esto es una notificación de confirmación.")}>Mostrar toast</Boton>
          <Boton variante="peligro" onClick={() => avisar("Esto es una notificación de error.", "malo")}>Toast de error</Boton>
          <Boton onClick={() => setModal(true)}>Abrir modal</Boton>
        </div>
        <section className="tarjeta">
          <EstadoVacio icono={Check} titulo="Estado vacío" accion={<Boton tamano="pequeno">Acción</Boton>}>
            Dice qué falta y qué hacer, en vez de dejar la pantalla en blanco.
          </EstadoVacio>
        </section>
      </Seccion>

      {modal && (
        <Modal
          titulo="Diálogo"
          descripcion="Foco dentro, Escape para cerrar, y la acción principal a la derecha."
          onCerrar={() => setModal(false)}
          pie={
            <>
              <Boton onClick={() => setModal(false)}>Cancelar</Boton>
              <Boton variante="primario" onClick={() => setModal(false)}>Entendido</Boton>
            </>
          }
        />
      )}
    </>
  );
}
