export const initialEmployeeForm = {
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

export function buildEmployeePayload(form) {
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
