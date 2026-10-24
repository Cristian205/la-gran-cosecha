import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Columnas de ancho ajustable en TODAS las tablas del panel, sin tocar cada
 * vista: se monta una vez en el Layout, observa el DOM y a cada `<th>` le
 * añade una manija para arrastrar su borde derecho.
 *
 * - Arrastrar (ratón o dedo) cambia el ancho; con la manija enfocada, las
 *   flechas ← → lo cambian de 16 en 16 px (Mayús: de 48 en 48).
 * - Doble clic (o Supr) devuelve esa tabla a su ancho automático.
 * - Los anchos se recuerdan en este navegador, por pantalla y por tabla, y se
 *   asocian al TEXTO del encabezado: ocultar o reordenar columnas no los mezcla.
 *
 * Al primer ajuste la tabla pasa a `table-layout: fixed` con los anchos que
 * tenía en ese momento congelados, para que las demás columnas no salten.
 * La tabla sigue midiendo el 100 % de su carril: la última columna de datos
 * se queda sin ancho fijo y absorbe la diferencia (acciones nunca se encoge), y ninguna columna puede crecer más
 * de lo que deja libre el resto. Así ajustar nunca crea scroll horizontal.
 * Las manijas se insertan como último hijo del `<th>`; React solo añade o
 * quita sus propios nodos, así que convive con ellas.
 */

const CLAVE = "kryonx-anchos";
const MINIMO = 48;
/** Lo que se le deja como mínimo a la columna que absorbe el resto. */
const MINIMO_ULTIMA = 72;
const MARCA = "data-col-ajustable";
const NO_AJUSTABLES = ".col-check, .col-acciones";

type Anchos = Record<string, number>;

function leerTodo(): Record<string, Anchos> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}");
  } catch {
    return {};
  }
}

function guardarTodo(datos: Record<string, Anchos>) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo privado): los anchos duran lo que la pantalla.
  }
}

function textoDe(th: HTMLTableCellElement): string {
  return (th.innerText || th.textContent || "").replace(/\s+/g, " ").trim();
}

function encabezados(tabla: HTMLTableElement): HTMLTableCellElement[] {
  // La fila de títulos: la última del `<thead>` que no sea la de filtros por
  // columna (components/gestion/FiltrosColumna.tsx), que va debajo.
  const filas = Array.from(tabla.tHead?.rows ?? []).filter((f) => !f.classList.contains("fila-filtros"));
  const fila = filas[filas.length - 1];
  return fila ? (Array.from(fila.cells) as HTMLTableCellElement[]) : [];
}

/** Identifica la tabla dentro de la pantalla: su posición entre las tablas
 *  del documento más sus encabezados, para no confundir dos tablas distintas. */
function claveDeTabla(ruta: string, tabla: HTMLTableElement): string {
  const indice = Array.from(document.querySelectorAll("table")).indexOf(tabla);
  const firma = encabezados(tabla)
    .map(textoDe)
    .filter(Boolean)
    .slice(0, 3)
    .join("|");
  return `${ruta}#${indice}:${firma}`;
}

function carril(tabla: HTMLTableElement): number {
  return (tabla.parentElement ?? tabla).clientWidth;
}

/**
 * La columna que absorbe lo que sobre o falte: la última de DATOS. La de
 * acciones (y la de casillas) conservan siempre su ancho, para que ningún
 * botón quede cortado.
 */
function absorbente(ths: HTMLTableCellElement[]): HTMLTableCellElement | undefined {
  return [...ths].reverse().find((th) => !th.matches(NO_AJUSTABLES)) ?? ths[ths.length - 1];
}

function congelar(tabla: HTMLTableElement) {
  if (tabla.dataset.colFija === "1") return;
  const ths = encabezados(tabla);
  const anchos = ths.map((th) => th.getBoundingClientRect().width);
  const resto = absorbente(ths);
  ths.forEach((th, i) => {
    th.style.width = th === resto ? "" : `${Math.round(anchos[i])}px`;
  });
  tabla.style.tableLayout = "fixed";
  tabla.style.width = "100%";
  tabla.dataset.colFija = "1";
  tabla.classList.add("tabla-ajustada");
}

/**
 * Ancho natural de un elemento aunque su celda esté comprimida: se saca un
 * instante del flujo con `max-content` y se vuelve a dejar como estaba. Solo
 * toca el atributo `style`, que el observador de la tabla no vigila.
 */
function anchoNatural(el: HTMLElement): number {
  const previo = el.getAttribute("style");
  el.style.position = "absolute";
  el.style.width = "max-content";
  el.style.visibility = "hidden";
  const ancho = el.getBoundingClientRect().width;
  if (previo === null) el.removeAttribute("style");
  else el.setAttribute("style", previo);
  return ancho;
}

/**
 * El ancho de acciones y casillas sale de su CONTENIDO, no de una medida
 * guardada: con `table-layout: fixed` el navegador ya no respeta el mínimo
 * del contenido, y si la tabla se congeló mientras cargaba (filas esqueleto,
 * sin botones todavía) esa columna quedaba en casi 0 px y los botones
 * desaparecían. Se recalcula cada vez que cambian las filas.
 */
function ajustarIntocables(tabla: HTMLTableElement) {
  if (tabla.dataset.colFija !== "1") return;
  const ths = encabezados(tabla);
  const resto = absorbente(ths);
  ths.forEach((th, i) => {
    if (th === resto || !th.matches(NO_AJUSTABLES)) return;
    let ancho = 0;
    // Con las primeras filas basta: todas llevan los mismos botones, o menos.
    for (const fila of Array.from(tabla.tBodies).flatMap((b) => Array.from(b.rows)).slice(0, 15)) {
      const celda = fila.cells[i];
      // Solo filas con la misma forma que el encabezado (no la de «sin resultados»).
      if (!celda || fila.cells.length !== ths.length) continue;
      const estilo = getComputedStyle(celda);
      const relleno = parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight);
      const contenido = Array.from(celda.children).reduce((a, h) => Math.max(a, anchoNatural(h as HTMLElement)), 0);
      ancho = Math.max(ancho, Math.ceil(contenido + relleno));
    }
    if (ancho > 0 && parseInt(th.style.width, 10) !== ancho) th.style.width = `${ancho}px`;
  });
}

/** Que la suma de las columnas fijas deje sitio a la que absorbe, dentro del carril. */
function ajustarAlCarril(tabla: HTMLTableElement) {
  if (tabla.dataset.colFija !== "1") return;
  ajustarIntocables(tabla);
  const ths = encabezados(tabla);
  const resto = absorbente(ths);
  // Acciones y casillas no se encogen: se descuentan del espacio disponible.
  const intocables = ths.filter((th) => th !== resto && th.matches(NO_AJUSTABLES));
  const fijas = ths.filter((th) => th !== resto && !th.matches(NO_AJUSTABLES));
  const reservado = intocables.reduce((a, th) => a + (parseInt(th.style.width, 10) || 0), 0);
  const disponible = carril(tabla) - MINIMO_ULTIMA - reservado;
  const suma = fijas.reduce((a, th) => a + (parseInt(th.style.width, 10) || 0), 0);
  if (suma <= disponible || suma === 0) return;
  const factor = disponible / suma;
  fijas.forEach((th) => {
    const ancho = parseInt(th.style.width, 10) || 0;
    if (ancho) th.style.width = `${Math.max(MINIMO, Math.floor(ancho * factor))}px`;
  });
}

function soltar(tabla: HTMLTableElement) {
  encabezados(tabla).forEach((th) => {
    th.style.width = "";
  });
  tabla.style.tableLayout = "";
  tabla.style.width = "";
  delete tabla.dataset.colFija;
  tabla.classList.remove("tabla-ajustada");
}

export function ColumnasAjustables() {
  const { pathname } = useLocation();

  useEffect(() => {
    const guardar = (tabla: HTMLTableElement) => {
      const datos = leerTodo();
      const anchos: Anchos = {};
      encabezados(tabla).forEach((th) => {
        const texto = textoDe(th);
        if (texto && th.style.width) anchos[texto] = parseInt(th.style.width, 10);
      });
      datos[claveDeTabla(pathname, tabla)] = anchos;
      guardarTodo(datos);
    };

    const restablecer = (tabla: HTMLTableElement) => {
      soltar(tabla);
      const datos = leerTodo();
      delete datos[claveDeTabla(pathname, tabla)];
      guardarTodo(datos);
    };

    const cambiarAncho = (tabla: HTMLTableElement, th: HTMLTableCellElement, ancho: number) => {
      congelar(tabla);
      // Tope: lo que dejan libre las demás columnas fijas y el mínimo de la que absorbe.
      const ths = encabezados(tabla);
      const resto = absorbente(ths);
      const otras = ths
        .filter((x) => x !== th && x !== resto)
        .reduce((a, x) => a + (parseInt(x.style.width, 10) || 0), 0);
      const tope = carril(tabla) - MINIMO_ULTIMA - otras;
      th.style.width = `${Math.max(MINIMO, Math.min(tope, Math.round(ancho)))}px`;
    };

    const preparar = (tabla: HTMLTableElement) => {
      const ths = encabezados(tabla);
      if (ths.length < 2) return;

      const resto = absorbente(ths);
      ths.forEach((th, i) => {
        if (th.hasAttribute(MARCA) || th === resto || th.matches(NO_AJUSTABLES)) return;
        th.setAttribute(MARCA, "");
        const manija = document.createElement("span");
        manija.className = "col-manija";
        manija.tabIndex = 0;
        manija.setAttribute("role", "separator");
        manija.setAttribute("aria-orientation", "vertical");
        manija.setAttribute("aria-label", `Ajustar el ancho de la columna ${textoDe(th) || i + 1}`);
        manija.title = "Arrastra para ajustar el ancho · doble clic: automático";

        manija.addEventListener("click", (e) => e.stopPropagation());
        manija.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          restablecer(tabla);
        });
        manija.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          congelar(tabla);
          const inicioX = e.clientX;
          const inicio = th.getBoundingClientRect().width;
          manija.setPointerCapture(e.pointerId);
          document.body.classList.add("redimensionando-columna");
          const mover = (ev: PointerEvent) => cambiarAncho(tabla, th, inicio + ev.clientX - inicioX);
          const fin = () => {
            manija.removeEventListener("pointermove", mover);
            manija.removeEventListener("pointerup", fin);
            manija.removeEventListener("pointercancel", fin);
            document.body.classList.remove("redimensionando-columna");
            guardar(tabla);
          };
          manija.addEventListener("pointermove", mover);
          manija.addEventListener("pointerup", fin);
          manija.addEventListener("pointercancel", fin);
        });
        manija.addEventListener("keydown", (e) => {
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            restablecer(tabla);
            return;
          }
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const paso = (e.shiftKey ? 48 : 16) * (e.key === "ArrowRight" ? 1 : -1);
          cambiarAncho(tabla, th, th.getBoundingClientRect().width + paso);
          guardar(tabla);
        });
        th.appendChild(manija);
      });

      // Anchos recordados de esta tabla, si los hay y aún no se aplicaron.
      if (tabla.dataset.colFija !== "1") {
        const guardados = leerTodo()[claveDeTabla(pathname, tabla)];
        if (guardados && Object.keys(guardados).length) {
          congelar(tabla);
          ths.forEach((th) => {
            if (th === resto || th.matches(NO_AJUSTABLES)) return;
            const ancho = guardados[textoDe(th)];
            if (ancho) th.style.width = `${Math.max(MINIMO, ancho)}px`;
          });
          ajustarAlCarril(tabla);
        }
      }
    };

    let pendiente = 0;
    const revisar = () => {
      pendiente = 0;
      document.querySelectorAll<HTMLTableElement>("table").forEach(preparar);
      // Las filas cambian (carga, filtro, página): acciones vuelve a medirse.
      document.querySelectorAll<HTMLTableElement>("table.tabla-ajustada").forEach(ajustarAlCarril);
    };
    // Si el carril se estrecha (expandir el menú, girar la tableta), las
    // tablas ya ajustadas se reacomodan para seguir sin scroll horizontal.
    const alRedimensionar = () =>
      document.querySelectorAll<HTMLTableElement>("table.tabla-ajustada").forEach(ajustarAlCarril);
    const vigia = new ResizeObserver(alRedimensionar);
    const contenido = document.querySelector(".contenido") ?? document.body;
    vigia.observe(contenido);
    const programar = () => {
      if (!pendiente) pendiente = requestAnimationFrame(revisar);
    };

    revisar();
    const observador = new MutationObserver(programar);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      observador.disconnect();
      vigia.disconnect();
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [pathname]);

  return null;
}
