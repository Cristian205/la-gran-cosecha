/**
 * White Label: preparar, previsualizar y publicar marcas.
 *
 * Cada marca es un juego de tokens; publicarla viste el Control Center entero
 * con ella. Mientras el backend no tenga un modelo de marcas, se guardan en
 * este navegador y solo las ve quien las publica: la pantalla lo dice junto al
 * botón, para que nadie crea que un cliente ya está viendo su marca.
 */
import { useState } from "react";
import { Check, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { usarMarca } from "../marca/ProveedorMarca";
import { MARCA_KRYON } from "../marca/kryon";
import type { Marca } from "../marca/tipos";
import { Boton, Insignia, Tarjeta } from "../ui/basicos";
import { Confirmar } from "../ui/Modal";
import { usarAviso } from "../ui/Notificaciones";
import { EncabezadoPagina } from "../componentes/piezas";
import { EditorMarca, VistaPreviaMarca } from "../componentes/EditorMarca";
import { LogoMarca } from "../componentes/SelectorMarca";

function nuevaMarca(): Marca {
  return {
    id: `marca-${Date.now().toString(36)}`,
    nombre: "Nueva marca",
    lema: "Control Center",
    logo: null,
    favicon: null,
    colores: { primario: "#5b8cff", secundario: "#f5f5f5", acento: "#22c55e" },
    tipografia: "Inter",
    redondez: "media",
  };
}

export function WhiteLabel() {
  const { marcas, activa, guardar, eliminar, publicar } = usarMarca();
  const avisar = usarAviso();
  const [editando, setEditando] = useState<Marca | null>(null);
  const [borrando, setBorrando] = useState<Marca | null>(null);

  if (editando) {
    const existe = marcas.some((m) => m.id === editando.id);
    return (
      <>
        <EncabezadoPagina
          antetitulo="Marca · White Label"
          titulo={existe ? `Editar ${editando.nombre}` : "Nueva marca"}
          descripcion="Configura la marca y mírala en la vista previa antes de publicarla."
          acciones={
            <>
              <Boton onClick={() => setEditando(null)}>Cancelar</Boton>
              <Boton
                disabled={!editando.nombre.trim()}
                onClick={() => {
                  guardar(editando);
                  setEditando(null);
                  avisar(`«${editando.nombre}» guardada.`);
                }}
              >
                Guardar
              </Boton>
              <Boton
                variante="primario"
                disabled={!editando.nombre.trim()}
                onClick={() => {
                  guardar(editando);
                  publicar(editando.id);
                  setEditando(null);
                  avisar(`«${editando.nombre}» publicada en el Control Center.`);
                }}
              >
                Guardar y publicar
              </Boton>
            </>
          }
        />
        <div className="estudio">
          <Tarjeta className="estudio__editor">
            <EditorMarca marca={editando} onCambio={setEditando} onError={(m) => avisar(m, "malo")} />
          </Tarjeta>
          <div className="estudio__lateral">
            <Tarjeta titulo="Vista previa" accion={<span className="tenue">En vivo</span>}>
              <VistaPreviaMarca marca={editando} />
            </Tarjeta>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <EncabezadoPagina
        antetitulo="Marca"
        titulo="White Label"
        descripcion="Las marcas con las que puede vestirse el Control Center. Todas comparten el mismo sistema: cambian tokens, logo y tipografía, nunca componentes."
        acciones={
          <Boton variante="primario" icono={<Plus size={14} />} onClick={() => setEditando(nuevaMarca())}>
            Nueva marca
          </Boton>
        }
      />

      <p className="nota nota--info">
        <Info size={15} />
        <span>
          Las marcas se guardan en este navegador y publicarlas cambia lo que ves tú. Cuando el
          backend tenga un modelo de marcas, este mismo panel las publicará para cada cliente.
        </span>
      </p>

      <div className="rejilla-tarjetas">
        {marcas.map((marca) => {
          const publicada = marca.id === activa.id;
          return (
            <article key={marca.id} className={`tarjeta marca-tarjeta ${publicada ? "es-publicada" : ""}`}>
              <div className="marca-tarjeta__cabecera">
                <LogoMarca marca={marca} />
                {publicada ? (
                  <Insignia tono="ok" punto>
                    Publicada
                  </Insignia>
                ) : marca.sistema ? (
                  <Insignia>Sistema</Insignia>
                ) : null}
              </div>
              <div className="marca-tarjeta__muestras" aria-label="Colores de la marca">
                {[marca.colores.primario, marca.colores.secundario, marca.colores.acento].map((c, i) => (
                  <span key={i} className="marca-tarjeta__muestra" style={{ background: c }} title={c} />
                ))}
              </div>
              <p className="marca-tarjeta__detalle">
                {marca.tipografia} · redondez {marca.redondez}
              </p>
              <div className="marca-tarjeta__acciones">
                {!publicada && (
                  <Boton
                    tamano="pequeno"
                    variante="primario"
                    icono={<Check size={13} />}
                    onClick={() => {
                      publicar(marca.id);
                      avisar(`«${marca.nombre}» publicada.`);
                    }}
                  >
                    Publicar
                  </Boton>
                )}
                <Boton tamano="pequeno" icono={<Pencil size={13} />} onClick={() => setEditando(marca)}>
                  Editar
                </Boton>
                {!marca.sistema && (
                  <button
                    type="button"
                    className="icono-boton"
                    aria-label={`Eliminar ${marca.nombre}`}
                    onClick={() => setBorrando(marca)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {borrando && (
        <Confirmar
          titulo={`Eliminar «${borrando.nombre}»`}
          consecuencias={
            borrando.id === activa.id
              ? `Es la marca publicada: el Control Center volverá a ${MARCA_KRYON.nombre}.`
              : "La marca desaparece de esta lista. No afecta a ninguna empresa."
          }
          etiquetaAccion="Eliminar"
          peligrosa
          onConfirmar={() => {
            eliminar(borrando.id);
            setBorrando(null);
            avisar("Marca eliminada.");
          }}
          onCerrar={() => setBorrando(null)}
        />
      )}
    </>
  );
}
