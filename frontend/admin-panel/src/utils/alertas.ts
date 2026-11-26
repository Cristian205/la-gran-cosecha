import Swal from "sweetalert2";

const swalBase = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    popup: "swal-panel",
    title: "swal-panel-titulo",
    confirmButton: "btn primario",
    cancelButton: "btn secundario",
  },
});

export async function confirmarAccion(
  titulo: string,
  detalle: string | undefined,
  textoConfirmar: string
): Promise<boolean> {
  const res = await swalBase.fire({
    icon: "warning",
    title: titulo,
    text: detalle,
    showCancelButton: true,
    reverseButtons: true,
    confirmButtonText: textoConfirmar,
    cancelButtonText: "Cancelar",
    customClass: {
      popup: "swal-panel",
      title: "swal-panel-titulo",
      confirmButton: "btn peligro",
      cancelButton: "btn secundario",
    },
  });
  return res.isConfirmed;
}

/**
 * Cerrar un formulario con cambios sin guardar. El botón seguro ("Seguir
 * editando") es el que queda enfocado: un Enter distraído no borra nada.
 */
export async function confirmarDescartar(detalle?: string): Promise<boolean> {
  const res = await swalBase.fire({
    icon: "warning",
    title: "Tienes cambios sin guardar",
    text: detalle ?? "Si cierras ahora, se perderán.",
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: "Descartar cambios",
    cancelButtonText: "Seguir editando",
    customClass: {
      popup: "swal-panel",
      title: "swal-panel-titulo",
      confirmButton: "btn peligro",
      cancelButton: "btn secundario",
    },
  });
  return res.isConfirmed;
}

/**
 * Una decisión con dos salidas además de cancelar (p. ej. «Guardar e
 * imprimir» / «Imprimir lo guardado»). `null` = canceló.
 */
export async function elegirEntreDos(
  titulo: string,
  detalle: string,
  principal: string,
  alternativa: string
): Promise<"principal" | "alternativa" | null> {
  const res = await swalBase.fire({
    icon: "question",
    title: titulo,
    text: detalle,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: principal,
    denyButtonText: alternativa,
    cancelButtonText: "Cancelar",
    customClass: {
      popup: "swal-panel",
      title: "swal-panel-titulo",
      confirmButton: "btn primario",
      denyButton: "btn secundario",
      cancelButton: "btn secundario",
    },
  });
  if (res.isConfirmed) return "principal";
  if (res.isDenied) return "alternativa";
  return null;
}

export function confirmarEliminar(titulo: string, detalle?: string): Promise<boolean> {
  return confirmarAccion(titulo, detalle, "Eliminar");
}

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function listaHtml(items: string[]): string {
  return `<ul class="swal-consecuencias">${items.map((i) => `<li>${escaparHtml(i)}</li>`).join("")}</ul>`;
}

/**
 * Confirmar algo que no se puede deshacer, diciendo antes qué va a pasar.
 *
 * `consecuencias` es la lista de lo que desaparece; `seConserva`, lo que NO
 * se toca (para que nadie dude de si se lleva algo más). El botón seguro
 * («Cancelar») queda enfocado: un Enter distraído no borra nada.
 */
export async function confirmarConConsecuencias(opciones: {
  titulo: string;
  intro: string;
  consecuencias: string[];
  seConserva?: string[];
  textoConfirmar: string;
}): Promise<boolean> {
  const { titulo, intro, consecuencias, seConserva, textoConfirmar } = opciones;
  const html =
    `<p class="swal-consecuencias-intro">${escaparHtml(intro)}</p>` +
    listaHtml(consecuencias) +
    (seConserva?.length
      ? `<p class="swal-consecuencias-intro">No se toca:</p>${listaHtml(seConserva)}`
      : "") +
    `<p class="swal-consecuencias-final">Esta acción no se puede deshacer.</p>`;
  const res = await swalBase.fire({
    icon: "warning",
    title: titulo,
    html,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: textoConfirmar,
    cancelButtonText: "Cancelar",
    customClass: {
      popup: "swal-panel",
      title: "swal-panel-titulo",
      confirmButton: "btn peligro",
      cancelButton: "btn secundario",
    },
  });
  return res.isConfirmed;
}

/** Un aviso con explicación y lista, sin nada que confirmar. */
export function alertaConLista(titulo: string, intro: string, items: string[], cierre?: string): Promise<unknown> {
  return swalBase.fire({
    icon: "info",
    title: titulo,
    html:
      `<p class="swal-consecuencias-intro">${escaparHtml(intro)}</p>` +
      listaHtml(items) +
      (cierre ? `<p class="swal-consecuencias-final">${escaparHtml(cierre)}</p>` : ""),
    confirmButtonText: "Entendido",
  });
}

export function confirmarRechazo(titulo: string, detalle?: string): Promise<boolean> {
  return confirmarAccion(titulo, detalle, "Rechazar");
}

export function alertaAdvertencia(mensaje: string): Promise<unknown> {
  return swalBase.fire({
    icon: "warning",
    title: mensaje,
    confirmButtonText: "Entendido",
  });
}

export function alertaError(mensaje: string): Promise<unknown> {
  return swalBase.fire({
    icon: "error",
    title: "Ocurrió un error",
    text: mensaje,
    confirmButtonText: "Cerrar",
  });
}

/**
 * Confirmacion breve de que algo salio bien.
 *
 * Es un aviso flotante y no un dialogo: el usuario acaba de pulsar el boton y
 * ya sabe lo que pidio; obligarle a cerrar una ventana para seguir trabajando
 * seria un paso de mas. Los errores si son dialogo, porque hay que leerlos.
 */
export function alertaExito(mensaje: string): Promise<unknown> {
  return swalBase.fire({
    icon: "success",
    title: mensaje,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
  });
}
