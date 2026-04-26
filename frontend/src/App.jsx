import { useEffect, useState } from "react";
import CompanyForm from "./components/CompanyForm";
import CompanyTable from "./components/CompanyTable";
import ContractForm from "./components/ContractForm";
import ContractTable from "./components/ContractTable";
import { createContract, fetchContracts, fetchEmployees } from "./services/api";
import { createCompany, fetchCompanies } from "./services/companyApi";
import logo from "./assets/aulanomina-logo.svg";

export default function App() {
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [contractForm, setContractForm] = useState({ employee_id: "", contract_type: "", start_date: "", end_date: "", salary_base: "", status: "active" });
  const [companyForm, setCompanyForm] = useState({ name: "", cif: "", address: "", city: "", province: "" });

  const loadData = async () => {
    const [c1, c2, c3] = await Promise.all([
      fetchContracts(), fetchEmployees(), fetchCompanies()
    ]);
    setContracts(c1);
    setEmployees(c2);
    setCompanies(c3);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#111", color: "#fff", padding: 20 }}>
        <img src={logo} style={{ width: "100%" }} />
        <p>Empresas</p>
        <p>Contratos</p>
      </aside>

      <main style={{ flex: 1, padding: 30 }}>
        <h1>AulaNomina</h1>

        <CompanyTable loading={loading} companies={companies} />
        <ContractTable loading={loading} contracts={contracts} employees={employees} />
      </main>
    </div>
  );
}
