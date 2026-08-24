import { Info } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

/**
 * Los precios del catálogo dependen del mercado del día, así que en la tienda
 * son una referencia, no un valor cerrado. El texto vive en un solo sitio para
 * que la tienda, el carrito y el checkout digan exactamente lo mismo.
 */
export const TEXTO_PRECIOS_ESTIMADOS =
  "Los precios son estimados y pueden variar según el mercado del día. " +
  "Confirmamos el valor final antes de despachar tu pedido.";

const TEXTO_COMPACTO = "Precios estimados: pueden variar según el mercado del día.";

const DETALLE_HOJA = [
  "Trabajamos con productos frescos, cuyo precio de plaza cambia de un día a otro.",
  "Por eso el valor que ves en la tienda es una referencia del día y puede subir o bajar un poco.",
  "Antes de despachar tu pedido confirmamos contigo el valor final. Nunca cobramos algo distinto sin avisarte.",
];

interface Props {
  /** Nota discreta junto a un total (carrito, checkout) en vez de banda. */
  compacto?: boolean;
}

export function AvisoPrecios({ compacto = false }: Props) {
  const [hojaAbierta, setHojaAbierta] = useState(false);

  if (compacto) {
    return (
      <p className="aviso-precios compacto">
        <Info size={13} />
        <span>{TEXTO_COMPACTO}</span>
      </p>
    );
  }

  return (
    <>
      <div className="aviso-precios">
        <Info size={16} />
        {/* En móvil la banda completa se comía cuatro líneas por encima del
            primer producto: ahí se resume y el detalle pasa a una hoja. */}
        <span className="aviso-precios-largo">{TEXTO_PRECIOS_ESTIMADOS}</span>
        <span className="aviso-precios-corto">
          Precios estimados según el mercado del día.
        </span>
        <button
          type="button"
          className="aviso-precios-mas"
          onClick={() => setHojaAbierta(true)}
          aria-haspopup="dialog"
        >
          ¿Por qué?
        </button>
      </div>

      {hojaAbierta && (
        <BottomSheet
          titulo="¿Por qué puede variar el precio?"
          onCerrar={() => setHojaAbierta(false)}
        >
          {DETALLE_HOJA.map((parrafo) => (
            <p key={parrafo} className="hoja-parrafo">
              {parrafo}
            </p>
          ))}
        </BottomSheet>
      )}
    </>
  );
}
