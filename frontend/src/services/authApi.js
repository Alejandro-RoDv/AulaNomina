import { apiRequest } from "./httpClient.js";
import {
  clearAuthSession,
  getAuthToken,
  getStoredAuthUser,
  storeAuthSession,
} from "./authStorage.js";


export function fetchAuthConfig() {
  return apiRequest("/auth/config", {}, "No se ha podido comprobar el modo de acceso");
}

export async function login(email, password) {
  const response = await apiRequest(
    "/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    "No se ha podido iniciar sesión"
  );
  storeAuthSession(response.access_token, response.user);
  window.dispatchEvent(new CustomEvent("aulanomina-auth-changed", { detail: response.user }));
  return response.user;
}

export function fetchMe() {
  return apiRequest("/auth/me", {}, "No se ha podido validar la sesión");
}

export async function refreshAuthUser() {
  const current = await fetchMe();
  const token = getAuthToken();
  if (token) storeAuthSession(token, current);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aulanomina-auth-changed", { detail: current }));
  }
  return current;
}

export async function logout() {
  try {
    if (getAuthToken()) {
      await apiRequest("/auth/logout", { method: "POST" }, "No se ha podido cerrar la sesión");
    }
  } finally {
    clearAuthSession();
    window.dispatchEvent(new Event("aulanomina-auth-changed"));
  }
}

export { getAuthToken, getStoredAuthUser };
