import { apiRequest } from "./httpClient";

const LAST_CREATED_EMPLOYEE_KEY = "aulanomina:lastCreatedEmployee";

function publishCreatedEmployee(employee) {
  if (!employee || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(LAST_CREATED_EMPLOYEE_KEY, JSON.stringify(employee));
    window.dispatchEvent(new CustomEvent("aulanomina:employee-created", { detail: employee }));
  } catch {
    // No bloquear el flujo principal si sessionStorage no está disponible.
  }
}

export function consumeLastCreatedEmployee() {
  if (typeof window === "undefined") return null;

  try {
    const rawEmployee = window.sessionStorage.getItem(LAST_CREATED_EMPLOYEE_KEY);
    if (!rawEmployee) return null;
    window.sessionStorage.removeItem(LAST_CREATED_EMPLOYEE_KEY);
    return JSON.parse(rawEmployee);
  } catch {
    return null;
  }
}

export async function fetchEmployees() {
  return apiRequest("/employees", {}, "Error al cargar trabajadores");
}

export async function fetchAllEmployees() {
  return apiRequest("/employees?include_inactive=true", {}, "Error al cargar trabajadores");
}

export async function fetchNextEmployeeCode() {
  return apiRequest("/employees/next-code", {}, "Error al cargar el siguiente código de trabajador");
}

export async function fetchEmployeeAssignmentHistory(employeeId) {
  return apiRequest(
    `/employees/${employeeId}/assignment-history`,
    {},
    "Error al cargar histórico de empresa/centro"
  );
}

export async function createEmployee(payload) {
  const employee = await apiRequest(
    "/employees",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear trabajador"
  );

  publishCreatedEmployee(employee);
  return employee;
}

export async function updateEmployee(employeeId, payload) {
  return apiRequest(
    `/employees/${employeeId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar trabajador"
  );
}

export async function deleteEmployee(employeeId) {
  return apiRequest(
    `/employees/${employeeId}`,
    { method: "DELETE" },
    "Error al desactivar trabajador"
  );
}
