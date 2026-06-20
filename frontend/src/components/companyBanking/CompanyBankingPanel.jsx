import { useEffect, useMemo, useState } from "react";

import {
  assignPaymentOperation,
  createCompanyBankAccount,
  deleteCompanyBankAccount,
  fetchCompanyBanking,
  unassignPaymentOperation,
  updateCompanyBankAccount,
} from "../../services/companyBankingApi";
import BankAccountForm from "./BankAccountForm";
import BankAccountsTable from "./BankAccountsTable";
import PaymentOperationsTable from "./PaymentOperationsTable";
import {
  COMMON_OPERATION_CODES,
  EMPTY_BANK_ACCOUNT,
  generateFakeSpanishIban,
  normalizeIban,
} from "./bankingUtils";
import "./companyBanking.css";

export default function CompanyBankingPanel({ companies, selectedCompanyId, onSelectedCompanyChange }) {
  const [data, setData] = useState({ accounts: [], operations: [] });
  const [form, setForm] = useState(EMPTY_BANK_ACCOUNT);
  const [choices, setChoices] = useState({});
  const [showSpecific, setShowSpecific] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === String(selectedCompanyId)),
    [companies, selectedCompanyId]
  );

  const loadData = async () => {
    if (!selectedCompanyId) {
      setData({ accounts: [], operations: [] });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetchCompanyBanking(selectedCompanyId);
      setData(response);
      setChoices(Object.fromEntries(response.operations.map((operation) => [operation.operation_code, operation.account_id || ""])));
    } catch (err) {
      setError(err.message || "No se pudo cargar la domiciliación de pagos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess("");
  };

  const handleGenerate = () => {
    setForm((current) => ({ ...current, iban: generateFakeSpanishIban(), is_simulated: true }));
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createCompanyBankAccount(selectedCompanyId, { ...form, iban: normalizeIban(form.iban) });
      setForm(EMPTY_BANK_ACCOUNT);
      setSuccess("Cuenta bancaria añadida.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se pudo añadir la cuenta");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Eliminar ${account.label} y desvincular sus operaciones?`)) return;
    try {
      await deleteCompanyBankAccount(selectedCompanyId, account.id);
      setSuccess("Cuenta eliminada y operaciones desvinculadas.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se pudo eliminar la cuenta");
    }
  };

  const handleFallback = async (account) => {
    try {
      await updateCompanyBankAccount(selectedCompanyId, account.id, { is_fallback: !account.is_fallback });
      setSuccess(account.is_fallback ? "Cuenta comodín desactivada." : "Cuenta comodín actualizada.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la cuenta comodín");
    }
  };

  const handleAssign = async (operation) => {
    const accountId = choices[operation.operation_code];
    if (!accountId) {
      setError("Selecciona una cuenta antes de asignarla.");
      return;
    }
    try {
      await assignPaymentOperation(selectedCompanyId, operation.operation_code, accountId);
      setSuccess("Cuenta asignada a la operación.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se pudo asignar la cuenta");
    }
  };

  const handleUnassign = async (operation) => {
    try {
      await unassignPaymentOperation(selectedCompanyId, operation.operation_code);
      setSuccess("Cuenta desvinculada de la operación.");
      await loadData();
    } catch (err) {
      setError(err.message || "No se pudo desvincular la cuenta");
    }
  };

  const commonOperations = data.operations.filter((operation) => COMMON_OPERATION_CODES.has(operation.operation_code));
  const specificOperations = data.operations.filter((operation) => !COMMON_OPERATION_CODES.has(operation.operation_code));

  return (
    <div className="company-banking">
      <div className="banking-toolbar">
        <label className="banking-company-field">
          Empresa
          <select value={selectedCompanyId || ""} onChange={(event) => onSelectedCompanyChange(event.target.value)}>
            <option value="">Selecciona una empresa</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        {selectedCompany && <span className="banking-badge">{selectedCompany.name}</span>}
      </div>

      {!selectedCompanyId && <div className="banking-empty">Selecciona una empresa para gestionar sus cuentas y domiciliaciones.</div>}

      {selectedCompanyId && (
        <>
          <section className="banking-card">
            <div className="banking-card-header">
              <div><h3>Domiciliaciones bancarias</h3><p>Registra cuentas y define una cuenta comodín para operaciones sin asignación específica.</p></div>
              <span>{data.accounts.length} cuentas</span>
            </div>
            <BankAccountForm form={form} onChange={updateForm} onSubmit={handleAdd} onGenerate={handleGenerate} saving={saving} />
            <BankAccountsTable accounts={data.accounts} onToggleFallback={handleFallback} onDelete={handleDelete} />
          </section>

          <section className="banking-card">
            <div className="banking-card-header">
              <div><h3>Servicios y operaciones habituales</h3><p>Seguros sociales, nóminas, Modelo 111 y honorarios.</p></div>
            </div>
            {loading ? <div className="banking-empty">Cargando...</div> : <PaymentOperationsTable operations={commonOperations} accounts={data.accounts} choices={choices} onChoiceChange={(code, value) => setChoices((current) => ({ ...current, [code]: value }))} onAssign={handleAssign} onUnassign={handleUnassign} />}
          </section>

          <section className="banking-card">
            <div className="banking-card-header">
              <div><h3>Operaciones específicas</h3><p>Configuraciones opcionales para CCC secundarios.</p></div>
              <button type="button" onClick={() => setShowSpecific((current) => !current)} className="banking-button-secondary">{showSpecific ? "Ocultar" : "Mostrar"}</button>
            </div>
            {showSpecific && <PaymentOperationsTable operations={specificOperations} accounts={data.accounts} choices={choices} onChoiceChange={(code, value) => setChoices((current) => ({ ...current, [code]: value }))} onAssign={handleAssign} onUnassign={handleUnassign} />}
          </section>
        </>
      )}

      {error && <div className="banking-error">{error}</div>}
      {success && <div className="banking-success">{success}</div>}
    </div>
  );
}
