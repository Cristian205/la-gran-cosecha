import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actualizarSiteConfig, obtenerSiteConfig } from "../../api/content";
import { useAuth } from "../../auth/AuthContext";
import type { SiteConfig } from "../../types";
import { extraerMensajeError } from "../../utils";
import { useCambiosPendientes } from "./ui";

/**
 * La configuración del sitio (`/content/site-config/`) para una vista del
 * centro de configuración.
 *
 * Antes era un único formulario de seiscientas líneas con el botón de guardar
 * al final. Ahora cada vista (identidad, contacto, apariencia, factura…)
 * muestra solo sus campos, pero todas guardan igual que antes: el objeto
 * entero, menos lo que esta pantalla no edita (las URLs de los logos, que
 * suben aparte, y los `tokens` del constructor, que reenviados pisarían lo
 * guardado desde «Páginas y secciones»).
 */
export function useSiteConfig(clave: string) {
  const { refrescarMarca } = useAuth();
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const original = useRef<string>("");
  const [logo, setLogo] = useState<File | null>(null);
  const [facturaLogo, setFacturaLogo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setErrorCarga(null);
    obtenerSiteConfig()
      .then((c) => {
        original.current = JSON.stringify(c);
        setConfig(c);
      })
      .catch((e) => setErrorCarga(extraerMensajeError(e, "No se pudo cargar la configuración del sitio.")))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  const pendiente = useMemo(
    () => Boolean(config) && (JSON.stringify(config) !== original.current || Boolean(logo) || Boolean(facturaLogo)),
    [config, logo, facturaLogo]
  );
  useCambiosPendientes(clave, pendiente);

  // El aviso "guardado" se va solo: es confirmación, no información.
  useEffect(() => {
    if (!guardado) return;
    const t = setTimeout(() => setGuardado(false), 2600);
    return () => clearTimeout(t);
  }, [guardado]);

  function campo<K extends keyof SiteConfig>(nombre: K, valor: SiteConfig[K]) {
    setGuardado(false);
    setErrorGuardar(null);
    setConfig((prev) => (prev ? { ...prev, [nombre]: valor } : prev));
  }

  async function guardar() {
    if (!config || guardando) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const { logo_url, factura_logo_url, tokens, ...cambios } = config as SiteConfig & { tokens?: unknown };
      void logo_url;
      void factura_logo_url;
      void tokens;
      const actualizado = await actualizarSiteConfig(cambios, logo, facturaLogo);
      original.current = JSON.stringify(actualizado);
      setConfig(actualizado);
      setLogo(null);
      setFacturaLogo(null);
      setGuardado(true);
      // El nombre, el logo y el color también se ven en el propio panel.
      refrescarMarca();
    } catch (e) {
      setErrorGuardar(extraerMensajeError(e, "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  function descartar() {
    if (original.current) setConfig(JSON.parse(original.current));
    setLogo(null);
    setFacturaLogo(null);
    setErrorGuardar(null);
  }

  return {
    config,
    campo,
    logo,
    setLogo,
    facturaLogo,
    setFacturaLogo,
    cargando,
    errorCarga,
    recargar: cargar,
    pendiente,
    guardando,
    guardado,
    errorGuardar,
    guardar,
    descartar,
  };
}

export type EditorSiteConfig = ReturnType<typeof useSiteConfig>;
