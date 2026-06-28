import IncidentForm, { INCIDENT_TYPES } from "./IncidentForm";

export default function CategoryIncidentForm({ category, form, onChange, ...props }) {
  const availableTypes = INCIDENT_TYPES.filter((type) => category.types?.includes(type.value));

  return <div className="incident-category-form">
    {availableTypes.length > 1 && <section className="incident-subtype-panel">
      <div><strong>{category.typeLabel || "Tipo de incidencia"}</strong><small>Elige el proceso concreto dentro de esta categoría.</small></div>
      <select name="incident_type" value={form.incident_type} onChange={onChange} required>
        {availableTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
      </select>
    </section>}
    <IncidentForm form={form} onChange={onChange} {...props} />
  </div>;
}
