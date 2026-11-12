import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Sitio comercial de Crafteech. Puerto propio: convive con el panel de negocio
// (5174), la tienda (5175) y el panel de la plataforma (5176).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    // El formulario comercial llama a /api/contact/solicitudes-comerciales/.
    // En desarrollo se envía al backend local; en producción manda `VITE_API_URL`.
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        // Motion y Lenis cambian mucho menos que la página: en su propio
        // archivo, una edición de textos no invalida su caché.
        manualChunks: { animacion: ["motion/react", "lenis"] },
      },
    },
  },
});
