import { useCallback, useEffect, useState } from "react";

import { fetchContracts, resetDemo } from "../services/api";
import { fetchCollectiveAgreements } from "../services/collectiveAgreementApi";
import { fetchCompanies } from "../services/companyApi";
import { fetchAllEmployees, fetchNextEmployeeCode } from "../services/employeeApi";
import { fetchIncidents } from "../services/incidentApi";
import { fetchPayrolls } from "../services/payrollApi";
import { fetchWorkCenters } from "../services/workCenterApi";

export function useAppData({ onLoadError, onNextEmployeeCode } = {}) {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [collectiveAgreements, setCollectiveAgreements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [resetDemoLoading, setResetDemoLoading] = useState(false);
  const [resetDemoMessage, setResetDemoMessage] = useState("");
  const [resetDemoError, setResetDemoError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        contractsData,
        employeesData,
        companiesData,
        workCentersData,
        incidentsData,
        payrollsData,
        collectiveAgreementsData,
        nextEmployeeCodeData,
      ] = await Promise.all([
        fetchContracts(),
        fetchAllEmployees(),
        fetchCompanies(),
        fetchWorkCenters(),
        fetchIncidents(),
        fetchPayrolls(),
        fetchCollectiveAgreements(),
        fetchNextEmployeeCode(),
      ]);

      setContracts(contractsData);
      setEmployees(employeesData);
      setCompanies(companiesData);
      setWorkCenters(workCentersData);
      setIncidents(incidentsData);
      setPayrolls(payrollsData);
      setCollectiveAgreements(collectiveAgreementsData);
      onNextEmployeeCode?.(nextEmployeeCodeData.employee_code);
    } catch (err) {
      onLoadError?.(err);
    } finally {
      setLoading(false);
    }
  }, [onLoadError, onNextEmployeeCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetDemo = async () => {
    const confirmed = window.confirm(
      "Esto reiniciará únicamente los datos demo de Fundación AulaNomina. Los demás datos no deberían tocarse. ¿Continuar?"
    );
    if (!confirmed) return;

    setResetDemoError("");
    setResetDemoMessage("");

    try {
      setResetDemoLoading(true);
      const data = await resetDemo();
      setResetDemoMessage(data.message || "Demo reiniciada correctamente");
      await loadData();
    } catch (err) {
      setResetDemoError(err.message || "Error al reiniciar la demo");
    } finally {
      setResetDemoLoading(false);
    }
  };

  const clearResetDemoMessages = () => {
    setResetDemoError("");
    setResetDemoMessage("");
  };

  return {
    contracts,
    employees,
    companies,
    workCenters,
    incidents,
    payrolls,
    collectiveAgreements,
    loading,
    loadData,
    resetDemoLoading,
    resetDemoMessage,
    resetDemoError,
    handleResetDemo,
    clearResetDemoMessages,
  };
}
