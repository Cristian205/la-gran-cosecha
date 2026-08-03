import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerArchivos } from "../api/media";
import type { Archivo } from "../types";
import { ArchivosGrid } from "./ArchivosGrid";
import { Modal } from "./Modal";

interface Props {
  onCerrar: () => void;
  onSeleccionar: (archivo: Archivo) => void;
}

export function MediaPickerModal({ onCerrar, onSeleccionar }: Props) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setCargando(true);
    const t = setTimeout(() => {
      obtenerArchivos({ tipo: "IMAGEN", search: busqueda || undefined })
        .then(setArchivos)
        .finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  return (
    <Modal ancho titulo="Elegir de la biblioteca" onCerrar={onCerrar}>
      <div className="buscador" style={{ marginBottom: "1rem" }}>
        <Search size={16} />
        <input
          placeholder="Buscar por nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoFocus
        />
      </div>
      <ArchivosGrid archivos={archivos} cargando={cargando} onClicTarjeta={onSeleccionar} />
    </Modal>
  );
}
