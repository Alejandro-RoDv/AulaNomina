import { useEffect, useState } from "react";

import IrpfModulePanel from "../components/payrolls/IrpfModulePanel";
import { fetchCompanies } from "../services/companyApi";
import { fetchWorkCenters } from "../services/workCenterApi";
import "./irpfPage.css";

export default function IrpfPage({ employees, contracts, companies: companiesProp, workCenters: workCentersProp, onRefresh }) {
  const [companies, setCompanies] = useState(companiesProp || []);
  const [workCenters, setWorkCenters] = useState(workCentersProp || []);

  useEffect(() => {
    if (companiesProp?.length) setCompanies(companiesProp);
    if (workCentersProp?.length) setWorkCenters(workCentersProp);
  }, [companiesProp, workCentersProp]);

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      try {
        const [companiesData, centersData] = await Promise.all([
          companiesProp?.length ? Promise.resolve(companiesProp) : fetchCompanies(),
          workCentersProp?.length ? Promise.resolve(workCentersProp) : fetchWorkCenters(),
        ]);
        if (!cancelled) {
          setCompanies(companiesData || []);
          setWorkCenters(centersData || []);
        }
      } catch {
        // El módulo puede seguir funcionando aunque falle el contexto organizativo.
      }
    };

    loadContext();
    return () => { cancelled = true; };
  }, [companiesProp, workCentersProp]);

  return (
    <div className="irpf-page-shell">
      <IrpfModulePanel
        employees={employees}
        contracts={contracts}
        companies={companies}
        workCenters={workCenters}
        onRefresh={onRefresh}
      />
    </div>
  );
}
