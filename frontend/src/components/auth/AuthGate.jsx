import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";

import {
  fetchAuthConfig,
  fetchMe,
  getAuthToken,
  getStoredAuthUser,
  login,
  logout,
} from "../../services/authApi.js";
import "./authGate.css";


export default function AuthGate({ children }) {
  const [config, setConfig] = useState(null);
  const [user, setUser] = useState(() => getStoredAuthUser());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextConfig = await fetchAuthConfig();
      setConfig(nextConfig);
      if (getAuthToken()) {
        try {
          const current = await fetchMe();
          setUser(current);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (requestError) {
      setError(requestError.message || "No se ha podido comprobar el acceso a AulaNomina.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleExpired = () => setUser(null);
    const handleChanged = (event) => setUser(event.detail || getStoredAuthUser());
    window.addEventListener("aulanomina-auth-expired", handleExpired);
    window.addEventListener("aulanomina-auth-changed", handleChanged);
    return () => {
      window.removeEventListener("aulanomina-auth-expired", handleExpired);
      window.removeEventListener("aulanomina-auth-changed", handleChanged);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Introduce el correo y la contraseña.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const loggedUser = await login(email.trim(), password);
      setUser(loggedUser);
      setPassword("");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    try {
      await logout();
      setUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-gate auth-gate--loading">
        <div className="auth-gate__loading-card">
          <ShieldCheck size={24} aria-hidden="true" />
          <strong>Preparando AulaNomina…</strong>
          <span>Comprobando el entorno formativo.</span>
        </div>
      </div>
    );
  }

  if (!config && error) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__card">
          <span className="auth-gate__eyebrow">AulaNomina</span>
          <h1>No se puede comprobar el acceso</h1>
          <p>{error}</p>
          <button type="button" className="auth-gate__primary" onClick={initialize}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (config?.required && !user) {
    return (
      <div className="auth-gate">
        <main className="auth-gate__card" aria-labelledby="aulanomina-login-title">
          <div className="auth-gate__brand-mark" aria-hidden="true">AN</div>
          <span className="auth-gate__eyebrow">Entorno formativo</span>
          <h1 id="aulanomina-login-title">Accede a AulaNomina</h1>
          <p>Tu progreso, actividades, intentos y correo se guardan en tu entorno personal.</p>

          <form className="auth-gate__form" onSubmit={handleSubmit}>
            <label>
              <span>Correo</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
            </label>
            {error && <div className="auth-gate__error" role="alert">{error}</div>}
            <button type="submit" className="auth-gate__primary" disabled={submitting}>
              <LogIn size={17} aria-hidden="true" />
              {submitting ? "Accediendo…" : "Entrar al curso"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <>
      {children}
      {user && (
        <div className="auth-session-badge" aria-label="Sesión de AulaNomina">
          <span className="auth-session-badge__icon"><ShieldCheck size={15} aria-hidden="true" /></span>
          <span className="auth-session-badge__copy">
            <strong>{user.student_name || user.email}</strong>
            <small>{user.role === "student" ? "Alumno" : user.role}</small>
          </span>
          <button type="button" onClick={handleLogout} disabled={submitting} title="Cerrar sesión">
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
