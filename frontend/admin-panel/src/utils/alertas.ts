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

export function confirmarEliminar(titulo: string, detalle?: string): Promise<boolean> {
  return confirmarAccion(titulo, detalle, "Eliminar");
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
