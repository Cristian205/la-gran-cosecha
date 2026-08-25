import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Panel administrativo — puerto 5174
export default defineConfig({
  plugins: [react()],
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
