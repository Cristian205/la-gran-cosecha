import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { sesion } from "./api/cliente";
import { ProveedorPlataforma } from "./datos/plataforma";
import { ProveedorSalud } from "./datos/salud";
import { ProveedorMarca } from "./marca/ProveedorMarca";
import { ProveedorNotificaciones } from "./ui/Notificaciones";
import { PistaFlotante } from "./ui/PistaFlotante";
import { Lateral } from "./componentes/Lateral";
import { Cabecera } from "./componentes/Cabecera";
import { Acceso } from "./paginas/Acceso";
import { Actividad } from "./paginas/Actividad";
import { Ajustes } from "./paginas/Ajustes";
import { Auditoria } from "./paginas/Auditoria";
import { Automatizaciones } from "./paginas/Automatizaciones";
import { DesignSystem } from "./paginas/DesignSystem";
import { Empresa } from "./paginas/Empresa";
import { Identidad } from "./paginas/Identidad";
import { Integraciones } from "./paginas/Integraciones";
import { Matriz } from "./paginas/Matriz";
import { Negocios } from "./paginas/Negocios";
import { Planes } from "./paginas/Planes";
import { Plantillas } from "./paginas/Plantillas";
import { Presets } from "./paginas/Presets";
import { Productos } from "./paginas/Productos";
import { Resumen } from "./paginas/Resumen";
import { Suscripciones } from "./paginas/Suscripciones";
import { Usuarios } from "./paginas/Usuarios";
import { WhiteLabel } from "./paginas/WhiteLabel";

export default function App() {
  const [autenticado, setAutenticado] = useState(Boolean(sesion.acceso()));

  return (
    // La marca envuelve también el acceso: la pantalla de entrada ya se ve
    // con la marca publicada.
    <ProveedorMarca>
      {autenticado ? (
        <ProveedorNotificaciones>
          <ProveedorPlataforma>
            <ProveedorSalud>
              <Panel
                alSalir={() => {
                  sesion.cerrar();
                  setAutenticado(false);
                }}
              />
            </ProveedorSalud>
          </ProveedorPlataforma>
        </ProveedorNotificaciones>
      ) : (
        <Acceso alEntrar={() => setAutenticado(true)} />
      )}
    </ProveedorMarca>
  );
}

/** El AppShell: navegación, cabecera y la página que toque. */
function Panel({ alSalir }: { alSalir: () => void }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
  const { pathname } = useLocation();

  return (
    <div className="marco">
      <Lateral abierto={menuAbierto} onCerrar={cerrarMenu} />
      <PistaFlotante />
      <div className="marco__principal">
        <Cabecera alSalir={alSalir} alAbrirMenu={() => setMenuAbierto(true)} />
        <main className="contenido">
          {/* La clave por sección hace que cada cambio de página entre con la
              misma transición corta; las pestañas de una empresa no la repiten. */}
          <div className="pagina" key={pathname.split("/").slice(0, 3).join("/")}>
            <Routes>
              <Route path="/" element={<Resumen />} />
              <Route path="/actividad" element={<Actividad />} />
              <Route path="/empresas" element={<Negocios />} />
              {/* Dos rutas y no un parámetro opcional: las pestañas son parte
                  de la dirección, y así un aviso puede enlazar directo a la
                  suscripción de un cliente. */}
              <Route path="/empresas/:id" element={<Empresa />} />
              <Route path="/empresas/:id/:pestana" element={<Empresa />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/suscripciones" element={<Suscripciones />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/planes" element={<Planes />} />
              <Route path="/plantillas" element={<Plantillas />} />
              <Route path="/presets" element={<Presets />} />
              <Route path="/permisos" element={<Matriz />} />
              <Route path="/integraciones" element={<Integraciones />} />
              <Route path="/automatizaciones" element={<Automatizaciones />} />
              <Route path="/marca" element={<Navigate to="/marca/identidad" replace />} />
              <Route path="/marca/identidad" element={<Identidad />} />
              <Route path="/marca/design-system" element={<DesignSystem />} />
              <Route path="/marca/white-label" element={<WhiteLabel />} />
              <Route path="/ajustes" element={<Ajustes alSalir={alSalir} />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
