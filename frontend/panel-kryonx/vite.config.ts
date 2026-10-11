import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Panel de la plataforma. Puerto propio: convive con el panel de negocio
// (5174) y la tienda (5175) durante el desarrollo.
export default defineConfig({
  plugins: [react()],
  // `@constructor` es el codigo que este panel comparte con el otro: los tipos
  // de una composicion y las operaciones que la mueven. Es un directorio de
  // TypeScript, no un paquete: ver `frontend/constructor/README.md`.
  resolve: {
    alias: {
      "@constructor": fileURLToPath(new URL("../constructor/src", import.meta.url)),
    },
  },
  // `/healthz` vive en la raíz del backend; el Control Center lo usa para la
  // salud del sistema.
  server: {
    port: 5176,
    proxy: { "/api": "http://localhost:8000", "/healthz": "http://localhost:8000" },
  },
});
