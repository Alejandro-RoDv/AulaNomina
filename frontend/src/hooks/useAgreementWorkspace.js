import { useEffect, useMemo, useState } from "react";

import { fetchCollectiveAgreement } from "../services/collectiveAgreementApi";

export function useAgreementWorkspace({ collectiveAgreements = [], onDataChanged }) {
  const [selectedId, setSelectedId] = useState("");
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => {
    if (!collectiveAgreements.length) return null;
    return collectiveAgreements.find((item) => String(item.id) === String(selectedId)) || collectiveAgreements[0];
  }, [collectiveAgreements, selectedId]);

  async function loadAgreement(agreementId, showLoading = true) {
    if (!agreementId) {
      setAgreement(null);
      return null;
    }
    if (showLoading) setLoading(true);
    setError("");
    try {
      const data = await fetchCollectiveAgreement(agreementId);
      setAgreement(data);
      return data;
    } catch (err) {
      setAgreement(null);
      setError(err.message || "No se pudo cargar el convenio.");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!selected?.id) {
      setAgreement(null);
      setLoading(false);
      return () => { active = false; };
    }
    setAgreement(null);
    setLoading(true);
    setError("");
    fetchCollectiveAgreement(selected.id)
      .then((data) => active && setAgreement(data))
      .catch((err) => {
        if (!active) return;
        setAgreement(null);
        setError(err.message || "No se pudo cargar el convenio.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selected?.id]);

  async function refreshAgreement({ agreementId, refreshList = false } = {}) {
    const targetAgreementId = agreementId || selected?.id;
    if (refreshList) {
      await onDataChanged?.();
      if (targetAgreementId && String(targetAgreementId) !== String(selected?.id)) {
        setSelectedId(String(targetAgreementId));
        return null;
      }
    }
    return loadAgreement(targetAgreementId, false);
  }

  return { selected, selectedId, setSelectedId, agreement, loading, error, refreshAgreement };
}
