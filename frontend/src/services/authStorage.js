export const AUTH_TOKEN_KEY = "aulanomina:auth-token";
export const AUTH_USER_KEY = "aulanomina:auth-user";

export function getAuthToken(storage = null) {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  return target?.getItem(AUTH_TOKEN_KEY) || null;
}

export function getStoredAuthUser(storage = null) {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return null;
  try {
    return JSON.parse(target.getItem(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function storeAuthSession(token, user, storage = null) {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return;
  target.setItem(AUTH_TOKEN_KEY, token);
  target.setItem(AUTH_USER_KEY, JSON.stringify(user || null));
}

export function clearAuthSession(storage = null) {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return;
  target.removeItem(AUTH_TOKEN_KEY);
  target.removeItem(AUTH_USER_KEY);
}

export function withAuthHeaders(headers = {}, storage = null) {
  const token = getAuthToken(storage);
  if (!token) return { ...(headers || {}) };
  return {
    ...(headers || {}),
    Authorization: `Bearer ${token}`,
  };
}
