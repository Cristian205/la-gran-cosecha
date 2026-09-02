import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * El testigo de la vista de plantilla, de la URL a las páginas.
 *
 * Existe por una limitación real: el enlace de prueba lleva `?vista=<testigo>`,
 * pero el `layout.tsx` —que es quien pinta la cabecera, el pie y el tema— no
 * recibe los parámetros de la URL. Sin esto, la previa cambiaría el cuerpo de
 * la página y dejaría el armazón y los colores del negocio, que es justo la
 * mezcla que no deja juzgar una plantilla.
 *
 * Así que el testigo se copia a una CABECERA de la petición, que sí llega a
 * todo lo que se renderiza, y a una cookie de sesión, para que al pulsar un
 * enlace dentro de la previa no se vuelva a la tienda normal a mitad de
 * recorrido.
 *
 * `vista=0` la apaga: es la salida, y hace falta porque la cookie sobrevive a
 * quitar el parámetro de la barra de direcciones.
 *
 * En Next 16 este archivo se llama `proxy.ts`; `middleware.ts` está obsoleto.
 */
const PARAMETRO = "vista";
const CABECERA = "x-crynex-vista";
const COOKIE = "crynex_vista";

export function proxy(request: NextRequest) {
  const enLaUrl = request.nextUrl.searchParams.get(PARAMETRO);
  const enLaCookie = request.cookies.get(COOKIE)?.value ?? "";

  // Explícitamente apagada.
  if (enLaUrl === "0" || enLaUrl === "") {
    const salida = NextResponse.next();
    salida.cookies.delete(COOKIE);
    return salida;
  }

  const testigo = enLaUrl || enLaCookie;
  if (!testigo) return NextResponse.next();

  const cabeceras = new Headers(request.headers);
  cabeceras.set(CABECERA, testigo);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });

  if (enLaUrl) {
    // De sesión y no persistente: una previa es para mirarla ahora. Una cookie
    // con fecha dejaría a alguien viendo la maqueta equivocada dentro de un mes
    // sin recordar por qué.
    respuesta.cookies.set(COOKIE, enLaUrl, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return respuesta;
}

export const config = {
  // Todo menos los archivos: las imágenes y el JS no necesitan saber nada de
  // esto, y hacerlos pasar por aquí solo añadiría trabajo a cada petición.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
