import { useSyncExternalStore } from "react";
import { getSelectedCompanyId, setSelectedCompanyId, subscribeSelectedCompany } from "../utils/companyContext";

export function useCompanySelection() {
  const companyId = useSyncExternalStore(subscribeSelectedCompany, getSelectedCompanyId, () => "");
  return [companyId, setSelectedCompanyId];
}
