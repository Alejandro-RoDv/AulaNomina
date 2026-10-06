import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateContractRemuneration, isRecurringContractConcept } from '../utils/contractRemuneration.js';
test('prorating redistributes annual salary instead of reducing it', () => {
 const regular=calculateContractRemuneration(1800,[],100,'not_prorated_14');
 const prorated=calculateContractRemuneration(1800,[],100,'prorated_12');
 assert.equal(regular.annual,25200); assert.equal(prorated.annual,25200); assert.equal(prorated.monthly,2100); assert.equal(regular.monthly,1800);
});
test('partiality applies to reference amounts while fixed concepts stay fixed', () => {
 const result=calculateContractRemuneration(1800,[{amount:200},{amount:100,applies_workday_percentage:false}],50,'not_prorated_14');
 assert.equal(result.baseApplied,900);assert.equal(result.supplements,200);assert.equal(result.monthly,1100);assert.equal(result.annual,15400);
});
test('contract picker excludes payroll events and duplicate salary components', () => {
 for(const name of ['Salario base','Indemnización fin de contrato','Prestación IT','Horas extraordinarias','Paga extra','Vacaciones retribuidas','Dietas','Atrasos','Prorrata de pagas extra']) assert.equal(isRecurringContractConcept({name}),false,name);
 for(const name of ['Plus de responsabilidad','Mejora voluntaria','Antigüedad','Plus transporte']) assert.equal(isRecurringContractConcept({name}),true,name);
});
