import { useCallback, useEffect, useRef, useState } from "react";

import { fetchContracts, resetDemo } from "../services/api";
import { fetchCollectiveAgreements } from "../services/collectiveAgreementApi";
import { fetchCompanies } from "../services/companyApi";
import { fetchDocuments } from "../services/documentApi";
import { fetchAllEmployees, fetchNextEmployeeCode } from "../services/employeeApi";
import { fetchIncidents } from "../services/incidentApi";
import { fetchPayrolls } from "../services/payrollApi";
import { fetchWorkCenters } from "../services/workCenterApi";

async function safeRequest(requestFn, fallback, label, onError) {
  try {
    return await requestFn();
  } catch (error) {
    console.error(`[AulaNomina] Error cargando ${label}:`, error);
    onError?.(error, label);
    return fallback;
  }
}

export function useAppData({ onLoadError, onNextEmployeeCode } = {}) {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [collectiveAgreements, setCollectiveAgreements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [resetDemoLoading, setResetDemoLoading] = useState(false);
  const [resetDemoMessage, setResetDemoMessage] = useState("");
  const [resetDemoError, setResetDemoError] = useState("");

  const onLoadErrorRef = useRef(onLoadError);
  const onNextEmployeeCodeRef = useRef(onNextEmployeeCode);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  useEffect(() => {
    onNextEmployeeCodeRef.current = onNextEmployeeCode;
  }, [onNextEmployeeCode]);

  const refreshCollectiveAgreements = useCallback(async () => {
    try {
      const data = await fetchCollectiveAgreements();
      setCollectiveAgreements(data);
      return data;
    } catch (error) {
      console.error("[AulaNomina] Error cargando convenios:", error);
      throw error;
    }
  }, []);

  const loadData = useCallback(async (scope) => {
    if (scope === "collective-agreements") {
      return refreshCollectiveAgreements();
    }

    setLoading(true);
    let failed = false;
    const markFailure = () => { failed = true; };

    try {
      const [
        contractsData,
        employeesData,
        companiesData,
        workCentersData,
        incidentsData,
        payrollsData,
        documentsData,
        collectiveAgreementsData,
        nextEmployeeCodeData,
      ] = await Promise.all([
        safeRequest(fetchContracts, [], "contratos", markFailure),
        safeRequest(fetchAllEmployees, [], "trabajadores", markFailure),
        safeRequest(fetchCompanies, [], "empresas", markFailure),
        safeRequest(fetchWorkCenters, [], "centros", markFailure),
        safeRequest(fetchIncidents, [], "incidencias", markFailure),
        safeRequest(fetchPayrolls, [], "nóminas", markFailure),
        safeRequest(fetchDocuments, [], "documentos", markFailure),
        safeRequest(fetchCollectiveAgreements, [], "convenios", markFailure),
        safeRequest(fetchNextEmployeeCode, null, "siguiente código de trabajador", markFailure),
      ]);

      setContracts(contractsData);
      setEmployees(employeesData);
      setCompanies(companiesData);
      setWorkCenters(workCentersData);
      setIncidents(incidentsData);
      setPayrolls(payrollsData);
      setDocuments(documentsData);
      setCollectiveAgreements(collectiveAgreementsData);

      if (nextEmployeeCodeData?.employee_code || nextEmployeeCodeData?.next_code) {
        onNextEmployeeCodeRef.current?.(nextEmployeeCodeData.employee_code || nextEmployeeCodeData.next_code);
      }

      if (failed) onLoadErrorRef.current?.();
      return null;
    } finally {
      setLoading(false);
    }
  }, [refreshCollectiveAgreements]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
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
    documents,
    collectiveAgreements,
    loading,
    loadData,
    refreshCollectiveAgreements,
    resetDemoLoading,
    resetDemoMessage,
    resetDemoError,
    handleResetDemo,
    clearResetDemoMessages,
  };
}
