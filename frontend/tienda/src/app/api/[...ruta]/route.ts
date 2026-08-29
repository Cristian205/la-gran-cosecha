import { NextRequest, NextResponse } from "next/server";
import { negocioDeLaPeticion } from "@/lib/negocio";

/**
 * El puente entre el navegador y Django.
 *
 * El navegador llama a `/api/...` del propio dominio de la tienda y esta ruta
 * lo reenvía al backend añadiendo la cabecera del negocio y la clave del
 * servidor. Existe por una razón concreta: la clave NO puede salir al
 * navegador —cualquiera podría entonces pedir el catálogo de cualquier
 * negocio— y sin ella Django no sabría de qué tienda se trata, porque la
 * llamada sale del servidor de Next y no del dominio del visitante.
 *
 * De paso evita el CORS: para el navegador todo es el mismo origen.
 */
const API = process.env.API_URL ?? "http://localhost:8000/api";
const CLAVE = process.env.TENANCY_CLAVE_SERVIDOR ?? "";

// Lo que el visitante puede alcanzar. Es una lista blanca a propósito: sin
// ella, este puente expondría toda la API de administración a través del
// dominio público de la tienda.
const PERMITIDAS = [
  /^\/catalog\/(products|categories|units)\/$/,
  /^\/content\/(site-config|banners|testimonials|trust-badges|beneficios|ofertas)\/$/,
  /^\/orders\/productos-mas-vendidos\/$/,
];
const ESCRITURAS = [/^\/orders\/$/, /^\/contact\/messages\/$/];

function permitida(ruta: string, metodo: string): boolean {
  const lista = metodo === "POST" ? ESCRITURAS : PERMITIDAS;
  return lista.some((patron) => patron.test(ruta));
}

async function reenviar(peticion: NextRequest, partes: string[]) {
  const ruta = "/" + partes.join("/") + "/";

  if (!permitida(ruta, peticion.method)) {
    return NextResponse.json({ detail: "No disponible." }, { status: 404 });
  }

  const { slug, host } = await negocioDeLaPeticion();
  const destino = new URL(API.replace(/\/$/, "") + ruta);
  peticion.nextUrl.searchParams.forEach((v, k) => destino.searchParams.set(k, v));

  const cabeceras: Record<string, string> = { Accept: "application/json" };
  if (CLAVE) {
    cabeceras["X-Tenant-Key"] = CLAVE;
    if (slug) cabeceras["X-Tenant"] = slug;
    else cabeceras["X-Tenant-Host"] = host;
  }
  if (peticion.method === "POST") cabeceras["Content-Type"] = "application/json";

  const respuesta = await fetch(destino, {
    method: peticion.method,
    headers: cabeceras,
    body: peticion.method === "POST" ? await peticion.text() : undefined,
    cache: "no-store",
  });

  const cuerpo = await respuesta.text();
  return new NextResponse(cuerpo, {
    status: respuesta.status,
    headers: { "Content-Type": respuesta.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(
  peticion: NextRequest,
  { params }: { params: Promise<{ ruta: string[] }> }
) {
  return reenviar(peticion, (await params).ruta);
}

export async function POST(
  peticion: NextRequest,
  { params }: { params: Promise<{ ruta: string[] }> }
) {
  return reenviar(peticion, (await params).ruta);
}
