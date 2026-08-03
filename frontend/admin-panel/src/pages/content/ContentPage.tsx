import { useState } from "react";
import { ArchivosTab } from "./ArchivosTab";
import { BannersTab } from "./BannersTab";
import { GeneralTab } from "./GeneralTab";
import { TestimoniosTab } from "./TestimoniosTab";
import { TrustBadgesTab } from "./TrustBadgesTab";

const TABS = [
  { key: "general", label: "General" },
  { key: "banners", label: "Banners" },
  { key: "testimonios", label: "Testimonios" },
  { key: "confianza", label: "Confianza" },
  { key: "archivos", label: "Archivos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ContentPage() {
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <>
      <div className="topbar">
        <h1>Contenido de la tienda</h1>
      </div>
      <div className="contenido">
        <div className="tabs" style={{ marginBottom: "1.2rem" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "activo" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "general" && <GeneralTab />}
        {tab === "banners" && <BannersTab />}
        {tab === "testimonios" && <TestimoniosTab />}
        {tab === "confianza" && <TrustBadgesTab />}
        {tab === "archivos" && <ArchivosTab />}
      </div>
    </>
  );
}
