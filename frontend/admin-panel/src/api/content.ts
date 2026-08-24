import type {
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
  logo?: File | null
): Promise<SiteConfig> {
  const form = new FormData();
  Object.entries(cambios).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  if (logo) form.append("logo", logo);

  const { data } = await api.patch<SiteConfig>("/content/site-config/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ---------- Banners ----------
export async function obtenerBanners(): Promise<PromoBanner[]> {
  const { data } = await api.get<Paginated<PromoBanner>>("/content/banners/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearBanner(
  payload: Omit<PromoBanner, "id" | "imagen_url">,
  imagen?: File | null
): Promise<PromoBanner> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => form.append(key, String(value)));
  if (imagen) form.append("imagen", imagen);
  const { data } = await api.post<PromoBanner>("/content/banners/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function actualizarBanner(
  id: number,
  payload: Omit<PromoBanner, "id" | "imagen_url">,
  imagen?: File | null
): Promise<PromoBanner> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => form.append(key, String(value)));
  if (imagen) form.append("imagen", imagen);
  const { data } = await api.patch<PromoBanner>(`/content/banners/${id}/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function eliminarBanner(id: number): Promise<void> {
  await api.delete(`/content/banners/${id}/`);
}

// ---------- Testimonios ----------
export async function obtenerTestimonios(): Promise<Testimonio[]> {
  const { data } = await api.get<Paginated<Testimonio>>("/content/testimonials/", {
    params: { page_size: 100 },
  });
  return unwrap(data);
}

export async function crearTestimonio(payload: Omit<Testimonio, "id">): Promise<Testimonio> {
  const { data } = await api.post<Testimonio>("/content/testimonials/", payload);
  return data;
}

export async function actualizarTestimonio(
  id: number,
  payload: Omit<Testimonio, "id">
): Promise<Testimonio> {
  const { data } = await api.patch<Testimonio>(`/content/testimonials/${id}/`, payload);
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
  payload: Omit<BeneficioComercial, "id">
): Promise<BeneficioComercial> {
  const { data } = await api.post<BeneficioComercial>("/content/beneficios/", payload);
  return data;
}

export async function actualizarBeneficio(
  id: number,
  payload: Omit<BeneficioComercial, "id">
): Promise<BeneficioComercial> {
  const { data } = await api.patch<BeneficioComercial>(`/content/beneficios/${id}/`, payload);
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
