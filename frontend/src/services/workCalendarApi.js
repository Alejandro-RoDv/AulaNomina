import { apiRequest } from "./httpClient";

export async function fetchWorkCalendars() {
  return apiRequest("/work-calendars", {}, "Error al cargar calendarios laborales");
}

export async function createWorkCalendar(payload) {
  return apiRequest(
    "/work-calendars",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear calendario laboral"
  );
}

export async function updateWorkCalendar(calendarId, payload) {
  return apiRequest(
    `/work-calendars/${calendarId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar calendario laboral"
  );
}
