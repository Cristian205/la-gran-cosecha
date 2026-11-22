import { ImageResponse } from "next/og";
import { configuracionDeLaTienda } from "@/lib/negocio";
import { colorDeMarca, esHexValido } from "@/lib/tema";

/**
 * El ícono de la app instalada, hecho con el logo del negocio.
 *
 * Los navegadores exigen íconos PNG cuadrados de 192 y 512 px para dejar
 * instalar la tienda, y el logo que sube cada negocio no tiene por qué cumplir
 * nada de eso (puede ser apaisado, pequeño o de cualquier formato). Aquí se
 * centra sobre un cuadrado de fondo liso con el tamaño exacto pedido.
 *
 * `?maskable=1` deja más margen: Android recorta el ícono en círculo o en
 * «squircle», y solo el 80 % central está garantizado a la vista.
 *
 * Si no hay logo o no se puede leer, sale la inicial del negocio sobre su
 * color de marca: siempre hay un ícono propio, nunca uno genérico.
 */
const TAMANOS = new Set([180, 192, 512]);

async function logoComoDato(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const respuesta = await fetch(url, { next: { revalidate: 86400 } });
    if (!respuesta.ok) return null;
    const tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
    const bytes = Buffer.from(await respuesta.arrayBuffer());
    if (tipo === "image/png" || tipo === "image/jpeg") {
      return `data:${tipo};base64,${bytes.toString("base64")}`;
    }
    // El generador solo dibuja PNG y JPEG, y los logos suelen subirse en WebP
    // (o SVG/AVIF). `sharp` —el mismo que usa Next para optimizar imágenes—
    // los pasa a PNG.
    const { default: sharp } = await import("sharp");
    const png = await sharp(bytes).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tamano: string }> }
) {
  const pedido = Number((await params).tamano);
  const lado = TAMANOS.has(pedido) ? pedido : 512;
  const maskable = new URL(request.url).searchParams.has("maskable");

  const config = await configuracionDeLaTienda();
  const logo = await logoComoDato(config?.logo_url);
  const marca = colorDeMarca(config);
  const textoMarca = esHexValido(config?.color_primario_texto)
    ? config.color_primario_texto
    : "#ffffff";
  const inicial = (config?.nombre_empresa?.trim()[0] ?? "T").toUpperCase();

  // Proporción del lado que ocupa el logo dentro del cuadrado.
  const proporcion = maskable ? 0.72 : 0.94;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: logo ? "#ffffff" : marca,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            style={{
              width: lado * proporcion,
              height: lado * proporcion,
              objectFit: "contain",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              color: textoMarca,
              fontSize: lado * proporcion * 0.7,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {inicial}
          </div>
        )}
      </div>
    ),
    {
      width: lado,
      height: lado,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    }
  );
}
