import json
from collections import Counter
from datetime import datetime
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET

from sqlalchemy.orm import Session

from app.catalogs.cra_codes import CRA_CODE_BY_VALUE
from app.crud.communication_file import serialize_communication_file
from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.communication_submission import CommunicationSubmission
from app.services.communication_file_workflow import (
    CommunicationEventType,
    CommunicationFileStatus,
    CommunicationFileType,
)
from app.services.cra_service import CraDomainError, build_cra_preview, build_cra_xml
from app.services.siltra_simulation_service import generate_submission_number, next_attempt_number

MAX_CRA_AMOUNT = Decimal("9999999.99")
ALLOWED_ACTIONS = {"A", "M", "B", "C"}
SEND_SCENARIOS = {"AUTO", "WARNINGS", "REJECTED"}
FINAL_CRA_STATUSES = {
    CommunicationFileStatus.ACCEPTED.value,
    CommunicationFileStatus.ACCEPTED_WITH_WARNINGS.value,
    CommunicationFileStatus.REJECTED.value,
}


def _json_dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _json_load(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _message(severity: str, code: str, text: str, **context) -> dict:
    return {
        "severity": severity,
        "code": code,
        "message": text,
        **{key: value for key, value in context.items() if value is not None},
    }


def _record_key(worker: ET.Element, record: ET.Element) -> tuple[str, str, str]:
    worker_key = worker.attrib.get("employeeId") or worker.attrib.get("naf") or "SIN_TRABAJADOR"
    return (
        str(worker_key),
        str(record.attrib.get("code") or ""),
        str(record.attrib.get("indicator") or ""),
    )


def _accepted_record_keys(db: Session, source: CommunicationFile) -> set[tuple[str, str, str]]:
    accepted = (
        db.query(CommunicationFile)
        .filter(
            CommunicationFile.file_type == CommunicationFileType.CRA.value,
            CommunicationFile.company_id == source.company_id,
            CommunicationFile.ccc_id == source.ccc_id,
            CommunicationFile.period == source.period,
            CommunicationFile.id != source.id,
            CommunicationFile.status.in_([
                CommunicationFileStatus.ACCEPTED.value,
                CommunicationFileStatus.ACCEPTED_WITH_WARNINGS.value,
            ]),
        )
        .all()
    )
    keys: set[tuple[str, str, str]] = set()
    for item in accepted:
        try:
            root = ET.fromstring(item.content or "")
        except ET.ParseError:
            continue
        for worker in root.findall(".//TRB"):
            for record in worker.findall("CRE"):
                action = str(record.attrib.get("action") or "A").upper()
                key = _record_key(worker, record)
                if action == "B":
                    keys.discard(key)
                else:
                    keys.add(key)
    return keys


def validate_cra_file(db: Session, source: CommunicationFile) -> list[dict]:
    messages: list[dict] = []
    try:
        root = ET.fromstring(source.content or "")
    except ET.ParseError as error:
        return [_message("ERROR", "RCRA001", f"XML CRA no válido: {error}.")]

    if root.tag != "CRA":
        messages.append(_message("ERROR", "RCRA002", "El elemento raíz debe ser CRA."))

    dde_nodes = root.findall("DDE")
    if not dde_nodes:
        messages.append(_message("ERROR", "RCRA003", "Falta el segmento DDE de empresa, CCC y periodo."))
        return messages

    accepted_keys = _accepted_record_keys(db, source)
    seen_records: Counter[tuple[str, str, str, str]] = Counter()
    total_records = 0

    for dde in dde_nodes:
        ccc = str(dde.attrib.get("ccc") or "")
        period = str(dde.attrib.get("period") or "")
        if ccc != str(source.ccc_id or ""):
            messages.append(_message("ERROR", "RCRA004", "El CCC del XML no coincide con el fichero.", ccc=ccc))
        if period != str(source.period or ""):
            messages.append(_message("ERROR", "RCRA005", "El periodo del XML no coincide con el fichero.", period=period))
        if ccc and (not ccc.isdigit() or len(ccc) != 11):
            messages.append(_message(
                "WARNING",
                "WCRA001",
                "El CCC no tiene el formato oficial de 11 dígitos; se admite únicamente para la simulación educativa.",
                ccc=ccc,
            ))

        workers = dde.findall("TRB")
        if not workers:
            messages.append(_message("ERROR", "RCRA006", "El segmento DDE no contiene trabajadores TRB."))

        for worker in workers:
            naf = str(worker.attrib.get("naf") or "")
            employee_id = worker.attrib.get("employeeId")
            employee_name = worker.attrib.get("name")
            if not naf or naf == "SIN_NAF" or not naf.isdigit() or len(naf) != 12:
                messages.append(_message(
                    "ERROR",
                    "RCRA007",
                    "El NAF es obligatorio y debe contener 12 dígitos.",
                    employee_id=employee_id,
                    employee_name=employee_name,
                    naf=naf or None,
                ))

            records = worker.findall("CRE")
            if not records:
                messages.append(_message(
                    "ERROR",
                    "RCRA008",
                    "El trabajador no contiene conceptos retributivos CRE.",
                    employee_id=employee_id,
                    employee_name=employee_name,
                ))

            for record in records:
                total_records += 1
                code = str(record.attrib.get("code") or "").zfill(4)
                indicator = str(record.attrib.get("indicator") or "").upper()
                action = str(record.attrib.get("action") or "A").upper()
                amount_text = str(record.attrib.get("amount") or "")
                key = _record_key(worker, record)
                seen_records[(*key, action)] += 1

                definition = CRA_CODE_BY_VALUE.get(code)
                if not definition:
                    messages.append(_message("ERROR", "RCRA009", "La clave CRA no existe en el catálogo.", cra_code=code, employee_id=employee_id))
                elif indicator not in definition["allowed_indicators"]:
                    allowed = "/".join(definition["allowed_indicators"])
                    messages.append(_message(
                        "ERROR",
                        "RCRA010",
                        f"La clave CRA {code} solo admite indicador {allowed}.",
                        cra_code=code,
                        indicator=indicator,
                        employee_id=employee_id,
                    ))

                if action not in ALLOWED_ACTIONS:
                    messages.append(_message("ERROR", "RCRA011", "Tipo de actuación CRA no válido.", action=action, employee_id=employee_id))

                try:
                    amount = Decimal(amount_text)
                except (InvalidOperation, ValueError):
                    messages.append(_message("ERROR", "RCRA012", "El importe CRA no es numérico.", amount=amount_text, employee_id=employee_id))
                    continue

                if amount < 0:
                    messages.append(_message("ERROR", "RCRA013", "Los registros CRA no admiten importes negativos.", amount=amount_text, employee_id=employee_id))
                if action == "B" and amount != 0:
                    messages.append(_message("WARNING", "WCRA002", "Una baja CRA debería dejar el concepto sin importe.", amount=amount_text, employee_id=employee_id))
                elif action != "B" and amount <= 0:
                    messages.append(_message("ERROR", "RCRA014", "El importe debe ser mayor que cero salvo en una baja.", amount=amount_text, employee_id=employee_id))
                if amount > MAX_CRA_AMOUNT:
                    messages.append(_message(
                        "WARNING",
                        "WCRA003",
                        "El importe supera 9.999.999,99; en un envío real debe fraccionarse mediante registros de complemento C.",
                        amount=amount_text,
                        employee_id=employee_id,
                    ))

                if action == "A" and key in accepted_keys:
                    messages.append(_message(
                        "ERROR",
                        "RCRA015",
                        "El concepto ya fue aceptado. Debe rectificarse con M, B o C en lugar de un nuevo alta.",
                        employee_id=employee_id,
                        cra_code=code,
                    ))
                if action in {"M", "B", "C"} and key not in accepted_keys:
                    messages.append(_message(
                        "ERROR",
                        "RCRA016",
                        f"La actuación {action} requiere un concepto CRA aceptado previamente.",
                        employee_id=employee_id,
                        cra_code=code,
                    ))

    if total_records == 0:
        messages.append(_message("ERROR", "RCRA017", "El fichero no contiene registros CRA."))

    for (worker_key, code, indicator, action), count in seen_records.items():
        if count > 1:
            messages.append(_message(
                "WARNING",
                "WCRA004",
                "Hay registros idénticos repetidos dentro del mismo fichero.",
                worker_key=worker_key,
                cra_code=code,
                indicator=indicator,
                action=action,
                occurrences=count,
            ))

    metadata = _json_load(source.file_metadata, {})
    if int(metadata.get("unmapped_concept_count") or 0) > 0:
        messages.append(_message(
            "WARNING",
            "WCRA005",
            "Existen conceptos abonados sin vinculación CRA y no se han incluido en el fichero.",
            count=int(metadata.get("unmapped_concept_count") or 0),
        ))
    if metadata.get("replacement_of_file_id"):
        messages.append(_message(
            "INFO",
            "ICRA001",
            "El fichero es una comunicación correctora vinculada a un envío anterior.",
            replacement_of_file_id=metadata.get("replacement_of_file_id"),
        ))

    return messages


def determine_cra_result(messages: list[dict], scenario: str = "AUTO") -> tuple[str, str, str, list[dict]]:
    normalized = str(scenario or "AUTO").strip().upper()
    if normalized not in SEND_SCENARIOS:
        raise CraDomainError("Escenario de validación CRA no válido")

    result_messages = [dict(item) for item in messages]
    if normalized == "WARNINGS" and not any(item.get("severity") == "ERROR" for item in result_messages):
        result_messages.append(_message(
            "WARNING",
            "WCRA900",
            "Escenario didáctico: SILTRA devuelve aceptación con avisos para practicar su revisión.",
        ))
    elif normalized == "REJECTED":
        result_messages.append(_message(
            "ERROR",
            "RCRA900",
            "Escenario didáctico: SILTRA rechaza el fichero para practicar la corrección y el reenvío.",
        ))

    errors = [item for item in result_messages if item.get("severity") == "ERROR"]
    warnings = [item for item in result_messages if item.get("severity") == "WARNING"]
    if errors:
        return (
            CommunicationFileStatus.REJECTED.value,
            "R1000",
            f"Fichero CRA rechazado: {len(errors)} error(es) y {len(warnings)} aviso(s).",
            result_messages,
        )
    if warnings:
        return (
            CommunicationFileStatus.ACCEPTED_WITH_WARNINGS.value,
            "W1000",
            f"Fichero CRA aceptado con {len(warnings)} aviso(s).",
            result_messages,
        )
    return (
        CommunicationFileStatus.ACCEPTED.value,
        "A0000",
        "Fichero CRA recibido y procesado correctamente.",
        result_messages,
    )


def send_cra_file_with_validation(
    db: Session,
    communication_file_id: int,
    *,
    created_by: int | None = None,
    scenario: str = "AUTO",
) -> dict:
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

    messages = validate_cra_file(db, source)
    status, response_code, response_message, messages = determine_cra_result(messages, scenario)
    now = datetime.utcnow()
    submission = CommunicationSubmission(
        communication_file_id=source.id,
        company_id=source.company_id,
        submission_number=generate_submission_number(db),
        attempt_number=next_attempt_number(db, source.id),
        status=status,
        submitted_at=now,
        processing_started_at=now,
        processed_at=now,
        response_code=response_code,
        response_message=response_message,
        messages=_json_dump(messages),
        created_by=created_by,
    )
    db.add(submission)
    db.flush()

    metadata = _json_load(source.file_metadata, {})
    summary = Counter(item.get("severity") for item in messages)
    response_payload = {
        "format": "AULANOMINA_RCA_RESPONSE_V2",
        "educational_simulation": True,
        "submission_number": submission.submission_number,
        "source_file_id": source.id,
        "source_filename": source.original_filename,
        "company_id": source.company_id,
        "ccc_id": source.ccc_id,
        "period": source.period,
        "result": status,
        "response_code": response_code,
        "message": response_message,
        "messages": messages,
        "summary": {
            "errors": summary.get("ERROR", 0),
            "warnings": summary.get("WARNING", 0),
            "information": summary.get("INFO", 0),
        },
        "replacement_of_file_id": metadata.get("replacement_of_file_id"),
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
        file_metadata=_json_dump({
            "source_file_id": source.id,
            "submission_id": submission.id,
            "cra_response": True,
            "result": status,
        }),
        validation_errors="[]",
        created_by=created_by,
    )
    db.add(response)
    db.flush()

    submission.response_file_id = response.id
    source.status = status
    source.submitted_at = now
    source.processed_at = now
    source.response_code = response_code
    source.response_message = response_message
    source.response_file_id = response.id
    source.validation_errors = _json_dump(messages)
    metadata.update({
        "last_submission_id": submission.id,
        "last_submission_number": submission.submission_number,
        "last_validation_scenario": str(scenario or "AUTO").upper(),
        "validation_summary": response_payload["summary"],
    })
    source.file_metadata = _json_dump(metadata)

    db.add(CommunicationFileEvent(
        communication_file=source,
        event_type=CommunicationEventType.RESPONSE_LINKED.value,
        from_status=CommunicationFileStatus.GENERATED.value,
        to_status=status,
        message=f"CRA procesado por SILTRA simulado: {submission.submission_number} ({status}).",
        details=_json_dump({
            "submission_id": submission.id,
            "response_file_id": response.id,
            "response_code": response_code,
            "validation_summary": response_payload["summary"],
        }),
        created_by=created_by,
    ))
    db.add(CommunicationFileEvent(
        communication_file=response,
        event_type=CommunicationEventType.GENERATED.value,
        from_status=None,
        to_status=CommunicationFileStatus.GENERATED.value,
        message="Respuesta RCA simulada generada.",
        details=_json_dump({"submission_id": submission.id, "source_file_id": source.id}),
        created_by=created_by,
    ))
    db.commit()
    db.refresh(source)
    db.refresh(submission)
    return {
        "file": serialize_communication_file(source),
        "submission_id": submission.id,
        "submission_number": submission.submission_number,
        "status": status,
        "response_code": response_code,
        "response_message": response_message,
        "messages": messages,
        "response_file_id": response.id,
        "can_create_substitute": status in FINAL_CRA_STATUSES,
    }


def create_cra_substitute(
    db: Session,
    communication_file_id: int,
    *,
    created_by: int | None = None,
) -> dict:
    source = db.query(CommunicationFile).filter(CommunicationFile.id == communication_file_id).first()
    if not source or source.file_type != CommunicationFileType.CRA.value:
        raise CraDomainError("Fichero CRA no encontrado")
    if source.status not in FINAL_CRA_STATUSES:
        raise CraDomainError("La comunicación correctora solo puede partir de un fichero ya procesado")

    for candidate in db.query(CommunicationFile).filter(CommunicationFile.file_type == CommunicationFileType.CRA.value).all():
        candidate_metadata = _json_load(candidate.file_metadata, {})
        if (
            int(candidate_metadata.get("replacement_of_file_id") or 0) == source.id
            and candidate.status in {
                CommunicationFileStatus.GENERATED.value,
                CommunicationFileStatus.SENT.value,
                CommunicationFileStatus.PROCESSING.value,
            }
        ):
            raise CraDomainError("Ya existe una comunicación correctora pendiente para este fichero")

    preview = build_cra_preview(db, source.company_id, source.ccc_id, source.period)
    if not preview["workers"]:
        raise CraDomainError("No existen registros CRA comunicables para crear la corrección")

    action = "A" if source.status == CommunicationFileStatus.REJECTED.value else "M"
    for worker in preview["workers"]:
        for record in worker["records"]:
            record["action"] = action

    content = build_cra_xml(preview)
    root = ET.fromstring(content)
    root.set("communicationType", "CORRECTIVE")
    root.set("replacementOf", str(source.id))
    root.set("actionMode", action)
    ET.indent(root, space="  ")
    content = ET.tostring(root, encoding="unicode", xml_declaration=True)

    now = datetime.utcnow()
    filename = f"CRA-CORR-{source.ccc_id}-{source.period.replace('-', '')}-{now.strftime('%H%M%S')}.xml"
    item = CommunicationFile(
        company_id=source.company_id,
        ccc_id=source.ccc_id,
        period=source.period,
        file_type=CommunicationFileType.CRA.value,
        status=CommunicationFileStatus.GENERATED.value,
        generated_at=now,
        original_filename=filename,
        content=content,
        file_metadata=_json_dump({
            "format": "AULANOMINA_CRA_XML_V2",
            "educational_simulation": True,
            "communication_kind": "CORRECTIVE",
            "replacement_of_file_id": source.id,
            "source_status": source.status,
            "action_mode": action,
            "payroll_count": preview["payroll_count"],
            "worker_count": preview["worker_count"],
            "record_count": preview["record_count"],
            "total_amount": str(preview["total_amount"]),
            "unmapped_concept_count": len(preview["unmapped_concepts"]),
        }),
        validation_errors="[]",
        created_by=created_by,
    )
    db.add(item)
    db.flush()

    source_metadata = _json_load(source.file_metadata, {})
    source_metadata["superseded_by_file_id"] = item.id
    source.file_metadata = _json_dump(source_metadata)
    db.add(CommunicationFileEvent(
        communication_file=item,
        event_type=CommunicationEventType.GENERATED.value,
        from_status=None,
        to_status=CommunicationFileStatus.GENERATED.value,
        message=f"Comunicación CRA correctora generada desde el fichero {source.id}.",
        details=_json_dump({
            "replacement_of_file_id": source.id,
            "source_status": source.status,
            "action_mode": action,
        }),
        created_by=created_by,
    ))
    db.add(CommunicationFileEvent(
        communication_file=source,
        event_type=CommunicationEventType.UPDATED.value,
        from_status=source.status,
        to_status=source.status,
        message=f"Se ha generado la comunicación correctora {item.id}.",
        details=_json_dump({"superseded_by_file_id": item.id}),
        created_by=created_by,
    ))
    db.commit()
    db.refresh(item)
    db.refresh(source)
    return {
        "file": serialize_communication_file(item),
        "source_file": serialize_communication_file(source),
        "preview": preview,
        "action_mode": action,
    }
