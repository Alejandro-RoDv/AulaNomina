import { apiRequest } from "./httpClient";

export async function fetchEmployees() {
  return apiRequest("/employees", {}, "Error al cargar trabajadores");
}

export async function fetchAllEmployees() {
  return apiRequest("/employees/all", {}, "Error al cargar trabajadores");
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
  return apiRequest(
    "/employees",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear trabajador"
  );
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
