import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomRows } from '../utils/customReports.js';
import { createCompanyDemo, demoIban } from '../utils/demoFormData.js';

test('mixed report aggregates by employee, keeps zero values and excludes foreign company records', () => {
 const rows = buildCustomRows({ employees: [{ id: 1, company_id: 2, first_name: 'Ana', last_name: 'Ruiz' }, { id: 2, company_id: 2 }], companies: [{ id: 2, name: 'Empresa' }], workCenters: [], contracts: [{ employee_id: 1, start_date: '2024-01-01', contract_type: 'old' }, { employee_id: 1, start_date: '2026-01-01', contract_type: 'recent' }], payrolls: [{ employee_id: 1, company_id: 2, gross_salary: 1000, net_salary: 800 }, { employee_id: 1, company_id: 2, gross_salary: 1200, net_salary: 900 }, { employee_id: 1, company_id: 3, gross_salary: 9999 }], incidents: [{ employee_id: 1, company_id: 2, incident_type: 'IT' }], documents: [{ employee_id: 1, company_id: 2, status: 'pending', name: 'DNI' }] });
 assert.equal(rows.length, 2); assert.equal(rows[0].gross, '2200.00'); assert.equal(rows[0].net, '1700.00'); assert.equal(rows[0].payrollCount, 2); assert.equal(rows[0].type, 'recent'); assert.equal(rows[0].pendingDocuments, 'DNI'); assert.equal(rows[1].incidentCount, 0);
});
test('demo IBAN checksum and mutual variation', () => {
 for (let index = 0; index < 20; index++) { const iban = demoIban(); assert.match(iban, /^ES\d{22}$/); assert.equal(BigInt(iban.slice(4) + '1428' + iban.slice(2,4)) % 97n, 1n); }
 const first = createCompanyDemo('services'); const second = createCompanyDemo('services'); assert.notEqual(first.professional_contingencies_mutual, second.professional_contingencies_mutual); assert.ok(first.legal_representative_dni); assert.ok(first.bank_iban);
});
