import { Building2, LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { sesion } from "./api/cliente";
import { Acceso } from "./paginas/Acceso";
import { Matriz } from "./paginas/Matriz";
import { Negocios } from "./paginas/Negocios";
import { Resumen } from "./paginas/Resumen";

const SECCIONES = [
  { to: "/", etiqueta: "Resumen", icono: LayoutGrid, exacto: true },
  { to: "/planes", etiqueta: "Planes y permisos", icono: ShieldCheck },
  { to: "/empresas", etiqueta: "Empresas", icono: Building2 },
];

export default function App() {
  const [autenticado, setAutenticado] = useState(Boolean(sesion.acceso()));

  if (!autenticado) return <Acceso alEntrar={() => setAutenticado(true)} />;

  return (
    <div className="marco">
      <aside className="lateral">
        <span className="marca">Crynex</span>
        <nav>
          {SECCIONES.map(({ to, etiqueta, icono: Icono, exacto }) => (
            <NavLink key={to} to={to} end={exacto}>
              <Icono size={16} />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="salir"
          onClick={() => {
            sesion.cerrar();
            setAutenticado(false);
          }}
        >
          <LogOut size={15} /> Cerrar sesión
        </button>
      </aside>

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Resumen />} />
          <Route path="/planes" element={<Matriz />} />
          <Route path="/empresas" element={<Negocios />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
