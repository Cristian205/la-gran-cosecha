import type {
  Anuncio,
  BeneficioComercial,
  OfertaProducto,
  Paginated,
  PromoBanner,
  SiteConfig,
  Testimonio,
  TrustBadge,
} from "../types";
import { api } from "./client";

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

// ---------- Configuración del sitio ----------
export async function obtenerSiteConfig(): Promise<SiteConfig> {
  const { data } = await api.get<SiteConfig>("/content/site-config/");
  return data;
}

export async function actualizarSiteConfig(
  cambios: Partial<SiteConfig>,
  logo?: File | null,
  facturaLogo?: File | null
): Promise<SiteConfig> {
  const form = new FormData();
  Object.entries(cambios).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  if (logo) form.append("logo", logo);
  if (facturaLogo) form.append("factura_logo", facturaLogo);

  const { data } = await api.patch<SiteConfig>("/content/site-config/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Qué hacer con una imagen al guardar: `File` la sube o la reemplaza,
 * `"quitar"` la borra (el backend lee `quitar_<campo>`), `null`/ausente la
 * deja como está.
 */
export type CambioImagen = File | "quitar" | null | undefined;

/**
 * El cuerpo multipart de un contenido con imágenes. Los booleanos van SIEMPRE
 * explícitos: en multipart, DRF lee un booleano ausente como `false` (como
 * una casilla sin marcar), y un testimonio nuevo quedaría apagado.
 */
function formulario(payload: Record<string, unknown>, imagenes: Record<string, CambioImagen> = {}): FormData {
  const form = new FormData();
  Object.entries(payload).forEach(([clave, valor]) => {
    if (valor === undefined) return;
    form.append(clave, valor === null ? "" : String(valor));
  });
  Object.entries(imagenes).forEach(([campo, cambio]) => {
    if (cambio === "quitar") form.append(`quitar_${campo}`, "true");
    else if (cambio) form.append(campo, cambio);
  });
  return form;
}

const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

type SinLectura<T> = Omit<T, "id" | "imagen_url" | "imagen_movil_url" | "foto_url">;

// ---------- Banners ----------
export async function obtenerBanners(): Promise<PromoBanner[]> {
  const { data } = await api.get<Paginated<PromoBanner>>("/content/banners/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearBanner(
  payload: SinLectura<PromoBanner>,
  imagenes: { imagen?: CambioImagen; imagen_movil?: CambioImagen } = {}
): Promise<PromoBanner> {
  const { data } = await api.post<PromoBanner>("/content/banners/", formulario(payload, imagenes), MULTIPART);
  return data;
}

export async function actualizarBanner(
  id: number,
  payload: SinLectura<PromoBanner>,
  imagenes: { imagen?: CambioImagen; imagen_movil?: CambioImagen } = {}
): Promise<PromoBanner> {
  const { data } = await api.patch<PromoBanner>(`/content/banners/${id}/`, formulario(payload, imagenes), MULTIPART);
  return data;
}

export async function eliminarBanner(id: number): Promise<void> {
  await api.delete(`/content/banners/${id}/`);
}

// ---------- Anuncios (carrusel del cuerpo del Home) ----------
export async function obtenerAnuncios(): Promise<Anuncio[]> {
  const { data } = await api.get<Paginated<Anuncio>>("/content/anuncios/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearAnuncio(
  payload: SinLectura<Anuncio>,
  imagenes: { imagen?: CambioImagen; imagen_movil?: CambioImagen } = {}
): Promise<Anuncio> {
  const { data } = await api.post<Anuncio>("/content/anuncios/", formulario(payload, imagenes), MULTIPART);
  return data;
}

export async function actualizarAnuncio(
  id: number,
  payload: SinLectura<Anuncio>,
  imagenes: { imagen?: CambioImagen; imagen_movil?: CambioImagen } = {}
): Promise<Anuncio> {
  const { data } = await api.patch<Anuncio>(`/content/anuncios/${id}/`, formulario(payload, imagenes), MULTIPART);
  return data;
}

export async function eliminarAnuncio(id: number): Promise<void> {
  await api.delete(`/content/anuncios/${id}/`);
}

// ---------- Testimonios ----------
export async function obtenerTestimonios(): Promise<Testimonio[]> {
  const { data } = await api.get<Paginated<Testimonio>>("/content/testimonials/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearTestimonio(payload: SinLectura<Testimonio>, foto?: CambioImagen): Promise<Testimonio> {
  const { data } = await api.post<Testimonio>("/content/testimonials/", formulario(payload, { foto }), MULTIPART);
  return data;
}

export async function actualizarTestimonio(
  id: number,
  payload: SinLectura<Testimonio>,
  foto?: CambioImagen
): Promise<Testimonio> {
  const { data } = await api.patch<Testimonio>(`/content/testimonials/${id}/`, formulario(payload, { foto }), MULTIPART);
  return data;
}

export async function eliminarTestimonio(id: number): Promise<void> {
  await api.delete(`/content/testimonials/${id}/`);
}

// ---------- Sellos de confianza ----------
export async function obtenerTrustBadges(): Promise<TrustBadge[]> {
  const { data } = await api.get<Paginated<TrustBadge>>("/content/trust-badges/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearTrustBadge(payload: Omit<TrustBadge, "id">): Promise<TrustBadge> {
  const { data } = await api.post<TrustBadge>("/content/trust-badges/", payload);
  return data;
}

export async function actualizarTrustBadge(
  id: number,
  payload: Omit<TrustBadge, "id">
): Promise<TrustBadge> {
  const { data } = await api.patch<TrustBadge>(`/content/trust-badges/${id}/`, payload);
  return data;
}

export async function eliminarTrustBadge(id: number): Promise<void> {
  await api.delete(`/content/trust-badges/${id}/`);
}

// ---------- Beneficios comerciales ("¿Por qué comprar con nosotros?") ----------
export async function obtenerBeneficios(): Promise<BeneficioComercial[]> {
  const { data } = await api.get<Paginated<BeneficioComercial>>("/content/beneficios/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearBeneficio(
  payload: SinLectura<BeneficioComercial>,
  imagen?: CambioImagen
): Promise<BeneficioComercial> {
  const { data } = await api.post<BeneficioComercial>("/content/beneficios/", formulario(payload, { imagen }), MULTIPART);
  return data;
}

export async function actualizarBeneficio(
  id: number,
  payload: SinLectura<BeneficioComercial>,
  imagen?: CambioImagen
): Promise<BeneficioComercial> {
  const { data } = await api.patch<BeneficioComercial>(`/content/beneficios/${id}/`, formulario(payload, { imagen }), MULTIPART);
  return data;
}

export async function eliminarBeneficio(id: number): Promise<void> {
  await api.delete(`/content/beneficios/${id}/`);
}

// ---------- Ofertas de la semana ----------
export async function obtenerOfertas(): Promise<OfertaProducto[]> {
  const { data } = await api.get<Paginated<OfertaProducto>>("/content/ofertas/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearOferta(payload: {
  presentacion: number;
  precio_oferta: string;
  fecha_fin: string | null;
  activo: boolean;
}): Promise<OfertaProducto> {
  const { data } = await api.post<OfertaProducto>("/content/ofertas/", payload);
  return data;
}

export async function actualizarOferta(
  id: number,
  payload: { presentacion: number; precio_oferta: string; fecha_fin: string | null; activo: boolean }
): Promise<OfertaProducto> {
  const { data } = await api.patch<OfertaProducto>(`/content/ofertas/${id}/`, payload);
  return data;
}

export async function eliminarOferta(id: number): Promise<void> {
  await api.delete(`/content/ofertas/${id}/`);
}
