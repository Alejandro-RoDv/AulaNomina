import { useState } from 'react';
import PageCard from './layout/PageCard';
import { CUSTOM_COLUMNS, buildCustomRows } from '../utils/customReports';
import { exportRowsToCsv } from '../utils/exportCsv';
import './customReportBuilder.css';

function storageKey() {
  try { const user = JSON.parse(localStorage.getItem('aulanomina:auth-user')); return `aulanomina:report-templates:${user?.id || 'demo'}`; }
  catch { return 'aulanomina:report-templates:demo'; }
}
export default function CustomReportBuilder({ data }) {
  const [templates, setTemplates] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey()) || '[]'); return Array.isArray(value) ? value.filter(item => item.id && typeof item.name === 'string' && Array.isArray(item.columns)) : []; }
    catch { return []; }
  });
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [keys, setKeys] = useState(['company', 'name', 'dni']);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const columns = keys.map(key => CUSTOM_COLUMNS.find(column => column.key === key)).filter(Boolean);
  const rows = buildCustomRows(data);
  function persist(next) {
    try { localStorage.setItem(storageKey(), JSON.stringify(next)); setTemplates(next); return true; }
    catch { setMessage('No se ha podido guardar. Comprueba el almacenamiento del navegador.'); return false; }
  }
  function save() {
    if (!name.trim() || !columns.length) { setMessage('Introduce un nombre y selecciona al menos una columna.'); return; }
    if (templates.some(item => item.name.toLowerCase() === name.trim().toLowerCase() && item.id !== id)) { setMessage('Ya existe una plantilla con ese nombre.'); return; }
    const template = { id: id || crypto.randomUUID(), name: name.trim(), columns: columns.map(column => column.key) };
    if (persist([...templates.filter(item => item.id !== template.id), template])) { setId(template.id); setMessage('Plantilla guardada en este navegador para tu usuario.'); }
  }
  function load(value) {
    setId(value); setMessage(''); setPreview(false);
    const template = templates.find(item => item.id === value);
    setName(template?.name || ''); setKeys(template?.columns || ['company', 'name', 'dni']);
  }
  return <PageCard title="Plantillas de informe personalizadas" subtitle="Combina columnas de varios módulos y reutiliza la plantilla con la empresa y el periodo seleccionados arriba.">
    <div className="custom-report-builder reports-screen-only">
      <div className="custom-report-controls">
        <label>Plantilla guardada<select value={id} onChange={event => load(event.target.value)}><option value="">Nueva plantilla</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Nombre de plantilla<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Ej.: Plantilla y coste salarial" /></label>
      </div>
      <p>Una fila por trabajador. Nóminas e incidencias se resumen en el periodo filtrado; el contrato mostrado es el activo o el último disponible. Las columnas aparecen en el orden en que las seleccionas.</p>
      <div className="custom-report-groups">{[...new Set(CUSTOM_COLUMNS.map(item => item.group))].map(group => <fieldset key={group}><legend>{group}</legend>{CUSTOM_COLUMNS.filter(item => item.group === group).map(column => <label key={column.key}><input type="checkbox" checked={keys.includes(column.key)} onChange={event => { setKeys(event.target.checked ? [...keys, column.key] : keys.filter(key => key !== column.key)); }} />{column.label}</label>)}</fieldset>)}</div>
      <div className="custom-report-actions">
        <button type="button" onClick={save}>{id ? 'Guardar cambios' : 'Guardar plantilla'}</button>
        <button type="button" disabled={!id} onClick={() => { if (persist(templates.filter(item => item.id !== id))) load(''); }}>Eliminar plantilla</button>
        <button type="button" disabled={!columns.length} onClick={() => setPreview(true)}>Vista previa</button>
        <button type="button" disabled={!columns.length || !rows.length} onClick={() => exportRowsToCsv(`${(name || 'informe_personalizado').replace(/[^\p{L}\p{N}_-]/gu, '_')}.csv`, columns, rows)}>Exportar CSV</button>
      </div>
      {message && <p role="status">{message}</p>}
      {preview && <div className="custom-report-preview"><p>{rows.length} trabajadores · vista de los primeros 10</p><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((row, index) => <tr key={index}>{columns.map(column => <td key={column.key}>{row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <p>No hay trabajadores para la empresa seleccionada.</p>}</div>}
    </div>
  </PageCard>;
}
