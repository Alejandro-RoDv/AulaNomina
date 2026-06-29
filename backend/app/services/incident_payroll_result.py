from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Any, Mapping


def deep_freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({key: deep_freeze(item) for key, item in value.items()})
    if isinstance(value, list | tuple):
        return tuple(deep_freeze(item) for item in value)
    if isinstance(value, set | frozenset):
        return frozenset(deep_freeze(item) for item in value)
    return value


def deep_thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: deep_thaw(item) for key, item in value.items()}
    if isinstance(value, tuple | frozenset):
        return [deep_thaw(item) for item in value]
    return value


@dataclass(frozen=True)
class PayrollComponentAdjustment:
    field: str
    original_amount: Decimal
    factor: Decimal
    adjusted_amount: Decimal
    reduction_amount: Decimal

    def to_dict(self) -> dict[str, Any]:
        return {
            "field": self.field,
            "original_amount": str(self.original_amount),
            "factor": str(self.factor),
            "adjusted_amount": str(self.adjusted_amount),
            "reduction_amount": str(self.reduction_amount),
        }


@dataclass(frozen=True)
class IncidentPayrollCalculationResult:
    payroll_id: int
    incident_ids: tuple[int, ...]
    segment_result: Mapping[str, Any]
    component_adjustments: tuple[PayrollComponentAdjustment, ...]
    payroll_amounts: Mapping[str, Decimal | int]
    incident_amounts: tuple[tuple[int, Decimal], ...]

    @classmethod
    def create(
        cls,
        *,
        payroll_id: int,
        incident_ids: list[int],
        segment_result: dict[str, Any],
        component_adjustments: list[PayrollComponentAdjustment],
        payroll_amounts: dict[str, Decimal | int],
        incident_amounts: dict[int, Decimal],
    ) -> "IncidentPayrollCalculationResult":
        return cls(
            payroll_id=payroll_id,
            incident_ids=tuple(incident_ids),
            segment_result=deep_freeze(segment_result),
            component_adjustments=tuple(component_adjustments),
            payroll_amounts=deep_freeze(payroll_amounts),
            incident_amounts=tuple(sorted(incident_amounts.items())),
        )

    def segment_payload(self) -> dict[str, Any]:
        return deep_thaw(self.segment_result)

    def payroll_amount_payload(self) -> dict[str, Decimal | int]:
        return dict(self.payroll_amounts)

    def incident_amount_map(self) -> dict[int, Decimal]:
        return dict(self.incident_amounts)

    def adjusted_component_map(self) -> dict[str, Decimal]:
        return {
            adjustment.field: adjustment.adjusted_amount
            for adjustment in self.component_adjustments
        }

    def preview_payload(self) -> dict[str, Any]:
        return {
            "payroll_id": self.payroll_id,
            **self.segment_payload(),
            "component_adjustments": [
                adjustment.to_dict() for adjustment in self.component_adjustments
            ],
            "adjusted_components": self.adjusted_component_map(),
        }
