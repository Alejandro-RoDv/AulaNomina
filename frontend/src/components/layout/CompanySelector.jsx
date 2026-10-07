import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronDown, Search } from "lucide-react";
import { useCompanySelection } from "../../hooks/useCompanySelection";
import "./split45.css";

export default function CompanySelector({ companies, loading }) {
  const [companyId, selectCompany] = useCompanySelection();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const container = useRef(null);
  const dropdown = useRef(null);
  const trigger = useRef(null);
  const available = companies.filter((company) => company.is_active !== false && company.status !== "baja_definitiva");
  const selected = available.find((company) => String(company.id) === companyId);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches = available.filter((company) => normalize(`${company.name} ${company.cif} ${company.id}`).includes(normalize(query)));

  useEffect(() => {
    const close = (event) => { if (!container.current?.contains(event.target) && !dropdown.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnResize = () => setOpen(false);
    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, [open]);

  const choose = (id) => {
    selectCompany(id);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  };
  const handleKeyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
  };
  return <div className="an-company-selector" ref={container} onKeyDown={handleKeyDown}>
    <button ref={trigger} type="button" className="an-company-selector__trigger" aria-expanded={open}
      aria-controls="company-picker" aria-label={`Empresa de trabajo: ${selected?.name || "Todas las empresas"}`}
      onClick={() => {
        const bounds = trigger.current.getBoundingClientRect();
        setPosition({ top: bounds.bottom + 8, left: Math.max(16, Math.min(bounds.left, window.innerWidth - Math.min(390, window.innerWidth - 32) - 16)) });
        setOpen(!open); setQuery("");
      }}>
      <Building2 size={20} aria-hidden="true" />
      <span><small>Empresa de trabajo</small><strong>{selected?.name || (loading ? "Cargando empresas…" : "Todas las empresas")}</strong></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && createPortal(<section ref={dropdown} id="company-picker" className="an-company-selector__dropdown" style={position} onKeyDown={handleKeyDown} aria-label="Elegir empresa">
      <label className="an-company-selector__search"><Search size={16} aria-hidden="true" />
        <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o CIF" aria-label="Buscar empresa por nombre o CIF" />
      </label>
      <div className="an-company-selector__options">
        <button type="button" aria-pressed={!companyId} onClick={() => choose("")}>Todas las empresas</button>
        {matches.map((company) => <button type="button" key={company.id} aria-pressed={String(company.id) === companyId} onClick={() => choose(company.id)}>
          <strong>{company.name}</strong><small>{company.cif}</small>
        </button>)}
        {!matches.length && <p>{loading ? "Cargando…" : available.length ? "Sin coincidencias." : "Crea una empresa para empezar."}</p>}
      </div>
    </section>, document.body)}
  </div>;
}
