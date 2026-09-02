import { negocioDeLaPeticion, testigoDeVista } from "./negocio";

/**
 * Cliente de la API para el SERVIDOR.
 *
 * Todas las lecturas del catálogo pasan por aquí y se resuelven en el
 * servidor, no en el navegador. Es lo que hace posible el SEO por negocio: un
 * rastreador recibe el HTML con los productos dentro, no un contenedor vacío
 * que se llena después.
 *
 * Cómo sabe el backend de qué negocio se trata: este servidor atiende todas
 * las tiendas y llama a Django desde su propio host, así que el `Host` no lo
 * identifica. Se declara con `X-Tenant` y se acredita con `X-Tenant-Key`, una
 * clave compartida que distingue esta llamada de servidor a servidor de
 * cualquiera hecha desde un navegador.
 *
 * `TENANCY_CLAVE_SERVIDOR` NO lleva el prefijo `NEXT_PUBLIC_`: eso la
 * incrustaría en el paquete que descarga el navegador, y entonces cualquiera
 * podría pedirle a Django el catálogo de cualquier negocio.
 */
const API = process.env.API_URL ?? "http://localhost:8000/api";
const CLAVE = process.env.TENANCY_CLAVE_SERVIDOR ?? "";

/**
 * La base de la API, comprobada.
 *
 * Existe porque los dos fallos de configuración más probables daban el MISMO
 * error mudo: «This page couldn't load», un 500 sin una palabra sobre la causa.
 *
 *   1. `API_URL` sin definir. Cae al valor de desarrollo, `localhost:8000`, que
 *      en un servidor de Vercel no es nadie: el `fetch` lanza.
 *   2. `API_URL` sin esquema —`mi-backend.onrender.com/api`—. `new URL()` la
 *      rechaza y lanza antes de salir a la red.
 *
 * Los dos son un despiste de un minuto que cuesta una tarde de diagnóstico,
 * porque el síntoma aparece en la tienda y la causa está en un panel de
 * ajustes. Decirlo con nombre y apellidos sale en los registros y ahorra la
 * cacería.
 */
function baseDeLaApi(): string {
  const base = API.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      `API_URL tiene que empezar por http:// o https://, y está puesta como ` +
        `«${base}». Es una URL absoluta al backend, terminada en /api y sin ` +
        `barra final.`
    );
  }
  return base;
}

/** Cuánto se cachea una respuesta del catálogo, en segundos. */
const REVALIDAR = Number(process.env.REVALIDAR_SEGUNDOS ?? 60);

/**
 * Cómo se le dice al backend de qué negocio se trata.
 *
 * Por slug si el visitante entró por un subdominio de la plataforma; por
 * hostname si entró por el dominio propio del negocio, donde no hay slug que
 * enviar y el backend lo resuelve contra su tabla `Domain`. Las dos van
 * acreditadas con la clave: sin ella el backend las ignora.
 */
function cabecerasDelNegocio(slug: string | null, host: string): Record<string, string> {
  if (!CLAVE) return {};
  return slug
    ? { "X-Tenant": slug, "X-Tenant-Key": CLAVE }
    : { "X-Tenant-Host": host, "X-Tenant-Key": CLAVE };
}

export class RespuestaSinNegocio extends Error {
  constructor() {
    super("Esta dirección no corresponde a ninguna tienda.");
  }
}

/**
 * `fetch`, pero con el fallo de red contado.
 *
 * Un backend caido o una URL equivocada hacen que `fetch` lance un
 * `TypeError: fetch failed` sin decir a donde intento ir. En un servidor que
 * atiende cuarenta tiendas eso es un 500 en blanco; con el origen dentro, el
 * registro dice en una linea que hay que mirar.
 */
async function pedir(url: URL, opciones: RequestInit): Promise<Response> {
  try {
    return await fetch(url, opciones);
  } catch (causa) {
    throw new Error(
      `No se pudo hablar con el backend en ${url.origin}. Comprueba que este ` +
        `desplegado y que API_URL apunte a el. (${(causa as Error).message})`,
      { cause: causa }
    );
  }
}

export async function pedirAlBackend<T>(
  ruta: string,
  opciones: { params?: Record<string, unknown>; revalidar?: number } = {}
): Promise<T | null> {
  const { slug, host } = await negocioDeLaPeticion();

  const url = new URL(baseDeLaApi() + ruta);
  for (const [clave, valor] of Object.entries(opciones.params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(clave, String(valor));
    }
  }

  const testigo = await testigoDeVista();
  const cabeceras: Record<string, string> = {
    Accept: "application/json",
    ...cabecerasDelNegocio(slug, host),
    // La vista de plantilla viaja en cabecera y no en la URL: si fuera un
    // parametro mas, la respuesta se guardaria en la cache compartida y el
    // siguiente visitante normal recibiria la previa de otro.
    ...(testigo ? { "X-Crynex-Vista": testigo } : {}),
  };

  const respuesta = await pedir(url, {
    headers: cabeceras,
    // Una previa NO se cachea. Es de un momento y de una persona, y guardarla
    // acabaria sirviendola a quien entre por la puerta normal.
    ...(testigo
      ? { cache: "no-store" as const }
      : { next: { revalidate: opciones.revalidar ?? REVALIDAR } }),
  });

  // 404 es la respuesta normal a un host que no es de ningún negocio; no es un
  // error que haya que registrar, es la ausencia de tienda.
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw new Error(`${ruta} respondió ${respuesta.status}`);
  }
  return (await respuesta.json()) as T;
}

/**
 * Envía un pedido. Va sin caché y por POST, así que no comparte camino con las
 * lecturas: un pedido nunca se sirve desde caché ni se reintenta solo.
 */
export async function enviarAlBackend<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const { slug, host } = await negocioDeLaPeticion();

  const cabeceras: Record<string, string> = {
    "Content-Type": "application/json",
    ...cabecerasDelNegocio(slug, host),
  };

  const respuesta = await pedir(new URL(baseDeLaApi() + ruta), {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(`${ruta} respondió ${respuesta.status}`);
    Object.assign(error, { detalle: datos, estado: respuesta.status });
    throw error;
  }
  return datos as T;
}
