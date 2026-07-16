import json
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from xml.etree import ElementTree as ET

from sqlalchemy.orm import Session, joinedload

from app.catalogs.cra_codes import CRA_CODE_BY_VALUE
from app.crud.communication_file import serialize_communication_file
from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.communication_submission import CommunicationSubmission
from app.models.company import Company
from app.models.cra import CraConceptMapping
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.models.work_center import WorkCenter
from app.services.communication_file_workflow import (
    CommunicationEventType,
    CommunicationFileStatus,
    CommunicationFileType,
    normalize_ccc,
)
from app.services.siltra_simulation_service import generate_submission_number, next_attempt_number

MONEY = Decimal("0.01")


class CraDomainError(ValueError):
    pass


def as_money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _json_dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _company_cccs(db: Session, company_id: int) -> set[str]:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return set()
    values = {normalize_ccc(company.ccc)}
    for center in db.query(WorkCenter).filter(WorkCenter.company_id == company_id).all():
        values.update({normalize_ccc(center.main_ccc), normalize_ccc(center.general_ccc)})
    return {value for value in values if value}


def _default_mapping_for_concept(concept: PayrollConcept) -> tuple[str, str] | None:
    code = str(concept.code or "").upper()
    name = str(concept.name or "").upper()
    category = str(concept.category or "").upper()

    if concept.concept_type != "DEVENGO" or category == "PRESTACION_IT":
        return None
    if "TELETRABAJO" in code or "TELETRABAJO" in name:
        return "0062", "E"
    if "COMPLEMENTO_IT" in code or ("COMPLEMENTO" in name and "INCAPACIDAD" in name):
        return "0055", "E"
    if "HORAS_COMPLEMENTARIAS_VOLUNTARIAS" in code:
        return "0058", "I"
    if "HORAS_COMPLEMENTARIAS" in code:
        return "0057", "I"
    if "HORAS_EXTRA" in code or category == "HORAS_EXTRA":
        return ("0003", "I") if "FUERZA" in code or "FUERZA" in name else ("0002", "I")
    if "PAGA_EXTRA" in code or "PRORRATA" in code or category == "PAGA_EXTRA":
        return "0004", "I"
    if "VACACIONES_NO_DISFRUTADAS" in code:
        return "0006", "I"
    if "ATRAS" in code or category == "REGULARIZACION":
        return "0008", "I"
    if category in {"BASE", "COMPLEMENTO", "PLUS", "ANTIGUEDAD"}:
        return "0001", "I"
    return None


def ensure_default_cra_mappings(db: Session) -> None:
    existing_ids = {
        row[0]
        for row in db.query(CraConceptMapping.payroll_concept_id).all()
    }
    created = False
    for concept in db.query(PayrollConcept).filter(PayrollConcept.is_active == True).all():
        if concept.id in existing_ids:
            continue
        resolved = _default_mapping_for_concept(concept)
        if not resolved:
            continue
        cra_code, indicator = resolved
        db.add(
            CraConceptMapping(
                payroll_concept_id=concept.id,
                cra_code=cra_code,
                base_indicator=indicator,
                notes="Asignación automática inicial de AulaNomina",
            )
        )
        created = True
    if created:
        db.commit()


def serialize_mapping(mapping: CraConceptMapping) -> dict:
    definition = CRA_CODE_BY_VALUE.get(mapping.cra_code, {})
    return {
        "id": mapping.id,
        "payroll_concept_id": mapping.payroll_concept_id,
        "concept_name": mapping.concept_name,
        "concept_code": mapping.concept_code,
        "concept_type": mapping.concept_type,
        "category": mapping.category,
        "cra_code": mapping.cra_code,
        "cra_name": definition.get("name"),
        "base_indicator": mapping.base_indicator,
        "is_active": mapping.is_active,
        "notes": mapping.notes,
        "created_at": mapping.created_at,
        "updated_at": mapping.updated_at,
    }


def list_cra_mappings(db: Session, include_inactive: bool = True) -> list[dict]:
    ensure_default_cra_mappings(db)
    query = db.query(CraConceptMapping).options(joinedload(CraConceptMapping.payroll_concept))
    if not include_inactive:
        query = query.filter(CraConceptMapping.is_active == True)
    return [serialize_mapping(item) for item in query.order_by(CraConceptMapping.cra_code, CraConceptMapping.id).all()]


def upsert_cra_mapping(
    db: Session,
    payroll_concept_id: int,
    *,
    cra_code: str,
    base_indicator: str,
    is_active: bool,
    notes: str | None,
) -> dict:
    concept = db.query(PayrollConcept).filter(PayrollConcept.id == payroll_concept_id).first()
    if not concept:
        raise CraDomainError("Concepto de nómina no encontrado")
    definition = CRA_CODE_BY_VALUE.get(cra_code)
    if not definition:
        raise CraDomainError("Clave CRA no válida")
    if base_indicator not in definition["allowed_indicators"]:
        allowed = "/".join(definition["allowed_indicators"])
        raise CraDomainError(f"El CRA {cra_code} solo admite indicador {allowed}")

    mapping = (
        db.query(CraConceptMapping)
        .filter(CraConceptMapping.payroll_concept_id == payroll_concept_id)
        .first()
    )
    if not mapping:
        mapping = CraConceptMapping(payroll_concept_id=payroll_concept_id)
        db.add(mapping)
    mapping.cra_code = cra_code
    mapping.base_indicator = base_indicator
    mapping.is_active = is_active
    mapping.notes = notes
    db.commit()
    db.refresh(mapping)
    return serialize_mapping(mapping)


def _payroll_ccc(payroll: Payroll) -> str | None:
    center = payroll.work_center
    if center:
        value = normalize_ccc(center.main_ccc) or normalize_ccc(center.general_ccc)
        if value:
            return value
    return normalize_ccc(payroll.company.ccc if payroll.company else None)


def _fallback_records(payroll: Payroll) -> dict[tuple[str, str], Decimal]:
    records: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
    ordinary = sum(
        as_money(value)
        for value in (
            payroll.worked_base_salary,
            payroll.salary_supplements,
            payroll.seniority_amount,
            payroll.variable_incentives,
        )
    )
    if ordinary > 0:
        records[("0001", "I")] += ordinary
    extra_proration = as_money(payroll.extra_pay_proration)
    if extra_proration > 0:
        records[("0004", "I")] += extra_proration
    it_complement = as_money(payroll.company_disability_complement)
    if it_complement > 0:
        records[("0055", "E")] += it_complement
    return records


def build_cra_preview(db: Session, company_id: int, ccc_id: str, period: str) -> dict:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise CraDomainError("Empresa no encontrada")
    normalized_ccc = normalize_ccc(ccc_id)
    if not normalized_ccc or normalized_ccc not in _company_cccs(db, company_id):
        raise CraDomainError("El CCC no pertenece a la empresa seleccionada")
    try:
        year, month = (int(part) for part in period.split("-"))
    except (AttributeError, TypeError, ValueError) as error:
        raise CraDomainError("Periodo no válido; utiliza AAAA-MM") from error
    if month < 1 or month > 12:
        raise CraDomainError("Periodo no válido; utiliza AAAA-MM")

    ensure_default_cra_mappings(db)
    mappings = {
        mapping.payroll_concept_id: mapping
        for mapping in db.query(CraConceptMapping).filter(CraConceptMapping.is_active == True).all()
    }
    payrolls = (
        db.query(Payroll)
        .options(
            joinedload(Payroll.employee),
            joinedload(Payroll.company),
            joinedload(Payroll.work_center),
            joinedload(Payroll.items).joinedload(PayrollItem.concept),
        )
        .filter(
            Payroll.company_id == company_id,
            Payroll.period_year == year,
            Payroll.period_month == month,
            Payroll.status != "cancelled",
        )
        .order_by(Payroll.employee_id, Payroll.id)
        .all()
    )
    payrolls = [payroll for payroll in payrolls if _payroll_ccc(payroll) == normalized_ccc]

    workers = []
    total = Decimal("0.00")
    record_count = 0
    unmapped: dict[tuple[int, str, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
    warnings: list[str] = []

    for payroll in payrolls:
        record_amounts: dict[tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        positive_devengo_items = 0
        for item in payroll.items:
            concept = item.concept
            amount = as_money(item.amount)
            if not concept or concept.concept_type != "DEVENGO" or amount <= 0:
                continue
            if concept.category == "PRESTACION_IT":
                continue
            positive_devengo_items += 1
            mapping = mappings.get(concept.id)
            if not mapping:
                unmapped[(concept.id, concept.code or "", concept.name)] += amount
                continue
            record_amounts[(mapping.cra_code, mapping.base_indicator)] += amount

        if positive_devengo_items == 0:
            record_amounts.update(_fallback_records(payroll))

        records = []
        worker_total = Decimal("0.00")
        for (cra_code, indicator), amount in sorted(record_amounts.items()):
            amount = as_money(amount)
            if amount <= 0:
                continue
            definition = CRA_CODE_BY_VALUE[cra_code]
            records.append(
                {
                    "cra_code": cra_code,
                    "cra_name": definition["name"],
                    "base_indicator": indicator,
                    "amount": amount,
                    "action": "A",
                }
            )
            worker_total += amount
            record_count += 1

        if not records:
            continue
        employee = payroll.employee
        employee_name = payroll.employee_name or f"Trabajador {payroll.employee_id}"
        naf = employee.naf if employee else None
        if not naf:
            warnings.append(f"{employee_name}: NAF no informado; el fichero se genera igualmente en modo educativo.")
        workers.append(
            {
                "employee_id": payroll.employee_id,
                "employee_name": employee_name,
                "naf": naf,
                "payroll_id": payroll.id,
                "records": records,
                "total_amount": as_money(worker_total),
            }
        )
        total += worker_total

    unmapped_rows = [
        {
            "payroll_concept_id": concept_id,
            "concept_code": concept_code or None,
            "concept_name": concept_name,
            "amount": as_money(amount),
        }
        for (concept_id, concept_code, concept_name), amount in sorted(unmapped.items(), key=lambda item: item[0][2])
    ]
    if unmapped_rows:
        warnings.append("Hay conceptos abonados sin clave CRA. No se incluyen hasta completar su vinculación.")
    if not payrolls:
        warnings.append("No hay nóminas del periodo para el CCC seleccionado.")
    elif not workers:
        warnings.append("Las nóminas encontradas no contienen conceptos CRA comunicables.")

    return {
        "company_id": company.id,
        "company_name": company.name,
        "ccc_id": normalized_ccc,
        "period": period,
        "payroll_count": len(payrolls),
        "worker_count": len(workers),
        "record_count": record_count,
        "total_amount": as_money(total),
        "workers": workers,
        "unmapped_concepts": unmapped_rows,
        "warnings": list(dict.fromkeys(warnings)),
    }


def build_cra_xml(preview: dict) -> str:
    root = ET.Element(
        "CRA",
        {
            "version": "AULANOMINA-EDU-1",
            "simulated": "true",
            "generatedAt": datetime.utcnow().isoformat(timespec="seconds"),
        },
    )
    dde = ET.SubElement(
        root,
        "DDE",
        {
            "companyId": str(preview["company_id"]),
            "companyName": preview["company_name"],
            "ccc": preview["ccc_id"],
            "period": preview["period"],
        },
    )
    for worker in preview["workers"]:
        trb = ET.SubElement(
            dde,
            "TRB",
            {
                "employeeId": str(worker["employee_id"]),
                "name": worker["employee_name"],
                "naf": str(worker.get("naf") or "SIN_NAF"),
                "payrollId": str(worker["payroll_id"]),
            },
        )
        for record in worker["records"]:
            ET.SubElement(
                trb,
                "CRE",
                {
                    "code": record["cra_code"],
                    "indicator": record["base_indicator"],
                    "amount": f"{as_money(record['amount']):.2f}",
                    "action": record["action"],
                },
            )
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def create_cra_file(db: Session, company_id: int, ccc_id: str, period: str, created_by: int | None = None) -> dict:
    preview = build_cra_preview(db, company_id, ccc_id, period)
    if not preview["workers"]:
        raise CraDomainError("No existen registros CRA comunicables para generar el fichero")
    now = datetime.utcnow()
    filename = f"CRA-{preview['ccc_id']}-{period.replace('-', '')}-{now.strftime('%H%M%S')}.xml"
    content = build_cra_xml(preview)
    item = CommunicationFile(
        company_id=company_id,
        ccc_id=preview["ccc_id"],
        period=period,
        file_type=CommunicationFileType.CRA.value,
        status=CommunicationFileStatus.GENERATED.value,
        generated_at=now,
        original_filename=filename,
        content=content,
        file_metadata=_json_dump(
            {
                "format": "AULANOMINA_CRA_XML_V1",
                "educational_simulation": True,
                "payroll_count": preview["payroll_count"],
                "worker_count": preview["worker_count"],
                "record_count": preview["record_count"],
                "total_amount": str(preview["total_amount"]),
                "unmapped_concept_count": len(preview["unmapped_concepts"]),
            }
        ),
        validation_errors="[]",
        created_by=created_by,
    )
    db.add(item)
    db.flush()
    db.add(
        CommunicationFileEvent(
            communication_file=item,
            event_type=CommunicationEventType.GENERATED.value,
            from_status=None,
            to_status=CommunicationFileStatus.GENERATED.value,
            message="Fichero CRA generado desde los conceptos abonados de nómina.",
            details=_json_dump({"worker_count": preview["worker_count"], "record_count": preview["record_count"]}),
            created_by=created_by,
        )
    )
    db.commit()
    db.refresh(item)
    return {"file": serialize_communication_file(item), "preview": preview}


def list_cra_files(db: Session, company_id: int | None = None, period: str | None = None) -> list[dict]:
    query = db.query(CommunicationFile).filter(CommunicationFile.file_type == CommunicationFileType.CRA.value)
    if company_id is not None:
        query = query.filter(CommunicationFile.company_id == company_id)
    if period:
        query = query.filter(CommunicationFile.period == period)
    return [
        serialize_communication_file(item)
        for item in query.order_by(CommunicationFile.created_at.desc(), CommunicationFile.id.desc()).all()
    ]


def send_cra_file(db: Session, communication_file_id: int, created_by: int | None = None) -> dict:
    source = (
        db.query(CommunicationFile)
        .filter(CommunicationFile.id == communication_file_id)
        .with_for_update()
        .first()
    )
    if not source or source.file_type != CommunicationFileType.CRA.value:
        raise CraDomainError("Fichero CRA no encontrado")
    if source.status != CommunicationFileStatus.GENERATED.value:
        raise CraDomainError("Solo puede enviarse un fichero CRA en estado GENERADO")

    now = datetime.utcnow()
    submission = CommunicationSubmission(
        communication_file_id=source.id,
        company_id=source.company_id,
        submission_number=generate_submission_number(db),
        attempt_number=next_attempt_number(db, source.id),
        status=CommunicationFileStatus.ACCEPTED.value,
        submitted_at=now,
        processing_started_at=now,
        processed_at=now,
        response_code="A0000",
        response_message="Fichero CRA recibido y procesado correctamente (simulación educativa).",
        messages="[]",
        created_by=created_by,
    )
    db.add(submission)
    db.flush()

    response_payload = {
        "format": "AULANOMINA_RCA_RESPONSE_V1",
        "educational_simulation": True,
        "submission_number": submission.submission_number,
        "source_file_id": source.id,
        "source_filename": source.original_filename,
        "company_id": source.company_id,
        "ccc_id": source.ccc_id,
        "period": source.period,
        "result": "ACCEPTED",
        "response_code": "A0000",
        "message": submission.response_message,
        "processed_at": now.isoformat(),
    }
    response = CommunicationFile(
        company_id=source.company_id,
        ccc_id=source.ccc_id,
        period=source.period,
        file_type=CommunicationFileType.SILTRA_RESPONSE.value,
        status=CommunicationFileStatus.GENERATED.value,
        generated_at=now,
        original_filename=f"RCA-{submission.submission_number}.json",
        content=json.dumps(response_payload, ensure_ascii=False, indent=2),
        file_metadata=_json_dump({"source_file_id": source.id, "submission_id": submission.id, "cra_response": True}),
        validation_errors="[]",
        created_by=created_by,
    )
    db.add(response)
    db.flush()

    submission.response_file_id = response.id
    source.status = CommunicationFileStatus.ACCEPTED.value
    source.submitted_at = now
    source.processed_at = now
    source.response_code = "A0000"
    source.response_message = submission.response_message
    source.response_file_id = response.id
    db.add(
        CommunicationFileEvent(
            communication_file=source,
            event_type=CommunicationEventType.RESPONSE_LINKED.value,
            from_status=CommunicationFileStatus.GENERATED.value,
            to_status=CommunicationFileStatus.ACCEPTED.value,
            message=f"CRA enviado por SILTRA simulado: {submission.submission_number}.",
            details=_json_dump({"submission_id": submission.id, "response_file_id": response.id}),
            created_by=created_by,
        )
    )
    db.add(
        CommunicationFileEvent(
            communication_file=response,
            event_type=CommunicationEventType.GENERATED.value,
            from_status=None,
            to_status=CommunicationFileStatus.GENERATED.value,
            message="Respuesta RCA simulada generada.",
            details=_json_dump({"submission_id": submission.id, "source_file_id": source.id}),
            created_by=created_by,
        )
    )
    db.commit()
    db.refresh(source)
    db.refresh(submission)
    return {
        "file": serialize_communication_file(source),
        "submission_id": submission.id,
        "submission_number": submission.submission_number,
        "status": submission.status,
        "response_code": submission.response_code,
        "response_message": submission.response_message,
        "response_file_id": response.id,
    }
