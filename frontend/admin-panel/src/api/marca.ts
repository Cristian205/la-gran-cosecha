import axios from "axios";

/**
 * La identidad del negocio al que pertenece esta dirección.
 *
 * El login es la única pantalla que se pinta sin sesión, así que no puede
 * preguntar por el negocio activo: lo resuelve el backend por el host de la
 * petición, igual que hace la tienda pública. `site-config` y `banners` son de
 * lectura abierta justo para eso.
 *
 * Importa que salga de aquí y no de una constante: este panel lo usan todas
 * las empresas de Crynex. Con el logo escrito en el código, Perfumería Luna
 * entraría a su panel bajo la marca de otro cliente.
 */
const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export interface MarcaNegocio {
  nombre: string;
  logo: string | null;
  /** El color de la empresa; tiñe acentos y botones del acceso. */
  color: string;
  /** Una imagen suya para el panel lateral. */
  fondo: string | null;
}

const POR_DEFECTO: MarcaNegocio = {
  nombre: "",
  logo: null,
  color: "#16a34a",
  fondo: null,
};

/** Un color solo se acepta si es hexadecimal: va directo a una variable CSS. */
function colorValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^#[0-9a-f]{6}$/i.test(valor);
}

export async function cargarMarca(): Promise<MarcaNegocio> {
  // Las dos peticiones van sin token a propósito: el interceptor de `api`
  // añadiría el de una sesión anterior y un 401 dispararía un refresco inútil
  // en mitad de la pantalla de entrada.
  const [config, banners] = await Promise.allSettled([
    axios.get(`${baseURL}/content/site-config/`),
    axios.get(`${baseURL}/content/banners/`),
  ]);

  const marca = { ...POR_DEFECTO };

  if (config.status === "fulfilled") {
    const d = config.value.data ?? {};
    if (typeof d.nombre_empresa === "string") marca.nombre = d.nombre_empresa;
    if (typeof d.logo_url === "string" && d.logo_url) marca.logo = d.logo_url;
    if (colorValido(d.color_primario)) marca.color = d.color_primario;
  }

  if (banners.status === "fulfilled" && Array.isArray(banners.value.data)) {
    const primero = banners.value.data.find(
      (b: { imagen_url?: string }) => typeof b.imagen_url === "string" && b.imagen_url
    );
    if (primero) marca.fondo = primero.imagen_url;
  }

  return marca;
}
