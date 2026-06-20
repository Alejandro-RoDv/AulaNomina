import { formatIban } from "./bankingUtils";

export default function BankAccountsTable({ accounts, onToggleFallback, onDelete }) {
  return (
    <div className="banking-table-wrap">
      <table className="banking-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>IBAN</th>
            <th>Entidad</th>
            <th>Sucursal</th>
            <th>DC</th>
            <th>Nº de cuenta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <strong>{account.label}</strong>
                {account.is_fallback && <span className="banking-badge">Cuenta comodín</span>}
                {account.is_simulated && <small className="banking-muted-block">Simulada</small>}
              </td>
              <td>{formatIban(account.iban)}</td>
              <td>{account.entity_code || "-"}</td>
              <td>{account.branch_code || "-"}</td>
              <td>{account.control_digits || "-"}</td>
              <td>{account.account_number || "-"}</td>
              <td className="banking-actions">
                <button type="button" onClick={() => onToggleFallback(account)} className="banking-button-secondary">
                  {account.is_fallback ? "Quitar comodín" : "Usar como comodín"}
                </button>
                <button type="button" onClick={() => onDelete(account)} className="banking-button-danger">
                  Eliminar (-)
                </button>
              </td>
            </tr>
          ))}
          {!accounts.length && (
            <tr>
              <td colSpan="7" className="banking-empty-cell">No hay cuentas registradas.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
