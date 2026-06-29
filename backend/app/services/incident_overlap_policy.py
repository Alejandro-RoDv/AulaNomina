from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from app.models.incident import Incident


INCIDENT_PRIORITY = {
    "SANCION": 1000,
    "SUSPENSION": 950,
    "IT": 900,
    "RECAIDA": 900,
    "NACIMIENTO_CUIDADO": 900,
    "RIESGO_EMBARAZO": 900,
    "RIESGO_LACTANCIA": 900,
    "CUIDADO_MENOR": 900,
    "PERMISO_NO_RETRIBUIDO": 800,
    "AUSENCIA": 800,
    "VACACIONES": 700,
    "PERMISO_RETRIBUIDO": 700,
}

COMBINABLE_INCIDENT_TYPES = {"HORAS_EXTRA"}
COMPATIBLE_PRIMARY_PAIRS: set[frozenset[str]] = set()


def incident_priority(incident: Incident) -> int:
    return INCIDENT_PRIORITY.get(incident.incident_type, 500)


def primary_incidents(incidents: list[Incident]) -> list[Incident]:
    return [
        incident
        for incident in incidents
        if not incident.is_cancelled
        and incident.incident_type not in COMBINABLE_INCIDENT_TYPES
    ]


def pair_is_compatible(left: Incident, right: Incident) -> bool:
    return frozenset({left.incident_type, right.incident_type}) in COMPATIBLE_PRIMARY_PAIRS


@dataclass(frozen=True)
class IncidentOverlapConflict:
    start_date: date
    end_date: date
    incident_ids: tuple[int, ...]
    incident_types: tuple[str, ...]
    priorities: tuple[int, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "incident_ids": list(self.incident_ids),
            "incident_types": list(self.incident_types),
            "priorities": list(self.priorities),
        }


class IncidentOverlapConflictError(ValueError):
    def __init__(self, conflicts: list[IncidentOverlapConflict]):
        self.conflicts = tuple(conflicts)
        super().__init__(
            "Existen incidencias salariales incompatibles en los mismos días. "
            "Resuelva los solapamientos antes de calcular la nómina."
        )

    def detail(self) -> dict[str, Any]:
        return {
            "code": "incident_overlap_conflict",
            "message": str(self),
            "conflicts": [conflict.to_dict() for conflict in self.conflicts],
        }


def _date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _active_on(incidents: list[Incident], current: date) -> list[Incident]:
    active = [
        incident
        for incident in incidents
        if incident.start_date <= current <= (incident.end_date or current)
    ]
    active.sort(key=lambda incident: (-incident_priority(incident), incident.start_date, incident.id))
    return active


def _has_incompatible_pair(active: list[Incident]) -> bool:
    for index, left in enumerate(active):
        for right in active[index + 1:]:
            if not pair_is_compatible(left, right):
                return True
    return False


def find_incident_overlap_conflicts(
    incidents: list[Incident],
    period_start: date,
    period_end: date,
) -> list[IncidentOverlapConflict]:
    candidates = primary_incidents(incidents)
    daily: list[tuple[date, tuple[Incident, ...]]] = []
    for current in _date_range(period_start, period_end):
        active = _active_on(candidates, current)
        if len(active) > 1 and _has_incompatible_pair(active):
            daily.append((current, tuple(active)))

    conflicts: list[IncidentOverlapConflict] = []
    for current, active in daily:
        ids = tuple(incident.id for incident in active)
        types = tuple(incident.incident_type for incident in active)
        priorities = tuple(incident_priority(incident) for incident in active)
        if (
            conflicts
            and conflicts[-1].incident_ids == ids
            and conflicts[-1].end_date + timedelta(days=1) == current
        ):
            previous = conflicts[-1]
            conflicts[-1] = IncidentOverlapConflict(
                start_date=previous.start_date,
                end_date=current,
                incident_ids=ids,
                incident_types=types,
                priorities=priorities,
            )
        else:
            conflicts.append(IncidentOverlapConflict(
                start_date=current,
                end_date=current,
                incident_ids=ids,
                incident_types=types,
                priorities=priorities,
            ))
    return conflicts


def validate_incident_overlaps(
    incidents: list[Incident],
    period_start: date,
    period_end: date,
) -> None:
    conflicts = find_incident_overlap_conflicts(incidents, period_start, period_end)
    if conflicts:
        raise IncidentOverlapConflictError(conflicts)
