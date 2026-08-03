import { api } from "./client";
import type { Paginated, PromoBanner, SiteConfig, Testimonio, TrustBadge } from "../types";

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function obtenerSiteConfig(): Promise<SiteConfig> {
  const { data } = await api.get<SiteConfig>("/content/site-config/");
  return data;
}

export async function obtenerBanners(): Promise<PromoBanner[]> {
  const { data } = await api.get<Paginated<PromoBanner> | PromoBanner[]>("/content/banners/");
  return unwrap(data);
}

export async function obtenerTestimonios(): Promise<Testimonio[]> {
  const { data } = await api.get<Paginated<Testimonio> | Testimonio[]>("/content/testimonials/");
  return unwrap(data);
}

export async function obtenerTrustBadges(): Promise<TrustBadge[]> {
  const { data } = await api.get<Paginated<TrustBadge> | TrustBadge[]>("/content/trust-badges/");
  return unwrap(data);
}
