import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Panel administrativo — puerto 5174
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
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
  build: {
    // exceljs, recharts y sweetalert2 son pesados y cambian poco: en chunks
    // aparte se cachean entre despliegues en vez de reenviarse enteros.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          alerts: ["sweetalert2"],
        },
      },
    },
  },
});
