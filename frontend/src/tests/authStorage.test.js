import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthSession,
  getAuthToken,
  getStoredAuthUser,
  storeAuthSession,
  withAuthHeaders,
} from "../services/authStorage.js";


class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}


test("persiste token y usuario de la sesión", () => {
  const storage = new MemoryStorage();
  const user = { id: 3, role: "student", student_id: 9, student_name: "Ana Alumno" };

  storeAuthSession("token-demo", user, storage);

  assert.equal(getAuthToken(storage), "token-demo");
  assert.deepEqual(getStoredAuthUser(storage), user);
  assert.equal(storage.getItem(AUTH_TOKEN_KEY), "token-demo");
  assert.ok(storage.getItem(AUTH_USER_KEY));
});


test("añade Authorization sin perder las cabeceras existentes", () => {
  const storage = new MemoryStorage();
  storeAuthSession("token-s44", { id: 1 }, storage);

  assert.deepEqual(withAuthHeaders({ "Content-Type": "application/json" }, storage), {
    "Content-Type": "application/json",
    Authorization: "Bearer token-s44",
  });
});


test("limpia por completo la sesión local", () => {
  const storage = new MemoryStorage();
  storeAuthSession("token-s44", { id: 1 }, storage);

  clearAuthSession(storage);

  assert.equal(getAuthToken(storage), null);
  assert.equal(getStoredAuthUser(storage), null);
});
