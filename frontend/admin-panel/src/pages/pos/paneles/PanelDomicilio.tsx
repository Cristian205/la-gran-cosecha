import { useEffect, useState } from "react";
import {
  crearEnvio,
  obtenerConfiguracion,
  obtenerZonas,
  type Zona,
} from "../../../api/domicilios";
import type { PanelDelPOS, PropsDePanel } from "./registro";

/**
 * Mandar esta venta a una dirección.
 *
 * Es el segundo panel del registro, y trabaja al revés que el primero. El de
 * reservas ELIGE algo que ya existe: la reserva se tomó ayer por teléfono y el
 * cajero la busca. Este CREA: el domicilio nace en el momento de timbrar, con
 * su dirección y su zona.
 *
 * Las dos formas caben en el mismo contrato sin ampliarlo —`aporte` viaja a
 * `Venta.contexto`, y `alAbrirVenta` hace la llamada propia del módulo—, y esa
 * es justamente la prueba que la fase 12 buscaba: que el mecanismo de paneles
 * aguantara un segundo módulo que trabaja distinto.
 *
 * El rótulo sale de la configuración del negocio: «Domiciliario», «Mensajero».
 * Poner «Repartidor» a la fuerza sería enseñarle al usuario la palabra del
 * programador.
 */
function Panel({ venta, aporte, onAporte }: PropsDePanel) {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [rotulo, setRotulo] = useState("Domicilio");
  const [exigeZona, setExigeZona] = useState(false);
  const [tarifaBase, setTarifaBase] = useState("0");

  useEffect(() => {
    void Promise.all([obtenerConfiguracion(), obtenerZonas()])
      .then(([config, lista]) => {
        setRotulo(`Domicilio · ${config.nombre_repartidor}`);
        setExigeZona(config.exige_zona);
        setTarifaBase(config.tarifa_base);
        setZonas(lista.filter((z) => z.activa));
      })
      .catch(() => setZonas([]));
  }, []);

  const congelado = Boolean(venta);
  const direccion = (aporte.direccion as string) ?? "";
  const zonaElegida = (aporte.zona_id as number) ?? "";

  function cambiar(campos: Record<string, unknown>) {
    onAporte({ ...aporte, ...campos });
  }

  // Ya se abrió la venta: lo que se eligió viajó con ella y cambiarlo ahora
  // mentiría sobre el histórico. Mismo criterio que el panel de reservas.
  if (congelado) {
    if (!direccion) return null;
    return (
      <div className="campo">
        <label>{rotulo}</label>
        <p className="campo-ayuda">
          {direccion}
          {aporte.zona_nombre ? ` · ${aporte.zona_nombre}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="campo">
      <label>{rotulo}</label>
      <input
        type="text"
        placeholder="Dirección"
        value={direccion}
        onChange={(e) => cambiar({ direccion: e.target.value })}
      />
      <input
        type="text"
        placeholder="Referencia (casa blanca, portón verde)"
        value={(aporte.referencia as string) ?? ""}
        onChange={(e) => cambiar({ referencia: e.target.value })}
      />
      <input
        type="text"
        placeholder="A nombre de"
        value={(aporte.nombre_contacto as string) ?? ""}
        onChange={(e) => cambiar({ nombre_contacto: e.target.value })}
      />
      <input
        type="text"
        placeholder="Teléfono"
        value={(aporte.telefono_contacto as string) ?? ""}
        onChange={(e) => cambiar({ telefono_contacto: e.target.value })}
      />
      <select
        value={zonaElegida}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          const zona = zonas.find((z) => z.id === id);
          cambiar({
            zona_id: zona?.id ?? null,
            // Copiado, no referenciado: dentro de dos años el histórico tiene
            // que seguir diciendo a qué zona fue y a qué precio, aunque el
            // negocio haya renombrado sus barrios o subido las tarifas.
            zona_nombre: zona?.nombre ?? "",
            tarifa: zona?.tarifa ?? tarifaBase,
          });
        }}
      >
        <option value="">{exigeZona ? "Elige la zona" : "Sin zona"}</option>
        {zonas.map((z) => (
          <option key={z.id} value={z.id}>
            {z.nombre} · {z.tarifa}
          </option>
        ))}
      </select>
      {exigeZona && !zonaElegida && (
        <small className="campo-ayuda">
          Este negocio solo reparte en sus zonas: hay que elegir una.
        </small>
      )}
    </div>
  );
}

export const PanelDomicilio: PanelDelPOS = {
  Componente: Panel,
  async alAbrirVenta(venta, aporte) {
    const direccion = (aporte.direccion as string) ?? "";
    if (!direccion.trim()) return;

    // El envío se crea DESPUÉS de la venta y colgando de ella, nunca al revés.
    // Esa dirección es la que permite que `apps.pos` no sepa que este módulo
    // existe: la caja solo guardó un diccionario que no interpreta.
    //
    // Si esto falla —fuera de cobertura, la red— la venta ya existe y se puede
    // cobrar igual; el domicilio se anota desde el tablero. Perder la venta por
    // no poder registrar la dirección sería mucho peor, y es el mismo criterio
    // que tomó el panel de reservas al enlazar la suya.
    try {
      await crearEnvio({
        venta_id: venta.id,
        direccion,
        zona_id: (aporte.zona_id as number) ?? null,
        nombre_contacto: (aporte.nombre_contacto as string) ?? "",
        telefono_contacto: (aporte.telefono_contacto as string) ?? "",
        referencia: (aporte.referencia as string) ?? "",
      });
    } catch {
      /* el tablero se queda sin el envío; la caja sigue */
    }
  },
};
