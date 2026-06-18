import { useEffect, useMemo, useRef, useState } from "react";

import { fetchCollectiveAgreement } from "../services/collectiveAgreementApi";

export function useAgreementWorkspace({
  collectiveAgreements = [],
  onAgreementListChanged,
  onDataChanged,
}) {
  const [selectedId, setSelectedId] = useState("");
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const selected = useMemo(() => {
    if (!collectiveAgreements.length) return null;
    if (selectedId) {
      return collectiveAgreements.find((item) => String(item.id) === String(selectedId)) || null;
    }
    return collectiveAgreements[0];
  }, [collectiveAgreements, selectedId]);

  const selectedAgreement = agreement && selected?.id && String(agreement.id) === String(selected.id)
    ? agreement
    : null;

  function selectAgreement(agreementId) {
    requestIdRef.current += 1;
    setAgreement(null);
    setError("");
    setLoading(Boolean(agreementId));
    setSelectedId(agreementId ? String(agreementId) : "");
  }

  async function loadAgreement(agreementId, showLoading = true) {
    if (!agreementId) {
      setAgreement(null);
      setLoading(false);
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showLoading) setLoading(true);
    setError("");

    try {
      const data = await fetchCollectiveAgreement(agreementId);
      if (requestId !== requestIdRef.current) return null;
      setAgreement(data);
      return data;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      setAgreement(null);
      setError(err.message || "No se pudo cargar el convenio.");
      return null;
    } finally {
      if (showLoading && requestId === requestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!selected?.id) {
      if (!selectedId) setLoading(false);
      return undefined;
    }

    let active = true;
    const agreementId = selected.id;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    fetchCollectiveAgreement(agreementId)
      .then((data) => {
        if (!active || requestId !== requestIdRef.current) return;
        setAgreement(data);
        setError("");
      })
      .catch((err) => {
        if (!active || requestId !== requestIdRef.current) return;
        setAgreement(null);
        setError(err.message || "No se pudo cargar el convenio.");
      })
      .finally(() => {
        if (active && requestId === requestIdRef.current) setLoading(false);
      });

    return () => { active = false; };
  }, [selected?.id, selectedId]);

  async function refreshAgreement({ agreementId, refreshList = false } = {}) {
    const targetAgreementId = agreementId || selected?.id;
    if (refreshList) {
      if (onAgreementListChanged) await onAgreementListChanged();
      else await onDataChanged?.("collective-agreements");

      if (targetAgreementId && String(targetAgreementId) !== String(selected?.id)) {
        selectAgreement(targetAgreementId);
        return null;
      }
    }
    return loadAgreement(targetAgreementId, false);
  }

  function retryAgreement() {
    return loadAgreement(selected?.id, true);
  }

  const isLoading = loading || Boolean((selectedId || selected?.id) && !selectedAgreement && !error);

  return {
    selected,
    selectedId,
    setSelectedId: selectAgreement,
    agreement: selectedAgreement,
    loading: isLoading,
    error,
    refreshAgreement,
    retryAgreement,
  };
}
