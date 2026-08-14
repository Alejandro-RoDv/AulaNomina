"""Blueprint pedagógico del Curso práctico de Gestión Laboral AulaNomina 2026.

Fase A: especificación del curso. Este archivo todavía no alimenta el Centro de
Actividades actual; define el contrato de contenido que usará la Fase B.

Estados de encaje funcional:
- ready: AulaNomina ya dispone de una base suficiente para construir la práctica.
- partial: existe base funcional, pero requiere ampliar datos, flujo o validador.
- new_flow: requiere un flujo funcional nuevo o una ampliación relevante.
- content_assisted: aprendizaje principalmente conceptual con apoyo del ERP.
"""

from __future__ import annotations

from collections import Counter
from typing import Any


def _activity(
    code: str,
    title: str,
    *,
    level: str,
    erp_modules: list[str],
    validation: str,
    product_fit: str,
    sources: list[str],
    gap: str | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "title": title,
        "level": level,
        "erp_modules": erp_modules,
        "validation": validation,
        "product_fit": product_fit,
        "sources": sources,
        "development_gap": gap,
    }


COURSE_BLUEPRINT_2026: dict[str, Any] = {
    "code": "AN-GL-2026",
    "title": "Curso práctico de Gestión Laboral con AulaNomina",
    "version": "2026.1-phase-a",
    "reference_year": 2026,
    "source_reviewed_on": "2026-08-14",
    "audience": [
        "Formación Profesional de grado superior",
        "Universidad",
        "Academias y formación profesionalizadora",
        "Personas que se inician en gestión laboral",
    ],
    "level": "inicial-intermedio",
    "scope": {
        "included": "Gestión laboral de personas trabajadoras por cuenta ajena, con Régimen General como núcleo.",
        "excluded_v1": ["RETA como itinerario completo", "Derecho colectivo avanzado", "Gestión laboral real ante organismos externos"],
        "method": "Teoría mínima contextual + operación ERP + validación + casos integrales.",
    },
    "fp_reference": {
        "qualification": "Técnico Superior en Administración y Finanzas",
        "module": "0652 Gestión de recursos humanos",
        "source": "FP_AF_RD_1584_2011",
        "learning_results": {
            "RA1": "Gestiona la documentación que genera el proceso de contratación, aplicando la normativa vigente.",
            "RA2": "Programa las tareas administrativas correspondientes a la modificación, suspensión y extinción del contrato de trabajo.",
            "RA3": "Caracteriza las obligaciones administrativas del empresario con la Seguridad Social.",
            "RA4": "Confecciona los documentos derivados del proceso de retribución de recursos humanos y las obligaciones de pagos.",
        },
    },
    "blocks": [
        {
            "code": "B01",
            "title": "Fundamentos y organización laboral",
            "goal": "Interpretar el contexto laboral mínimo y preparar correctamente empresa, centro, convenio y expediente.",
            "learning_results": ["RA1"],
            "units": [
                {
                    "code": "U01.1",
                    "title": "Relación laboral y marco de trabajo",
                    "activities": [
                        _activity("A01", "Distinguir una relación laboral ordinaria de una situación excluida", level="basic", erp_modules=["learning"], validation="manual", product_fit="content_assisted", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"]),
                    ],
                },
                {
                    "code": "U01.2",
                    "title": "Empresa y centros de trabajo",
                    "activities": [
                        _activity("A02", "Configurar empresa y centro para iniciar la gestión laboral", level="basic", erp_modules=["companies", "work-centers"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011", "LGSS_RDL_8_2015"]),
                    ],
                },
                {
                    "code": "U01.3",
                    "title": "Convenio colectivo aplicado al expediente",
                    "activities": [
                        _activity("A03", "Identificar y asignar el convenio aplicable a un trabajador", level="basic", erp_modules=["agreements", "employees"], validation="semi_automatic", product_fit="partial", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Añadir un validador pedagógico de ámbito y asignación de convenio."),
                    ],
                },
                {
                    "code": "U01.4",
                    "title": "Expediente laboral",
                    "activities": [
                        _activity("A04", "Crear un expediente de trabajador con datos personales y administrativos", level="basic", erp_modules=["employees"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011", "LGSS_RDL_8_2015"]),
                        _activity("A05", "Detectar y corregir datos incompletos o incoherentes del expediente", level="intermediate", erp_modules=["employees", "documents"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011"]),
                    ],
                },
            ],
        },
        {
            "code": "B02",
            "title": "Contratación laboral",
            "goal": "Seleccionar, formalizar y modificar contratos coherentes con la necesidad empresarial y los datos del trabajador.",
            "learning_results": ["RA1", "RA2"],
            "units": [
                {
                    "code": "U02.1",
                    "title": "Elección de modalidad contractual",
                    "activities": [
                        _activity("A06", "Elegir la modalidad contractual adecuada a partir de un supuesto", level="basic", erp_modules=["contracts", "learning"], validation="manual", product_fit="content_assisted", sources=["ET_RDL_2_2015", "SEPE_CONTRATOS", "FP_AF_RD_1584_2011"]),
                    ],
                },
                {
                    "code": "U02.2",
                    "title": "Contratos ordinarios",
                    "activities": [
                        _activity("A07", "Registrar un contrato indefinido", level="basic", erp_modules=["contracts"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "SEPE_CONTRATOS"]),
                        _activity("A08", "Registrar un contrato temporal por circunstancias justificadas", level="intermediate", erp_modules=["contracts"], validation="automatic", product_fit="partial", sources=["ET_RDL_2_2015", "SEPE_CONTRATOS"], gap="Reforzar campos de causa, duración y validación pedagógica de temporalidad."),
                        _activity("A09", "Registrar un contrato de sustitución y vincular a la persona sustituida", level="intermediate", erp_modules=["contracts", "employees"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "SEPE_CONTRATOS"]),
                    ],
                },
                {
                    "code": "U02.3",
                    "title": "Contratos formativos",
                    "activities": [
                        _activity("A10", "Formalizar un contrato de formación en alternancia", level="intermediate", erp_modules=["contracts", "documents"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "CONTRATOS_FORMATIVOS_RD_1065_2025", "SEPE_CONTRATOS"], gap="Añadir datos del plan formativo, tutoría y modalidad formativa al contrato."),
                        _activity("A11", "Formalizar un contrato para la obtención de práctica profesional", level="intermediate", erp_modules=["contracts", "documents"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "CONTRATOS_FORMATIVOS_RD_1065_2025", "SEPE_CONTRATOS"], gap="Añadir titulación habilitante, fechas y reglas propias del contrato formativo."),
                    ],
                },
                {
                    "code": "U02.4",
                    "title": "Jornada y modificaciones",
                    "activities": [
                        _activity("A12", "Modificar la jornada contractual y conservar trazabilidad", level="intermediate", erp_modules=["contracts"], validation="automatic", product_fit="partial", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Exponer mejor el histórico de modificaciones como evidencia de actividad."),
                    ],
                },
                {
                    "code": "U02.5",
                    "title": "Prórroga y transformación",
                    "activities": [
                        _activity("A13", "Prorrogar o transformar una relación contractual", level="intermediate", erp_modules=["contracts"], validation="semi_automatic", product_fit="partial", sources=["ET_RDL_2_2015", "SEPE_CONTRATOS"], gap="Normalizar acciones de prórroga y transformación como operaciones diferenciadas."),
                    ],
                },
            ],
        },
        {
            "code": "B03",
            "title": "Nómina y retribución",
            "goal": "Comprender y comprobar la formación de una nómina desde la estructura salarial hasta el líquido y el coste empresa.",
            "learning_results": ["RA4", "RA3"],
            "units": [
                {
                    "code": "U03.1",
                    "title": "Estructura salarial",
                    "activities": [
                        _activity("A14", "Configurar salario base y complementos de un contrato", level="basic", erp_modules=["payrolls", "contracts"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"]),
                        _activity("A15", "Configurar pagas extraordinarias y su prorrata", level="intermediate", erp_modules=["payrolls", "agreements"], validation="semi_automatic", product_fit="partial", sources=["ET_RDL_2_2015"], gap="Mejorar actividad y validador de configuración de pagas extraordinarias."),
                    ],
                },
                {
                    "code": "U03.2",
                    "title": "Cálculo ordinario",
                    "activities": [
                        _activity("A16", "Calcular una nómina mensual ordinaria", level="basic", erp_modules=["payrolls"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011", "COT_PJC_297_2026"]),
                        _activity("A17", "Calcular una nómina con alta o baja dentro del mes", level="intermediate", erp_modules=["payrolls", "contracts"], validation="automatic", product_fit="partial", sources=["FP_AF_RD_1584_2011", "COT_PJC_297_2026"], gap="Crear casos deterministas de devengo parcial y su criterio de comparación."),
                    ],
                },
                {
                    "code": "U03.3",
                    "title": "Bases y cotización",
                    "activities": [
                        _activity("A18", "Comprobar la base de cotización por contingencias comunes", level="intermediate", erp_modules=["payrolls", "social-security"], validation="automatic", product_fit="ready", sources=["LGSS_RDL_8_2015", "COT_PJC_297_2026"]),
                        _activity("A19", "Comprobar la base por contingencias profesionales", level="intermediate", erp_modules=["payrolls", "social-security"], validation="automatic", product_fit="partial", sources=["LGSS_RDL_8_2015", "COT_PJC_297_2026"], gap="Exponer criterio pedagógico específico de base AT/EP en el desglose."),
                    ],
                },
                {
                    "code": "U03.4",
                    "title": "Deducciones y retenciones",
                    "activities": [
                        _activity("A20", "Revisar las deducciones de Seguridad Social del trabajador", level="intermediate", erp_modules=["payrolls", "social-security"], validation="automatic", product_fit="ready", sources=["LGSS_RDL_8_2015", "COT_PJC_297_2026"]),
                        _activity("A21", "Aplicar y comprobar la retención de IRPF en nómina", level="intermediate", erp_modules=["payrolls", "irpf"], validation="automatic", product_fit="ready", sources=["AEAT_RETENCIONES_2026", "FP_AF_RD_1584_2011"]),
                    ],
                },
                {
                    "code": "U03.5",
                    "title": "Resultado y coste empresarial",
                    "activities": [
                        _activity("A22", "Interpretar líquido a percibir y coste total de empresa", level="intermediate", erp_modules=["payrolls"], validation="automatic", product_fit="ready", sources=["COT_PJC_297_2026", "FP_AF_RD_1584_2011"]),
                    ],
                },
            ],
        },
        {
            "code": "B04",
            "title": "Incidencias laborales",
            "goal": "Registrar hechos que alteran la prestación ordinaria y comprobar su impacto administrativo y económico.",
            "learning_results": ["RA2", "RA4"],
            "units": [
                {
                    "code": "U04.1",
                    "title": "Incapacidad temporal",
                    "activities": [
                        _activity("A23", "Registrar una IT por enfermedad común y revisar su nómina", level="intermediate", erp_modules=["incidents", "payrolls", "fie"], validation="automatic", product_fit="ready", sources=["LGSS_RDL_8_2015", "COT_PJC_297_2026"]),
                        _activity("A24", "Registrar una IT derivada de accidente de trabajo y revisar su nómina", level="intermediate", erp_modules=["incidents", "payrolls"], validation="automatic", product_fit="partial", sources=["LGSS_RDL_8_2015", "COT_PJC_297_2026"], gap="Añadir caso y criterios específicos de contingencia profesional."),
                    ],
                },
                {
                    "code": "U04.2",
                    "title": "Vacaciones y ausencias",
                    "activities": [
                        _activity("A25", "Registrar vacaciones y comprobar el calendario del trabajador", level="basic", erp_modules=["incidents", "employees"], validation="semi_automatic", product_fit="partial", sources=["ET_RDL_2_2015"], gap="Unificar vacaciones con el motor de incidencias y añadir validador de fechas."),
                        _activity("A26", "Registrar una ausencia y evaluar su impacto en nómina", level="intermediate", erp_modules=["incidents", "payrolls"], validation="automatic", product_fit="partial", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Definir tipos de ausencia didácticos y efecto esperado."),
                    ],
                },
                {
                    "code": "U04.3",
                    "title": "Variaciones con efecto económico",
                    "activities": [
                        _activity("A27", "Aplicar un cambio de jornada y recalcular el periodo afectado", level="intermediate", erp_modules=["contracts", "payrolls"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"]),
                    ],
                },
            ],
        },
        {
            "code": "B05",
            "title": "Seguridad Social y Sistema RED",
            "goal": "Practicar afiliación, comunicaciones INSS, cotización y envío simulado de ficheros con lógica profesional.",
            "learning_results": ["RA3", "RA4"],
            "units": [
                {
                    "code": "U05.1",
                    "title": "Afiliación y movimientos",
                    "activities": [
                        _activity("A28", "Revisar NAF y datos necesarios antes de un movimiento de afiliación", level="basic", erp_modules=["employees", "affiliations"], validation="automatic", product_fit="ready", sources=["LGSS_RDL_8_2015", "TGSS_RED"]),
                        _activity("A29", "Preparar el alta de una persona trabajadora", level="basic", erp_modules=["affiliations"], validation="automatic", product_fit="ready", sources=["LGSS_RDL_8_2015", "TGSS_RED"]),
                        _activity("A30", "Preparar una baja o variación de datos de afiliación", level="intermediate", erp_modules=["affiliations"], validation="semi_automatic", product_fit="partial", sources=["LGSS_RDL_8_2015", "TGSS_RED"], gap="Ampliar el flujo de afiliación más allá del alta y normalizar tipos de movimiento."),
                    ],
                },
                {
                    "code": "U05.2",
                    "title": "FIE e incidencias INSS",
                    "activities": [
                        _activity("A31", "Abrir e interpretar una comunicación FIE", level="intermediate", erp_modules=["fie", "mail"], validation="automatic", product_fit="ready", sources=["TGSS_FIE_5_2026", "TGSS_RED"]),
                        _activity("A32", "Conciliar el FIE con la incidencia del expediente", level="intermediate", erp_modules=["fie", "incidents"], validation="automatic", product_fit="ready", sources=["TGSS_FIE_5_2026", "LGSS_RDL_8_2015"]),
                    ],
                },
                {
                    "code": "U05.3",
                    "title": "Conceptos Retributivos Abonados",
                    "activities": [
                        _activity("A33", "Generar y validar un fichero CRA", level="intermediate", erp_modules=["cra", "payrolls"], validation="automatic", product_fit="ready", sources=["TGSS_CRA_2026", "LGSS_RDL_8_2015"]),
                    ],
                },
                {
                    "code": "U05.4",
                    "title": "Liquidación de cuotas",
                    "activities": [
                        _activity("A34", "Revisar una liquidación y cuadrar RNT y RLC", level="intermediate", erp_modules=["social-security", "payrolls"], validation="semi_automatic", product_fit="ready", sources=["TGSS_RED", "COT_PJC_297_2026"]),
                    ],
                },
                {
                    "code": "U05.5",
                    "title": "SILTRA simulado",
                    "activities": [
                        _activity("A35", "Enviar una remesa, interpretar un error, corregir y reenviar", level="intermediate", erp_modules=["siltra", "social-security"], validation="automatic", product_fit="ready", sources=["TGSS_RED", "TGSS_FIE_5_2026"], gap="Actualizar textos y escenarios simulados a SILTRA 4.0.0/FIE 5.0 cuando corresponda."),
                    ],
                },
            ],
        },
        {
            "code": "B06",
            "title": "IRPF y fiscalidad laboral",
            "goal": "Relacionar datos fiscales del perceptor, retención de nómina y obligaciones periódicas y anuales del retenedor.",
            "learning_results": ["RA4"],
            "units": [
                {
                    "code": "U06.1",
                    "title": "Datos fiscales y Modelo 145",
                    "activities": [
                        _activity("A36", "Registrar y revisar las circunstancias comunicadas mediante Modelo 145", level="basic", erp_modules=["irpf", "documents", "employees"], validation="automatic", product_fit="partial", sources=["AEAT_MODELO_145", "AEAT_RETENCIONES_2026"], gap="Relacionar explícitamente el perfil fiscal con evidencia documental Modelo 145."),
                    ],
                },
                {
                    "code": "U06.2",
                    "title": "Cálculo y regularización de retenciones",
                    "activities": [
                        _activity("A37", "Calcular la retención IRPF 2026 a partir del perfil del trabajador", level="intermediate", erp_modules=["irpf"], validation="automatic", product_fit="ready", sources=["AEAT_RETENCIONES_2026"]),
                        _activity("A38", "Regularizar el tipo de retención tras un cambio de circunstancias", level="intermediate", erp_modules=["irpf", "payrolls"], validation="automatic", product_fit="partial", sources=["AEAT_RETENCIONES_2026"], gap="Crear caso guiado de regularización fiscal con comparación antes/después."),
                    ],
                },
                {
                    "code": "U06.3",
                    "title": "Profesionales y otras retenciones",
                    "activities": [
                        _activity("A39", "Registrar un profesional y su retención para integrarlo en obligaciones fiscales", level="intermediate", erp_modules=["professionals", "tax"], validation="semi_automatic", product_fit="partial", sources=["AEAT_MODELO_111", "AEAT_MODELO_190"], gap="Completar el flujo pedagógico de profesionales y su enlace con 111/190."),
                    ],
                },
                {
                    "code": "U06.4",
                    "title": "Modelos 111 y 190",
                    "activities": [
                        _activity("A40", "Generar, revisar y presentar de forma simulada un Modelo 111", level="intermediate", erp_modules=["model111", "tax"], validation="automatic", product_fit="ready", sources=["AEAT_MODELO_111"]),
                        _activity("A41", "Generar el Modelo 190 y cuadrarlo con perceptores y retenciones del ejercicio", level="intermediate", erp_modules=["model190", "tax"], validation="automatic", product_fit="ready", sources=["AEAT_MODELO_190", "AEAT_MODELO_111"]),
                    ],
                },
            ],
        },
        {
            "code": "B07",
            "title": "Regularizaciones y retroactivos",
            "goal": "Corregir diferencias de periodos calculados manteniendo trazabilidad y coherencia laboral, fiscal y de cotización.",
            "learning_results": ["RA4", "RA2"],
            "units": [
                {
                    "code": "U07.1",
                    "title": "Correcciones salariales",
                    "activities": [
                        _activity("A42", "Corregir un concepto salarial aplicado con importe erróneo", level="intermediate", erp_modules=["payrolls", "regularizations"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"]),
                    ],
                },
                {
                    "code": "U07.2",
                    "title": "Antigüedad y atrasos",
                    "activities": [
                        _activity("A43", "Regularizar un complemento de antigüedad con efectos retroactivos", level="intermediate", erp_modules=["contracts", "payrolls", "regularizations"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"]),
                        _activity("A44", "Generar atrasos derivados de una revisión salarial", level="intermediate", erp_modules=["agreements", "payrolls", "regularizations"], validation="semi_automatic", product_fit="partial", sources=["ET_RDL_2_2015"], gap="Añadir caso específico de atrasos por convenio y periodo de efectos."),
                    ],
                },
                {
                    "code": "U07.3",
                    "title": "Trazabilidad de regularización",
                    "activities": [
                        _activity("A45", "Comparar cálculo original y regularizado y justificar la diferencia", level="intermediate", erp_modules=["regularizations", "payrolls"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011"]),
                    ],
                },
            ],
        },
        {
            "code": "B08",
            "title": "Extinción, finiquito e indemnizaciones",
            "goal": "Gestionar administrativamente el final de la relación laboral y calcular sus efectos económicos y documentales.",
            "learning_results": ["RA2", "RA4"],
            "units": [
                {
                    "code": "U08.1",
                    "title": "Bajas por decisión del trabajador y fin de contrato",
                    "activities": [
                        _activity("A46", "Tramitar una baja voluntaria", level="intermediate", erp_modules=["contracts", "employees", "affiliations"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Crear flujo de extinción que coordine contrato, trabajador, afiliación y documentación."),
                        _activity("A47", "Tramitar la expiración de un contrato temporal", level="intermediate", erp_modules=["contracts", "employees", "affiliations"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Crear flujo de extinción y motivos normalizados."),
                    ],
                },
                {
                    "code": "U08.2",
                    "title": "Extinción por decisión empresarial",
                    "activities": [
                        _activity("A48", "Registrar un despido disciplinario y su documentación básica", level="intermediate", erp_modules=["contracts", "documents"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Crear flujo de extinción, motivos y documentos simulados."),
                        _activity("A49", "Registrar una extinción con indemnización", level="intermediate", erp_modules=["contracts", "payrolls", "documents"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Añadir cálculo y desglose didáctico de indemnización según escenario."),
                    ],
                },
                {
                    "code": "U08.3",
                    "title": "Liquidación final",
                    "activities": [
                        _activity("A50", "Calcular un finiquito con salario, pagas y vacaciones pendientes", level="intermediate", erp_modules=["payrolls", "contracts", "documents"], validation="automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"], gap="Nuevo flujo de liquidación/finiquito conectado con nómina y extinción."),
                    ],
                },
            ],
        },
        {
            "code": "B09",
            "title": "Gestión documental y comunicaciones",
            "goal": "Mantener el expediente verificable y comunicar actuaciones con un estándar profesional.",
            "learning_results": ["RA1", "RA2", "RA3", "RA4"],
            "units": [
                {
                    "code": "U09.1",
                    "title": "Expediente documental",
                    "activities": [
                        _activity("A51", "Preparar el checklist documental de una nueva incorporación", level="basic", erp_modules=["documents", "employees", "contracts"], validation="semi_automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011"]),
                        _activity("A52", "Resolver documentos pendientes, caducados y no aplicables", level="intermediate", erp_modules=["documents"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011"]),
                    ],
                },
                {
                    "code": "U09.2",
                    "title": "Comunicación profesional",
                    "activities": [
                        _activity("A53", "Responder profesionalmente a una solicitud laboral recibida por correo", level="intermediate", erp_modules=["mail"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011"]),
                    ],
                },
                {
                    "code": "U09.3",
                    "title": "Archivo y evidencia",
                    "activities": [
                        _activity("A54", "Localizar y justificar la evidencia documental de un proceso terminado", level="intermediate", erp_modules=["documents", "mail"], validation="semi_automatic", product_fit="partial", sources=["FP_AF_RD_1584_2011"], gap="Añadir validación transversal de documentos vinculados a procesos."),
                    ],
                },
            ],
        },
        {
            "code": "B10",
            "title": "Casos integrales",
            "goal": "Resolver procesos profesionales completos con instrucciones progresivamente menos guiadas.",
            "learning_results": ["RA1", "RA2", "RA3", "RA4"],
            "units": [
                {
                    "code": "U10.1",
                    "title": "Casos profesionales de principio a fin",
                    "activities": [
                        _activity("C01", "Nueva incorporación completa: expediente, contrato, alta, documentación y primera nómina", level="integral", erp_modules=["mail", "employees", "contracts", "affiliations", "documents", "payrolls"], validation="automatic", product_fit="ready", sources=["FP_AF_RD_1584_2011", "ET_RDL_2_2015", "LGSS_RDL_8_2015", "TGSS_RED"]),
                        _activity("C02", "Baja médica con sustitución: FIE, IT, sustituta, afiliación y nóminas", level="integral", erp_modules=["mail", "fie", "incidents", "employees", "contracts", "affiliations", "payrolls"], validation="automatic", product_fit="ready", sources=["LGSS_RDL_8_2015", "TGSS_FIE_5_2026", "TGSS_RED"]),
                        _activity("C03", "Reclamación de nómina por antigüedad: investigación, corrección y retroactivo", level="integral", erp_modules=["mail", "contracts", "payrolls", "regularizations"], validation="automatic", product_fit="ready", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011"]),
                        _activity("C04", "Cierre fiscal trimestral: perfiles fiscales, nóminas, profesionales y Modelo 111", level="integral", erp_modules=["irpf", "payrolls", "professionals", "model111"], validation="automatic", product_fit="partial", sources=["AEAT_RETENCIONES_2026", "AEAT_MODELO_111"], gap="Completar integración pedagógica de profesionales con Modelo 111."),
                        _activity("C05", "Liquidación de Seguridad Social con error: CRA, RNT/RLC, SILTRA, corrección y reenvío", level="integral", erp_modules=["cra", "social-security", "siltra"], validation="automatic", product_fit="ready", sources=["TGSS_CRA_2026", "TGSS_RED", "COT_PJC_297_2026"]),
                        _activity("C06", "Extinción completa: baja, liquidación final, finiquito, afiliación y comunicación", level="integral", erp_modules=["contracts", "payrolls", "affiliations", "documents", "mail"], validation="semi_automatic", product_fit="new_flow", sources=["ET_RDL_2_2015", "FP_AF_RD_1584_2011", "LGSS_RDL_8_2015"], gap="Depende del nuevo flujo de extinción y finiquito del bloque 8."),
                    ],
                },
            ],
        },
    ],
}


def iter_activities() -> list[dict[str, Any]]:
    return [
        activity
        for block in COURSE_BLUEPRINT_2026["blocks"]
        for unit in block["units"]
        for activity in unit["activities"]
    ]


def blueprint_summary() -> dict[str, Any]:
    activities = iter_activities()
    fit = Counter(activity["product_fit"] for activity in activities)
    validation = Counter(activity["validation"] for activity in activities)
    regular = sum(1 for activity in activities if activity["code"].startswith("A"))
    integral = sum(1 for activity in activities if activity["code"].startswith("C"))
    return {
        "blocks": len(COURSE_BLUEPRINT_2026["blocks"]),
        "units": sum(len(block["units"]) for block in COURSE_BLUEPRINT_2026["blocks"]),
        "activities": len(activities),
        "guided_activities": regular,
        "integral_cases": integral,
        "product_fit": dict(fit),
        "validation": dict(validation),
    }
