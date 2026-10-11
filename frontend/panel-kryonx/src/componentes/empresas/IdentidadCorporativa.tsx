/**
 * La identidad corporativa de una empresa, editable desde la plataforma:
 * logo, nombre comercial, datos legales y contacto.
 *
 * Lee y escribe `/platform/tenants/{id}/identidad/`, que guarda donde la
 * tienda ya busca cada dato (su configuración y su centro legal). Lo que se
 * corrige aquí aparece igual en la tienda, en sus políticas y en el pie.
 *
 * Una tienda que monte su plantilla y suba su logo lo verá aquí y en todo el
 * Control Center sin pasos extra; si no lo subió, se puede subir desde aquí.
 */
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { api, ErrorApi } from "../../api/cliente";
import type { IdentidadNegocio, Negocio } from "../../api/tipos";
import { usarPlataforma } from "../../datos/plataforma";
import { Aviso, Boton, Esqueleto } from "../../ui/basicos";
import { usarAviso } from "../../ui/Notificaciones";
import { AvatarEmpresa } from "./piezas";

type Campos = Omit<IdentidadNegocio, "logo_url">;

const VACIO: Campos = {
  nombre_comercial: "",
  razon_social: "",
  nit: "",
  representante_legal: "",
  telefono: "",
  correo: "",
  direccion: "",
  ciudad: "",
  departamento: "",
};

const TIPOS_IMAGEN = "image/png,image/jpeg,image/webp,image/svg+xml";
const TAMANO_MAXIMO = 2 * 1024 * 1024;

export function IdentidadCorporativa({ negocio }: { negocio: Negocio }) {
  const { recargar } = usarPlataforma();
  const avisar = usarAviso();
  const ruta = `/platform/tenants/${negocio.id}/identidad/`;

  const [original, setOriginal] = useState<IdentidadNegocio | null>(null);
  const [campos, setCampos] = useState<Campos>(VACIO);
  const [logo, setLogo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vigente = true;
    api
      .get<IdentidadNegocio>(ruta)
      .then((datos) => {
        if (!vigente) return;
        setOriginal(datos);
        const { logo_url: _logo, ...resto } = datos;
        setCampos({ ...VACIO, ...resto });
      })
      .catch((e) => vigente && setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la identidad."));
    return () => {
      vigente = false;
    };
  }, [ruta]);

  // La URL temporal de la vista previa se libera al cambiarla o al salir.
  useEffect(() => () => void (vistaPrevia && URL.revokeObjectURL(vistaPrevia)), [vistaPrevia]);

  if (!original && !error) {
    return (
      <div className="identidad-corp">
        <Esqueleto alto={120} />
        <Esqueleto alto={220} />
      </div>
    );
  }
  if (!original) return <Aviso>{error}</Aviso>;

  const cambios = (Object.keys(VACIO) as (keyof Campos)[]).filter((k) => campos[k] !== original[k]);
  const hayCambios = cambios.length > 0 || logo !== null || quitarLogo;
  const logoVisible = quitarLogo ? null : vistaPrevia ?? original.logo_url;

  function poner(clave: keyof Campos) {
    return (e: ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, [clave]: e.target.value }));
  }

  function elegirLogo(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    e.target.value = "";
    if (!elegido) return;
    if (elegido.size > TAMANO_MAXIMO) {
      avisar("El logo pesa más de 2 MB. Usa una versión más ligera.", "malo");
      return;
    }
    setLogo(elegido);
    setQuitarLogo(false);
    setVistaPrevia(URL.createObjectURL(elegido));
  }

  function descartar() {
    if (!original) return;
    const { logo_url: _logo, ...resto } = original;
    setCampos({ ...VACIO, ...resto });
    setLogo(null);
    setVistaPrevia(null);
    setQuitarLogo(false);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!hayCambios) return;
    setGuardando(true);
    try {
      let nueva: IdentidadNegocio;
      if (logo || quitarLogo) {
        const formulario = new FormData();
        for (const clave of cambios) formulario.append(clave, campos[clave]);
        if (logo) formulario.append("logo", logo);
        if (quitarLogo) formulario.append("quitar_logo", "true");
        nueva = await api.patchFormulario<IdentidadNegocio>(ruta, formulario);
      } else {
        nueva = await api.patch<IdentidadNegocio>(
          ruta,
          Object.fromEntries(cambios.map((clave) => [clave, campos[clave]]))
        );
      }
      setOriginal(nueva);
      const { logo_url: _logo, ...resto } = nueva;
      setCampos({ ...VACIO, ...resto });
      setLogo(null);
      setVistaPrevia(null);
      setQuitarLogo(false);
      avisar("Identidad corporativa actualizada.");
      // El logo se ve en la tabla, las tarjetas y el selector de workspaces.
      if (logo || quitarLogo) void recargar();
    } catch (err) {
      avisar(err instanceof ErrorApi ? err.message : "No se pudo guardar la identidad.", "malo");
    } finally {
      setGuardando(false);
    }
  }

  const campo = (clave: keyof Campos, etiqueta: string, extra: { tipo?: string; ayuda?: string; marcador?: string } = {}) => (
    <label className="campo">
      <span className="campo__etiqueta">{etiqueta}</span>
      <input
        type={extra.tipo ?? "text"}
        value={campos[clave]}
        onChange={poner(clave)}
        placeholder={extra.marcador}
        autoComplete="off"
      />
      {extra.ayuda && <span className="campo__ayuda">{extra.ayuda}</span>}
    </label>
  );

  return (
    <form className="identidad-corp" onSubmit={guardar}>
      <section className="identidad-corp__bloque">
        <header>
          <h2>Marca</h2>
          <p className="tenue">Cómo se presenta la empresa en su tienda y en el Control Center.</p>
        </header>
        <div className="identidad-corp__logo">
          <span className="identidad-corp__logo-vista">
            {logoVisible ? (
              <img src={logoVisible} alt={`Logo de ${negocio.nombre}`} />
            ) : (
              <AvatarEmpresa negocio={{ nombre: campos.nombre_comercial || negocio.nombre, logo_url: null }} tamano="xl" />
            )}
          </span>
          <div className="identidad-corp__logo-acciones">
            <strong>Logo</strong>
            <span className="tenue">PNG, JPG, WebP o SVG, máximo 2 MB. Mejor cuadrado y con fondo transparente.</span>
            <div>
              <Boton tamano="pequeno" icono={<ImageUp size={14} />} onClick={() => archivo.current?.click()}>
                {logoVisible ? "Cambiar logo" : "Subir logo"}
              </Boton>
              {logoVisible && (
                <Boton
                  tamano="pequeno"
                  variante="fantasma"
                  icono={<Trash2 size={14} />}
                  onClick={() => {
                    setLogo(null);
                    setVistaPrevia(null);
                    setQuitarLogo(Boolean(original.logo_url));
                  }}
                >
                  Quitar
                </Boton>
              )}
            </div>
            <input ref={archivo} type="file" accept={TIPOS_IMAGEN} hidden onChange={elegirLogo} />
          </div>
        </div>
        <div className="identidad-corp__campos">
          {campo("nombre_comercial", "Nombre comercial", {
            ayuda: "El que ven sus clientes en la tienda. El nombre interno del workspace no cambia.",
            marcador: negocio.nombre,
          })}
        </div>
      </section>

      <section className="identidad-corp__bloque">
        <header>
          <h2>Datos legales</h2>
          <p className="tenue">Aparecen en las políticas de su tienda, en el pie y en sus facturas.</p>
        </header>
        <div className="identidad-corp__campos">
          {campo("razon_social", "Razón social o titular")}
          {campo("nit", "NIT o documento", { marcador: "900.123.456-7" })}
          {campo("representante_legal", "Representante legal")}
        </div>
      </section>

      <section className="identidad-corp__bloque">
        <header>
          <h2>Contacto y ubicación</h2>
          <p className="tenue">Los datos con los que sus clientes la encuentran.</p>
        </header>
        <div className="identidad-corp__campos">
          {campo("telefono", "Teléfono", { tipo: "tel" })}
          {campo("correo", "Correo de atención", { tipo: "email" })}
          {campo("direccion", "Dirección")}
          {campo("ciudad", "Ciudad")}
          {campo("departamento", "Departamento")}
        </div>
      </section>

      <footer className={`identidad-corp__pie ${hayCambios ? "hay-cambios" : ""}`}>
        <span className="tenue" aria-live="polite">
          {hayCambios ? "Tienes cambios sin guardar." : "Todo guardado."}
        </span>
        <Boton variante="fantasma" onClick={descartar} disabled={!hayCambios || guardando}>
          Descartar
        </Boton>
        <Boton variante="primario" type="submit" cargando={guardando} disabled={!hayCambios}>
          Guardar cambios
        </Boton>
      </footer>
    </form>
  );
}
