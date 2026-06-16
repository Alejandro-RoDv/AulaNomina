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

  const selectedAgreement = agreement && selected?.id && String(agreement.id) === String(selected.id)
    ? agreement
    : null;

  function selectAgreement(agreementId) {
    setAgreement(null);
    setError("");
    setLoading(Boolean(agreementId));
    setSelectedId(agreementId ? String(agreementId) : "");
  }

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
    if (!selected?.id) return undefined;

    let active = true;
    const agreementId = selected.id;

    fetchCollectiveAgreement(agreementId)
      .then((data) => {
        if (!active) return;
        setAgreement(data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setAgreement(null);
        setError(err.message || "No se pudo cargar el convenio.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selected?.id]);

  async function refreshAgreement({ agreementId, refreshList = false } = {}) {
    const targetAgreementId = agreementId || selected?.id;
    if (refreshList) {
      await onDataChanged?.();
      if (targetAgreementId && String(targetAgreementId) !== String(selected?.id)) {
        selectAgreement(targetAgreementId);
        return null;
      }
    }
    return loadAgreement(targetAgreementId, false);
  }

  const isLoading = loading || Boolean(selected?.id && !selectedAgreement && !error);

  return {
    selected,
    selectedId,
    setSelectedId: selectAgreement,
    agreement: selectedAgreement,
    loading: isLoading,
    error,
    refreshAgreement,
  };
}
