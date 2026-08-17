from __future__ import annotations

from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import zipfile

from app.models.mail import EmailAttachment
from app.services.mail_service import DEMO_ATTACHMENT_CONTENT, render_attachment_bytes


XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def attachment_preview(attachment: EmailAttachment) -> dict:
    content_text = attachment.content_text or DEMO_ATTACHMENT_CONTENT.get(
        attachment.document_type,
        f"Documento simulado: {attachment.filename}",
    )
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "document_type": attachment.document_type,
        "content_text": content_text,
        "linked_document_id": attachment.linked_document_id,
        "preview_supported": True,
    }


def _xlsx_bytes(text: str) -> bytes:
    rows = []
    for line in text.splitlines():
        separator = ";" if ";" in line else ","
        rows.append([cell.strip() for cell in line.split(separator)])
    if not rows:
        rows = [["Documento simulado"]]

    sheet_rows = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            column = chr(64 + min(column_index, 26))
            cells.append(
                f'<c r="{column}{row_index}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'
            )
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>'
    )
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>",
        )
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return buffer.getvalue()


def attachment_download(attachment: EmailAttachment) -> tuple[bytes, str]:
    preview = attachment_preview(attachment)
    text = preview["content_text"]
    filename = attachment.filename or "documento.txt"
    suffix = Path(filename).suffix.lower()
    content_type = (attachment.content_type or "").lower()

    if suffix == ".xlsx" or content_type == XLSX_MEDIA_TYPE:
        return _xlsx_bytes(text), XLSX_MEDIA_TYPE
    if suffix == ".xml" or content_type in {"application/xml", "text/xml"}:
        xml = f"<aulanomina-document><content>{escape(text)}</content></aulanomina-document>"
        return xml.encode("utf-8"), "application/xml"
    if suffix == ".csv" or content_type == "text/csv":
        return text.encode("utf-8"), "text/csv; charset=utf-8"

    payload = render_attachment_bytes(attachment)
    if suffix == ".pdf" or content_type == "application/pdf":
        return payload, "application/pdf"
    if suffix == ".docx" or "wordprocessingml" in content_type:
        return payload, DOCX_MEDIA_TYPE
    return payload, attachment.content_type or "text/plain; charset=utf-8"
