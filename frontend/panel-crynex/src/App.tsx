import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { sesion } from "./api/cliente";
import { ProveedorPlataforma } from "./datos/plataforma";
import { ProveedorNotificaciones } from "./ui/Notificaciones";
import { Lateral } from "./componentes/Lateral";
import { Cabecera } from "./componentes/Cabecera";
import { Acceso } from "./paginas/Acceso";
import { Empresa } from "./paginas/Empresa";
import { Matriz } from "./paginas/Matriz";
import { Negocios } from "./paginas/Negocios";
import { Planes } from "./paginas/Planes";
import { Plantillas } from "./paginas/Plantillas";
import { Resumen } from "./paginas/Resumen";
import { Suscripciones } from "./paginas/Suscripciones";

export default function App() {
  const [autenticado, setAutenticado] = useState(Boolean(sesion.acceso()));

  if (!autenticado) return <Acceso alEntrar={() => setAutenticado(true)} />;

  function salir() {
    sesion.cerrar();
    setAutenticado(false);
  }

  return (
    <ProveedorNotificaciones>
      <ProveedorPlataforma>
        <div className="marco">
          <Lateral />
          <div className="marco__principal">
            <Cabecera alSalir={salir} />
            <main className="contenido">
              <Routes>
                <Route path="/" element={<Resumen />} />
                <Route path="/empresas" element={<Negocios />} />
                {/* Dos rutas y no un parámetro opcional: las pestañas son parte
                    de la dirección, y así un aviso puede enlazar directo a la
                    suscripción de un cliente. */}
                <Route path="/empresas/:id" element={<Empresa />} />
                <Route path="/empresas/:id/:pestana" element={<Empresa />} />
                <Route path="/planes" element={<Planes />} />
                <Route path="/permisos" element={<Matriz />} />
                <Route path="/plantillas" element={<Plantillas />} />
                <Route path="/suscripciones" element={<Suscripciones />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </ProveedorPlataforma>
    </ProveedorNotificaciones>
  );
}
