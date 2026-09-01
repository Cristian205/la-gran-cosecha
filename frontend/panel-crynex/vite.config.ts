import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Panel de la plataforma. Puerto propio: convive con el panel de negocio
// (5174) y la tienda (5175) durante el desarrollo.
export default defineConfig({
  plugins: [react()],
  server: { port: 5176, proxy: { "/api": "http://localhost:8000" } },
});
