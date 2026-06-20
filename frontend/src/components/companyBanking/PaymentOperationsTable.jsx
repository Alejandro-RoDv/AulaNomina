import { formatIban } from "./bankingUtils";

function AccountSummary({ account }) {
  if (!account) return <span className="banking-muted">Sin cuenta asignada</span>;
  return (
    <div className="banking-account-summary">
      <strong>{formatIban(account.iban)}</strong>
      <small>Entidad {account.entity_code || "-"} · Sucursal {account.branch_code || "-"} · DC {account.control_digits || "-"} · Cuenta {account.account_number || "-"}</small>
    </div>
  );
}

export default function PaymentOperationsTable({ operations, accounts, choices, onChoiceChange, onAssign, onUnassign }) {
  const accountsById = Object.fromEntries(accounts.map((account) => [String(account.id), account]));

  return (
    <div className="banking-table-wrap">
      <table className="banking-table">
        <thead>
          <tr>
            <th>Tipo de operación</th>
            <th>Seleccionar cuenta</th>
            <th>Datos bancarios aplicados</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => {
            const direct = accountsById[String(operation.account_id)];
            const effective = accountsById[String(operation.effective_account_id)];
            return (
              <tr key={operation.operation_code}>
                <td>
                  <strong>{operation.operation_label}</strong>
                  <small className="banking-muted-block">{operation.service_group}</small>
                </td>
                <td>
                  <select value={choices[operation.operation_code] || ""} onChange={(event) => onChoiceChange(operation.operation_code, event.target.value)}>
                    <option value="">Seleccionar cuenta</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.label} · {formatIban(account.iban)}</option>)}
                  </select>
                </td>
                <td>
                  <AccountSummary account={direct || effective} />
                  {operation.assignment_source === "fallback" && <span className="banking-badge">Aplicada cuenta comodín</span>}
                </td>
                <td className="banking-actions">
                  <button type="button" onClick={() => onAssign(operation)} className="banking-button-assign">Asignar</button>
                  <button type="button" onClick={() => onUnassign(operation)} disabled={!operation.account_id} className={operation.account_id ? "banking-button-unlink" : "banking-button-unlink-disabled"}>Desvincular</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
