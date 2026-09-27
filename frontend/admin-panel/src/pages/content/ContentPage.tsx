import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { NegocioTab } from "../business/NegocioTab";
import { tienePermiso } from "../../utils";
import { AnunciosTab } from "./AnunciosTab";
import { ArchivosTab } from "./ArchivosTab";
import { BannersTab } from "./BannersTab";
import { BeneficiosTab } from "./BeneficiosTab";
import { GeneralTab } from "./GeneralTab";
import { OfertasTab } from "./OfertasTab";
import { PaginasTab } from "./PaginasTab";
import { TestimoniosTab } from "./TestimoniosTab";
import { TrustBadgesTab } from "./TrustBadgesTab";

/** Lo que administra el contenido de la tienda: el mismo permiso de siempre. */
const PERMISO_CONTENIDO = "content.view_promobanner";

/**
 * Toda la configuración del negocio y de su tienda en un solo sitio.
 *
 * «Tu negocio» no pide permiso —todo el equipo lo ve y solo el dueño lo
 * cambia, eso lo decide la pestaña—; el resto es contenido de la tienda y
 * pide el permiso de contenido, como cuando era su propia página.
 *
 * La pestaña va en la URL (`?pestana=`) para poder enlazar directo a una,
 * que es lo que hace la vieja ruta `/negocio`.
 */
const TABS = [
  { key: "negocio", label: "Tu negocio", permiso: null },
  { key: "general", label: "General", permiso: PERMISO_CONTENIDO },
  { key: "paginas", label: "Páginas", permiso: PERMISO_CONTENIDO },
  { key: "banners", label: "Banners", permiso: PERMISO_CONTENIDO },
  { key: "anuncios", label: "Anuncios", permiso: PERMISO_CONTENIDO },
  { key: "ofertas", label: "Ofertas", permiso: PERMISO_CONTENIDO },
  { key: "beneficios", label: "Beneficios", permiso: PERMISO_CONTENIDO },
  { key: "testimonios", label: "Testimonios", permiso: PERMISO_CONTENIDO },
  { key: "confianza", label: "Confianza", permiso: PERMISO_CONTENIDO },
  { key: "archivos", label: "Archivos", permiso: PERMISO_CONTENIDO },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ContentPage() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();

  const visibles = TABS.filter((t) => !t.permiso || tienePermiso(usuario ?? null, t.permiso));
  const pedida = params.get("pestana");
  const tab: TabKey =
    visibles.find((t) => t.key === pedida)?.key ??
    // Quien administra la tienda entra a lo que más toca; el resto, a lo único que ve.
    (visibles.some((t) => t.key === "general") ? "general" : "negocio");

  return (
    <>
      <div className="topbar">
        <h1>Configuración</h1>
      </div>
      <div className="contenido">
        <div className="tabs" style={{ marginBottom: "1.2rem" }}>
          {visibles.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "activo" : ""}`}
              onClick={() => setParams({ pestana: t.key }, { replace: true })}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "negocio" && <NegocioTab />}
        {tab === "general" && <GeneralTab />}
        {tab === "paginas" && <PaginasTab />}
        {tab === "banners" && <BannersTab />}
        {tab === "anuncios" && <AnunciosTab />}
        {tab === "ofertas" && <OfertasTab />}
        {tab === "beneficios" && <BeneficiosTab />}
        {tab === "testimonios" && <TestimoniosTab />}
        {tab === "confianza" && <TrustBadgesTab />}
        {tab === "archivos" && <ArchivosTab />}
      </div>
    </>
  );
}
