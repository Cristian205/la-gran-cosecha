/**
 * Cierre de sesión por inactividad.
 *
 * Mientras se usa el panel la sesión sigue viva el tiempo que haga falta (el
 * token de acceso se renueva solo, ver `api/client.ts`). Lo que la cierra es
 * pasar MINUTOS_INACTIVIDAD sin tocar nada: en un equipo que se queda abierto
 * nadie más debe poder seguir trabajando con la cuenta.
 *
 * La última actividad vive en `localStorage` para que todas las pestañas la
 * compartan: trabajar en una mantiene viva la otra. Se compara contra el
 * reloj y no con un temporizador, así que también cuenta el tiempo con el
 * equipo suspendido o la pestaña en segundo plano.
 */
export const MINUTOS_INACTIVIDAD = 30;
const LIMITE_MS = MINUTOS_INACTIVIDAD * 60 * 1000;

const CLAVE_ACTIVIDAD = "kryonx_admin_ultima_actividad";
const CLAVE_MOTIVO = "kryonx_admin_motivo_cierre";

export type MotivoCierre = "inactividad" | "expirada";

export const MENSAJES_CIERRE: Record<MotivoCierre, string> = {
  inactividad: `Por seguridad cerramos tu sesión tras ${MINUTOS_INACTIVIDAD} minutos de inactividad. Inicia sesión de nuevo para continuar.`,
  expirada: "Tu sesión expiró por seguridad. Inicia sesión de nuevo para continuar.",
};

let ultimaEscritura = 0;

/** Anota que hubo actividad. Escribe como mucho cada 5 s: se llama en cada evento. */
export function registrarActividad(forzar = false) {
  const ahora = Date.now();
  if (!forzar && ahora - ultimaEscritura < 5000) return;
  ultimaEscritura = ahora;
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora));
  } catch {
    /* sin almacenamiento: solo cuenta la pestaña actual */
  }
}

/** ¿Pasó el límite desde la última actividad? Sin registro previo, no. */
export function inactividadVencida(): boolean {
  try {
    const ultima = Number(localStorage.getItem(CLAVE_ACTIVIDAD));
    return Boolean(ultima) && Date.now() - ultima > LIMITE_MS;
  } catch {
    return false;
  }
}

/** Deja dicho por qué se cerró, para que la pantalla de acceso lo explique. */
export function anotarMotivoCierre(motivo: MotivoCierre) {
  try {
    sessionStorage.setItem(CLAVE_MOTIVO, motivo);
    localStorage.removeItem(CLAVE_ACTIVIDAD);
  } catch {
    /* nada que hacer */
  }
}

/** Lee y borra el motivo: el aviso sale una sola vez. */
export function tomarMotivoCierre(): MotivoCierre | null {
  try {
    const motivo = sessionStorage.getItem(CLAVE_MOTIVO) as MotivoCierre | null;
    sessionStorage.removeItem(CLAVE_MOTIVO);
    return motivo && motivo in MENSAJES_CIERRE ? motivo : null;
  } catch {
    return null;
  }
}

const EVENTOS: (keyof WindowEventMap)[] = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];

/**
 * Vigila la actividad y llama a `alVencer` cuando pasa el límite. Devuelve la
 * función que deja de vigilar.
 */
export function vigilarInactividad(alVencer: () => void): () => void {
  let vencida = false;
  const revisar = () => {
    if (vencida || !inactividadVencida()) return false;
    vencida = true;
    alVencer();
    return true;
  };
  // El primer clic al volver tras la media hora no revive la sesión: cierra.
  const alActuar = () => {
    if (!revisar()) registrarActividad();
  };
  if (!revisar()) registrarActividad(true);
  // Al volver a la pestaña (o despertar el equipo) se revisa en el acto, sin
  // esperar al siguiente intervalo; la revisión va ANTES de anotar actividad.
  const alVolver = () => {
    if (document.visibilityState === "visible") revisar();
  };

  for (const evento of EVENTOS) window.addEventListener(evento, alActuar, { passive: true, capture: true });
  document.addEventListener("visibilitychange", alVolver);
  const intervalo = window.setInterval(revisar, 15_000);

  return () => {
    for (const evento of EVENTOS) window.removeEventListener(evento, alActuar, { capture: true });
    document.removeEventListener("visibilitychange", alVolver);
    window.clearInterval(intervalo);
  };
}
