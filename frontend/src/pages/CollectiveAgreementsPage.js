import CollectiveAgreementsPage, {
  preloadCollectiveAgreementsWorkspace,
} from "./CollectiveAgreementsPage.jsx";

// El workspace se descarga en segundo plano después del primer render general.
// La importación dinámica sigue separada del bundle inicial, pero normalmente
// ya está disponible cuando el usuario abre Convenios por primera vez.
if (typeof window !== "undefined") {
  const preload = () => {
    preloadCollectiveAgreementsWorkspace().catch(() => {
      // El propio Suspense volverá a intentar la carga al abrir el módulo.
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(preload, { timeout: 800 });
  } else {
    window.setTimeout(preload, 300);
  }
}

export default CollectiveAgreementsPage;
