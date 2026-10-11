import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ProveedorContenido } from "./contenido/usarContenido";
import "./estilos/base.css";
import "./estilos/maqueta.css";
import "./estilos/secciones.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProveedorContenido>
      <App />
    </ProveedorContenido>
  </React.StrictMode>
);
