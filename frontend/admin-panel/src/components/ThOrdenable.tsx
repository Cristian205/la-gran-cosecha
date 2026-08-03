import { ChevronDown, ChevronUp, ChevronsUpDown, GripVertical } from "lucide-react";
import { useState } from "react";
import type { DireccionOrden } from "../hooks/useOrdenTabla";

interface Props {
  clave: string;
  etiqueta: string;
  columnaActiva: string | null;
  direccion: DireccionOrden;
  onClick: (clave: string) => void;
  onMover: (claveOrigen: string, claveDestino: string) => void;
}

export function ThOrdenable({ clave, etiqueta, columnaActiva, direccion, onClick, onMover }: Props) {
  const activa = columnaActiva === clave;
  const [arrastrando, setArrastrando] = useState(false);
  const [sobrevolando, setSobrevolando] = useState(false);

  return (
    <th
      className={`th-ordenable ${arrastrando ? "arrastrando" : ""} ${sobrevolando ? "sobrevolando" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", clave);
        e.dataTransfer.effectAllowed = "move";
        setArrastrando(true);
      }}
      onDragEnd={() => setArrastrando(false)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setSobrevolando(true)}
      onDragLeave={() => setSobrevolando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobrevolando(false);
        const origen = e.dataTransfer.getData("text/plain");
        if (origen && origen !== clave) onMover(origen, clave);
      }}
      onClick={() => onClick(clave)}
    >
      <span>
        <GripVertical size={12} className="th-orden-agarre" />
        {etiqueta}
        {activa ? (
          direccion === "asc" ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )
        ) : (
          <ChevronsUpDown size={13} className="th-orden-inactivo" />
        )}
      </span>
    </th>
  );
}
