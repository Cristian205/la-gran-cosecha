/*
 * Service worker de la app instalable.
 *
 * A propósito NO guarda el catálogo ni la API: precios, existencias y pedidos
 * tienen que salir siempre frescos del servidor, y una copia vieja vendería a
 * un precio que ya no es. Todo va a la red como si no existiera.
 *
 * Lo único que añade es una página de «sin conexión» cuando el cliente abre la
 * app sin internet, en vez de la pantalla de error del navegador.
 */
const PAGINA_SIN_CONEXION = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6faf7;color:#0b1f17;text-align:center;padding:24px;box-sizing:border-box}
  h1{font-size:1.3rem;margin:0 0 .5rem}
  p{color:#52606d;margin:0 0 1.5rem;max-width:320px}
  button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:.8rem 1.6rem;background:#16a34a;color:#fff;cursor:pointer}
</style></head>
<body><main>
  <h1>Sin conexión a internet</h1>
  <p>Revisa tu conexión y vuelve a intentarlo. Tu carrito sigue guardado.</p>
  <button onclick="location.reload()">Reintentar</button>
</main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (evento) => {
  // Solo las navegaciones (abrir una página). El resto ni se toca.
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(
      () =>
        new Response(PAGINA_SIN_CONEXION, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    )
  );
});
