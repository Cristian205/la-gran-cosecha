import { negocioDeLaPeticion } from "./negocio";

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

export async function pedirAlBackend<T>(
  ruta: string,
  opciones: { params?: Record<string, unknown>; revalidar?: number } = {}
): Promise<T | null> {
  const { slug, host } = await negocioDeLaPeticion();

  const url = new URL(API.replace(/\/$/, "") + ruta);
  for (const [clave, valor] of Object.entries(opciones.params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(clave, String(valor));
    }
  }

  const cabeceras: Record<string, string> = {
    Accept: "application/json",
    ...cabecerasDelNegocio(slug, host),
  };

  const respuesta = await fetch(url, {
    headers: cabeceras,
    next: { revalidate: opciones.revalidar ?? REVALIDAR },
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

  const respuesta = await fetch(API.replace(/\/$/, "") + ruta, {
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
