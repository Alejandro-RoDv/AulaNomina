from decimal import Decimal

from pydantic import BaseModel

from app.schemas.payroll_salary_structure import PayrollItemResponse


class PayrollBreakdownResponse(BaseModel):
    payroll_id: int
    devengos_salariales: list[PayrollItemResponse] = []
    devengos_extrasalariales: list[PayrollItemResponse] = []
    prorratas_automaticas: list[PayrollItemResponse] = []
    antiguedad_automatica: list[PayrollItemResponse] = []
    regularizaciones_automaticas: list[PayrollItemResponse] = []
    deducciones: list[PayrollItemResponse] = []
    bases_informativas: list[PayrollItemResponse] = []
    total_devengos: Decimal = Decimal("0.00")
    total_prorrata_automatica: Decimal = Decimal("0.00")
    total_antiguedad_automatica: Decimal = Decimal("0.00")
    total_regularizacion_automatica: Decimal = Decimal("0.00")
    total_deducciones: Decimal = Decimal("0.00")
    base_irpf_manual: Decimal = Decimal("0.00")
    irpf_percentage: Decimal = Decimal("0.00")
    irpf_manual: Decimal = Decimal("0.00")
    neto_manual: Decimal = Decimal("0.00")
    neto_manual_con_irpf: Decimal = Decimal("0.00")
