import { useEffect, useState } from "react";

import EmployeeAdmissionsPage from "../../pages/EmployeeAdmissionsPage";
import EmployeeRecordPage from "../../pages/EmployeeRecordPage";
import EmployeesPage from "../../pages/EmployeesPage";
import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchDocuments } from "../../services/documentApi";
import { createEmployee, deleteEmployee, fetchAllEmployees, fetchNextEmployeeCode, updateEmployee } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";

const employeeRoutes = ["employee-admissions", "employees", "employee-record"];

const initialEmployeeForm = {
  employee_code: "",
  company_id: "",
  center_id: "",
  dni: "",
  naf: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
};

function getEmployeeRoute() {
  const route = window.location.hash.replace("#", "");
  return employeeRoutes.includes(route) ? route : null;
}

function buildEmployeePayload(form) {
  return {
    ...form,
    company_id: form.company_id ? Number(form.company_id) : null,
    center_id: form.center_id ? Number(form.center_id) : null,
    naf: form.naf || null,
    email: form.email || null,
    phone: form.phone || null,
    birth_date: form.birth_date || null,
    address: form.address || null,
    city: form.city || null,
    province: form.province || null,
    postal_code: form.postal_code || null,
    is_active: form.is_active ?? true,
  };
}

function getRouteTitle(route) {
  if (route === "employee-admissions") return "Alta / baja";
  if (route === "employee-record") return "Expediente laboral";
  return "Trabajadores";
}

function getRouteSubtitle(route) {
  if (route === "employee-admissions") return "Alta, baja y reactivación de trabajadores.";
  if (route === "employee-record") return "Vista ERP del expediente profesional del trabajador.";
  return "Listado y edición de trabajadores. El expediente completo se abre desde cada fila.";
}

export default function EmployeesRoute() {
  const [route, setRoute] = useState(getEmployeeRoute());
  const [loading, setLoading] = useState(true);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [employeeSuccess, setEmployeeSuccess] = useState("");
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [data, setData] = useState({
    employees: [],
    companies: [],
    workCenters: [],
    contracts: [],
    incidents: [],
    payrolls: [],
    documents: [],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [contracts, employees, companies, workCenters, incidents, payrolls, documents, nextEmployeeCode] = await Promise.all([
        fetchContracts(),
        fetchAllEmployees(),
        fetchCompanies(),
        fetchWorkCenters(),
        fetchIncidents(),
        fetchPayrolls(),
        fetchDocuments(),
        fetchNextEmployeeCode(),
      ]);

      setData({ contracts, employees, companies, workCenters, incidents, payrolls, documents });
      setEmployeeForm((prev) => ({ ...prev, employee_code: nextEmployeeCode.employee_code }));
    } catch (err) {
      setEmployeeError(err.message || "Error cargando trabajadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleRouteChange = () => setRoute(getEmployeeRoute());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (route) loadData();
  }, [route]);

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;
    setEmployeeForm((prev) => (name === "company_id" ? { ...prev, company_id: value, center_id: "" } : { ...prev, [name]: value }));
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await createEmployee(buildEmployeePayload({ ...employeeForm, is_active: true }));
      setEmployeeSuccess("Trabajador creado correctamente");
      setEmployeeForm(initialEmployeeForm);
      await loadData();
    } catch (err) {
      setEmployeeError(err.message || "Error al crear trabajador");
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (employeeId, form) => {
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await updateEmployee(employeeId, buildEmployeePayload(form));
      setEmployeeSuccess("Trabajador actualizado correctamente");
      await loadData();
    } catch (err) {
      setEmployeeError(err.message || "Error al actualizar trabajador");
      throw err;
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    setEmployeeError("");
    setEmployeeSuccess("");

    try {
      setEmployeeSubmitting(true);
      await deleteEmployee(employeeId);
      setEmployeeSuccess("Trabajador dado de baja correctamente");
      await loadData();
    } catch (err) {
      setEmployeeError(err.message || "Error al dar de baja trabajador");
      throw err;
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleReactivateEmployee = async (employee) => {
    await handleUpdateEmployee(employee.id, { ...employee, is_active: true });
  };

  const handleOpenRecord = (employee) => {
    window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(employee.id));
    window.location.hash = "employee-record";
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  if (!route) return null;

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{getRouteTitle(route)}</h1>
          <p style={styles.subtitle}>{getRouteSubtitle(route)}</p>
        </div>
      </header>
      <main style={styles.main}>
        {route === "employee-admissions" && (
          <EmployeeAdmissionsPage
            loading={loading}
            employees={data.employees}
            companies={data.companies}
            workCenters={data.workCenters}
            employeeForm={employeeForm}
            onEmployeeChange={handleEmployeeChange}
            onEmployeeSubmit={handleEmployeeSubmit}
            onReactivateEmployee={handleReactivateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            employeeError={employeeError}
            employeeSuccess={employeeSuccess}
            employeeSubmitting={employeeSubmitting}
          />
        )}

        {route === "employees" && (
          <EmployeesPage
            loading={loading}
            employees={data.employees}
            companies={data.companies.filter((company) => company.is_active)}
            workCenters={data.workCenters.filter((center) => center.is_active)}
            contracts={data.contracts}
            incidents={data.incidents}
            payrolls={data.payrolls}
            employeeForm={employeeForm}
            onEmployeeChange={handleEmployeeChange}
            onEmployeeSubmit={handleEmployeeSubmit}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onOpenRecord={handleOpenRecord}
            employeeError={employeeError}
            employeeSuccess={employeeSuccess}
            employeeSubmitting={employeeSubmitting}
          />
        )}

        {route === "employee-record" && (
          <EmployeeRecordPage
            loading={loading}
            employees={data.employees}
            companies={data.companies}
            workCenters={data.workCenters}
            contracts={data.contracts}
            incidents={data.incidents}
            payrolls={data.payrolls}
            documents={data.documents}
          />
        )}
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    top: "56px",
    left: "272px",
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: "#ffffff",
    overflowY: "auto",
  },
  header: {
    borderBottom: "3px solid #111111",
    backgroundColor: "#ffffff",
    padding: "24px 42px 18px 32px",
    boxSizing: "border-box",
  },
  title: {
    margin: 0,
    color: "#111111",
    fontSize: "32px",
    fontWeight: 950,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#4b5563",
    fontSize: "15px",
    fontWeight: 700,
  },
  main: {
    padding: "26px 42px 48px 32px",
    boxSizing: "border-box",
    maxWidth: "1320px",
    width: "100%",
  },
};
