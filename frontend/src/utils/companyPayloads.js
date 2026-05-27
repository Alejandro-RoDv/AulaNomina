export const initialCompanyForm = {
  name: "",
  cif: "",
  ccc: "",
  address: "",
  city: "",
  province: "",
};

export const initialWorkCenterForm = {
  company_id: "",
  center_code: "",
  name: "",
  general_ccc: "",
  main_ccc: "",
  address: "",
  city: "",
  province: "",
};

export function buildCompanyPayload(form) {
  return {
    ...form,
    ccc: form.ccc || null,
    address: form.address || null,
    city: form.city || null,
    province: form.province || null,
  };
}

export function buildWorkCenterPayload(form) {
  return {
    company_id: Number(form.company_id),
    center_code: form.center_code,
    name: form.name,
    general_ccc: form.general_ccc || null,
    main_ccc: form.main_ccc || null,
    address: form.address || null,
    city: form.city || null,
    province: form.province || null,
  };
}
