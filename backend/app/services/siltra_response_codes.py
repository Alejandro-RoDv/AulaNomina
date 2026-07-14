from enum import Enum


class CommunicationSubmissionStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    PROCESSING = "PROCESSING"
    ACCEPTED = "ACCEPTED"
    ACCEPTED_WITH_WARNINGS = "ACCEPTED_WITH_WARNINGS"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


RESPONSE_CODES: dict[str, dict[str, str]] = {
    "A0000": {"severity": "INFO", "message": "Fichero procesado correctamente."},
    "A0001": {"severity": "INFO", "message": "Fichero aceptado y registrado."},
    "W9601": {"severity": "WARNING", "message": "Nómina pendiente de revisión."},
    "W9602": {"severity": "WARNING", "message": "Diferencia de redondeo detectada."},
    "W9603": {"severity": "WARNING", "message": "Trabajador con cero días y bases positivas."},
    "W9604": {"severity": "WARNING", "message": "Fichero presentado anteriormente."},
    "W9605": {"severity": "WARNING", "message": "Fecha de cálculo anterior al periodo de envío."},
    "W9606": {"severity": "WARNING", "message": "Metadatos no esenciales incompletos."},
    "R9501": {"severity": "ERROR", "message": "El NAF es obligatorio."},
    "R9502": {"severity": "ERROR", "message": "El CCC no es válido."},
    "R9503": {"severity": "ERROR", "message": "El periodo es incorrecto."},
    "R9504": {"severity": "ERROR", "message": "La base de cotización no puede ser negativa."},
    "R9505": {"severity": "ERROR", "message": "El grupo de cotización es obligatorio."},
    "R9506": {"severity": "ERROR", "message": "El total a ingresar no puede ser negativo."},
    "R9507": {"severity": "ERROR", "message": "El fichero no contiene trabajadores."},
    "R9508": {"severity": "ERROR", "message": "El contenido del fichero no es válido."},
    "R9509": {"severity": "ERROR", "message": "El tipo de fichero no está admitido."},
    "R9510": {"severity": "ERROR", "message": "La empresa no es válida."},
    "R9511": {"severity": "ERROR", "message": "El CCC no pertenece a la empresa."},
    "R9512": {"severity": "ERROR", "message": "El fichero no se encuentra en un estado enviable."},
}


RECOMMENDATIONS = {
    "R9501": "Complete el Número de Afiliación a la Seguridad Social en la ficha del trabajador, regenere la liquidación y vuelva a enviarla.",
    "R9502": "Revise el CCC del fichero y la configuración de la empresa.",
    "R9503": "Genere de nuevo el fichero con un periodo mensual válido en formato AAAA-MM.",
    "R9504": "Revise las bases de cotización de la nómina indicada antes de repetir el proceso.",
    "R9505": "Complete el grupo de cotización en el contrato del trabajador.",
    "R9506": "Revise cuotas, bonificaciones y reducciones de la liquidación.",
    "R9507": "Prepare una liquidación que incluya al menos un trabajador.",
    "R9508": "Regenerar el fichero desde la liquidación confirmada.",
    "R9511": "Seleccione un CCC configurado en la empresa o en uno de sus centros de trabajo.",
    "W9602": "Compruebe los importes agregados; la diferencia no bloquea esta simulación educativa.",
    "W9603": "Revise los días cotizados del trabajador antes del siguiente envío.",
    "W9604": "Consulte el intento anterior para comparar ambas respuestas.",
    "W9606": "Complete los metadatos didácticos para mejorar la trazabilidad.",
}
