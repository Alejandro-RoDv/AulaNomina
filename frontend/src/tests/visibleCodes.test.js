import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmployeeVisibleCode, matchesEmployeeCode } from '../utils/visibleCodes.js';
const employees = [{ id: 70, company_id: 1, employee_code: 'EMP-70' }, { id: 95, company_id: 1, employee_code: 'EMP-95' }, { id: 100, company_id: 2, employee_code: 'EMP-100' }];
test('search matches displayed company.sequence codes instead of only internal IDs', () => {
  assert.deepEqual(employees.filter(e => matchesEmployeeCode(e, '1.1', employees)), [employees[0]]);
  assert.deepEqual(employees.filter(e => matchesEmployeeCode(e, ' 1.2 ', employees)), [employees[1]]);
  assert.deepEqual(employees.filter(e => matchesEmployeeCode(e, '2.1', employees)), [employees[2]]);
  assert.equal(matchesEmployeeCode(employees[0], '9.9', employees), false);
  assert.equal(matchesEmployeeCode(employees[1], 'emp-95', employees), true);
  assert.equal(matchesEmployeeCode(employees[1], '95', employees), true);
  assert.equal(matchesEmployeeCode(employees[0], '', employees), true);
});
test('filtered rows retain their original visible code when given the complete code context', () => {
  const filtered = employees.filter(e => matchesEmployeeCode(e, '1.2', employees));
  assert.equal(getEmployeeVisibleCode(filtered[0], employees), '1.2');
  assert.equal(getEmployeeVisibleCode(filtered[0], [...employees].reverse()), '1.2');
});
test('legacy employees infer company from contract when searching', () => {
  const legacy = [{ id: 40 }, { id: 60 }];
  const contracts = [{ employee_id: 40, company_id: 3 }, { employee_id: 60, company_id: 3 }];
  assert.equal(matchesEmployeeCode(legacy[1], '3.2', legacy, contracts), true);
});
