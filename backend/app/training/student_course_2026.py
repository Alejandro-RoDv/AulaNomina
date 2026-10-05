"""Capa pedagógica visible del curso 2026.

El runtime conserva códigos, casos y validadores técnicos. Esta capa define lo que
ve el alumno: una práctica por concepto, títulos cortos y teoría mínima ligada a
una operación real de AulaNomina.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any


STUDENT_BLOCKS_2026: tuple[dict[str, Any], ...] = (
    {
        "code": "B01",
        "title": "Primeros pasos: trabajador, empresa y convenio",
        "activity_codes": ("A04", "A02", "A03", "A05"),
    },
    {
        "code": "B02",
        "title": "Contratos",
        "activity_codes": ("A07", "A08", "A09", "A10", "A11", "A12", "A13"),
    },
    {
        "code": "B03",
        "title": "Nóminas",
        "activity_codes": ("A14", "A15", "A16", "A17", "A18", "A19", "A20", "A21", "A22"),
    },
    {
        "code": "B04",
        "title": "Incidencias laborales",
        "activity_codes": ("A23", "A24", "A25", "A26", "A27"),
    },
    {
        "code": "B05",
        "title": "Seguridad Social",
        "activity_codes": ("A28", "A29", "A30", "A31", "A32", "A33", "A34", "A35"),
    },
    {
        "code": "B06",
        "title": "IRPF y modelos fiscales",
        "activity_codes": ("A36", "A37", "A38", "A39", "A40", "A41"),
    },
    {
        "code": "B07",
        "title": "Regularizaciones y atrasos",
        "activity_codes": ("A42", "A43", "A44", "A45"),
    },
    {
        "code": "B08",
        "title": "Bajas, finiquitos e indemnizaciones",
        "activity_codes": ("A46", "A47", "A48", "A49", "A50"),
    },
    {
        "code": "B09",
        "title": "Documentación y correo",
        "activity_codes": ("A51", "A52", "A53", "A54"),
    },
    {
        "code": "B10",
        "title": "Casos completos",
        "activity_codes": ("C01", "C02", "C03", "C04", "C05", "C06"),
    },
)

STUDENT_ACTIVITY_CODES_2026 = tuple(
    code for block in STUDENT_BLOCKS_2026 for code in block["activity_codes"]
)
STUDENT_ACTIVITY_ORDER_2026 = {
    code: index for index, code in enumerate(STUDENT_ACTIVITY_CODES_2026, start=1)
}
STUDENT_BLOCK_BY_CODE_2026 = {block["code"]: block for block in STUDENT_BLOCKS_2026}
STUDENT_BLOCK_ORDER_2026 = {
    block["code"]: index for index, block in enumerate(STUDENT_BLOCKS_2026, start=1)
}


# Dos actividades conceptuales antiguas dejan de ser ejercicios separados.
# Su teoría se integra en las prácticas operativas A04 (relación por cuenta ajena)
# y A07-A13 (elección y formalización contractual).
HIDDEN_STANDALONE_ACTIVITY_CODES_2026 = frozenset({"A01", "A06"})


STUDENT_ACTIVITY_COPY_2026: dict[str, dict[str, str]] = {
    "A04": {
        "title": "Trabajador por cuenta ajena",
        "theory": (
            "Un trabajador por cuenta ajena presta servicios voluntarios y retribuidos dentro de la organización de una empresa. "
            "La empresa dirige el trabajo y asume el riesgo de la actividad. En AulaNomina esa relación empieza creando su expediente laboral."
        ),
        "task": "Lee el correo de incorporación y crea el trabajador con los datos recibidos.",
    },
    "A02": {
        "title": "Empresa y centro de trabajo",
        "theory": "La empresa es el empleador y el centro de trabajo identifica dónde se presta el servicio. Ambos datos sirven de base para contratos, afiliación, nóminas y cotización.",
        "task": "Revisa la empresa y su centro de trabajo y deja sus datos coherentes.",
    },
    "A03": {
        "title": "Convenio colectivo",
        "theory": "El convenio colectivo fija reglas laborales aplicables al puesto, como clasificación profesional, jornada y retribución. Por eso debe quedar vinculado al contrato correcto.",
        "task": "Abre el contrato indicado y asigna el convenio que corresponde.",
    },
    "A05": {
        "title": "Revisar un expediente laboral",
        "theory": "Un expediente laboral debe contener datos coherentes y actualizados porque esos datos alimentan contratación, Seguridad Social, nómina y documentación.",
        "task": "Compara el expediente con la información recibida y corrige solo los datos erróneos.",
    },
    "A07": {
        "title": "Contrato indefinido",
        "theory": "El contrato indefinido no fija una fecha de finalización desde su inicio. Debe identificar trabajador, empresa, puesto, jornada y fecha de efectos.",
        "task": "Crea el contrato indefinido con los datos del caso.",
    },
    "A08": {
        "title": "Contrato temporal",
        "theory": "Un contrato temporal necesita una causa concreta que justifique su duración. La causa y las fechas deben quedar registradas de forma coherente.",
        "task": "Lee la necesidad comunicada y registra el contrato temporal con su causa y duración.",
    },
    "A09": {
        "title": "Contrato de sustitución",
        "theory": "El contrato de sustitución cubre temporalmente a una persona con derecho a reserva del puesto o una situación equivalente. Debe identificarse quién sustituye y a quién.",
        "task": "Registra el contrato de sustitución y vincula a la persona sustituida.",
    },
    "A10": {
        "title": "Formación en alternancia",
        "theory": "La formación en alternancia combina trabajo retribuido y formación. Además de los datos laborales necesita información del plan formativo y de la tutoría.",
        "task": "Registra el contrato y completa sus datos formativos esenciales.",
    },
    "A11": {
        "title": "Práctica profesional",
        "theory": "Este contrato formativo permite adquirir práctica profesional relacionada con una titulación. La titulación, la fecha de obtención y el puesto son datos clave.",
        "task": "Registra el contrato de práctica profesional con la titulación y fechas indicadas.",
    },
    "A12": {
        "title": "Cambio de jornada",
        "theory": "Una modificación de jornada debe tener una fecha de efectos. El histórico anterior no desaparece: la gestión laboral necesita saber qué jornada se aplicaba en cada periodo.",
        "task": "Registra la nueva jornada desde la fecha indicada sin perder la situación anterior.",
    },
    "A13": {
        "title": "Prórroga o transformación",
        "theory": "Prorrogar mantiene la modalidad contractual y amplía su vigencia; transformar cambia la modalidad, por ejemplo de temporal a indefinido.",
        "task": "Revisa el contrato y registra la operación que corresponde al caso.",
    },
    "A14": {
        "title": "Salario base y complementos",
        "theory": "La nómina parte de la estructura salarial del contrato: salario base y, cuando proceda, complementos. Cada concepto debe tener importe y vigencia correctos.",
        "task": "Configura los conceptos salariales indicados para el contrato.",
    },
    "A15": {
        "title": "Pagas extraordinarias",
        "theory": "Las pagas extraordinarias pueden abonarse en momentos concretos o prorratearse en las mensualidades cuando corresponda. El tratamiento modifica el devengo mensual.",
        "task": "Configura las pagas extraordinarias según las condiciones del caso.",
    },
    "A16": {
        "title": "Nómina mensual",
        "theory": "Una nómina reúne devengos, deducciones y el líquido a percibir. El cálculo parte del contrato, salario, incidencias, cotización e IRPF del periodo.",
        "task": "Genera la nómina del periodo y revisa su resultado.",
    },
    "A17": {
        "title": "Alta o baja dentro del mes",
        "theory": "Cuando la relación laboral no ocupa todo el mes, los días de devengo pueden ser inferiores a un periodo completo. El cálculo debe respetar las fechas reales del contrato.",
        "task": "Calcula la nómina parcial del periodo indicado.",
    },
    "A18": {
        "title": "Base de contingencias comunes",
        "theory": "La base de contingencias comunes es la referencia para determinadas cotizaciones y prestaciones. Se obtiene a partir de los conceptos computables del periodo.",
        "task": "Abre la nómina y comprueba la base de contingencias comunes.",
    },
    "A19": {
        "title": "Base de contingencias profesionales",
        "theory": "La base de contingencias profesionales puede diferir de la base común porque incorpora conceptos con tratamiento específico, como las horas extraordinarias.",
        "task": "Compara las bases de la nómina y revisa la base profesional.",
    },
    "A20": {
        "title": "Deducciones de Seguridad Social",
        "theory": "La persona trabajadora aporta una parte de la cotización mediante deducciones en nómina. Estas cuotas se calculan sobre las bases correspondientes.",
        "task": "Revisa las deducciones de Seguridad Social de la nómina.",
    },
    "A21": {
        "title": "IRPF en nómina",
        "theory": "La retención de IRPF es un pago a cuenta del impuesto y depende de los datos fiscales y retributivos del trabajador. Se descuenta del bruto en la nómina.",
        "task": "Comprueba el tipo de IRPF aplicado y su importe en la nómina.",
    },
    "A22": {
        "title": "Líquido y coste empresa",
        "theory": "El líquido es lo que recibe el trabajador después de deducciones. El coste empresa añade al salario bruto las cotizaciones y otros costes empresariales.",
        "task": "Revisa bruto, deducciones, líquido y coste total de empresa.",
    },
    "A23": {
        "title": "IT por enfermedad común",
        "theory": "La incapacidad temporal suspende la prestación ordinaria de trabajo durante la baja y puede alterar salario, prestación y cotización. Debe registrarse con sus fechas y contingencia.",
        "task": "Registra la IT recibida y revisa su efecto en el expediente y la nómina.",
    },
    "A24": {
        "title": "IT por accidente de trabajo",
        "theory": "Una IT derivada de accidente de trabajo es una contingencia profesional y tiene reglas distintas de una enfermedad común. La contingencia debe quedar bien identificada.",
        "task": "Registra la IT profesional del caso y revisa su efecto económico.",
    },
    "A25": {
        "title": "Vacaciones",
        "theory": "Las vacaciones son tiempo de descanso retribuido y deben quedar registradas para conocer los días disfrutados y evitar solapamientos con otras incidencias.",
        "task": "Registra las vacaciones comunicadas para el trabajador.",
    },
    "A26": {
        "title": "Ausencias",
        "theory": "Una ausencia puede ser retribuida o no y su tratamiento depende del motivo. Registrar correctamente el tipo permite calcular después su efecto en nómina.",
        "task": "Registra la ausencia del caso y revisa si afecta al periodo de nómina.",
    },
    "A27": {
        "title": "Cambio de jornada con efecto en nómina",
        "theory": "Un cambio de jornada modifica la retribución cuando altera el porcentaje de trabajo. La fecha de efectos determina qué parte del periodo se calcula con cada jornada.",
        "task": "Aplica el cambio de jornada y recalcula el periodo afectado.",
    },
    "A28": {
        "title": "Datos para afiliación",
        "theory": "Antes de comunicar un movimiento a Seguridad Social deben estar correctos datos como NAF, empresa, CCC, contrato y fecha de efectos.",
        "task": "Revisa los datos del trabajador necesarios para preparar el movimiento.",
    },
    "A29": {
        "title": "Alta en Seguridad Social",
        "theory": "El alta comunica el inicio de la relación a la Seguridad Social. Debe coincidir con la empresa, el contrato y la fecha real de comienzo.",
        "task": "Prepara el alta del trabajador con los datos del caso.",
    },
    "A30": {
        "title": "Baja o variación",
        "theory": "Una baja comunica el fin de una situación de alta y una variación modifica datos ya comunicados. La fecha de efectos es esencial en ambos casos.",
        "task": "Prepara la baja o variación solicitada.",
    },
    "A31": {
        "title": "Comunicación FIE",
        "theory": "El FIE contiene comunicaciones del INSS que pueden afectar a incidencias y prestaciones. Debe identificarse trabajador, tipo de proceso y fechas antes de actuar.",
        "task": "Abre la comunicación FIE y localiza la información relevante.",
    },
    "A32": {
        "title": "Conciliar FIE e incidencia",
        "theory": "Conciliar significa comprobar que la comunicación recibida coincide con la incidencia registrada en el expediente y relacionar ambas evidencias.",
        "task": "Relaciona la comunicación FIE con la incidencia correcta.",
    },
    "A33": {
        "title": "Fichero CRA",
        "theory": "El fichero CRA informa a la Seguridad Social de los conceptos retributivos abonados. Los conceptos deben estar clasificados y ser coherentes con las nóminas del periodo.",
        "task": "Genera el fichero CRA y revisa sus validaciones.",
    },
    "A34": {
        "title": "RNT y RLC",
        "theory": "El RNT refleja trabajadores y bases de cotización; el RLC recoge la liquidación de cuotas. Ambos deben cuadrar con la información del periodo.",
        "task": "Revisa la liquidación y comprueba RNT y RLC.",
    },
    "A35": {
        "title": "Envío por SILTRA",
        "theory": "SILTRA se utiliza para intercambiar ficheros con la Seguridad Social. En AulaNomina el envío es simulado, pero reproduce validaciones, respuestas y correcciones.",
        "task": "Envía la remesa, revisa la respuesta y corrige el error si lo hay.",
    },
    "A36": {
        "title": "Modelo 145",
        "theory": "El Modelo 145 comunica al pagador circunstancias personales y familiares que influyen en el cálculo de retenciones. Es la base documental del perfil fiscal del trabajador.",
        "task": "Registra en el perfil fiscal los datos comunicados en el Modelo 145.",
    },
    "A37": {
        "title": "Calcular IRPF",
        "theory": "El tipo de retención se calcula con la retribución prevista y las circunstancias personales comunicadas. El resultado se aplica después en nómina.",
        "task": "Calcula el tipo de retención del trabajador con los datos disponibles.",
    },
    "A38": {
        "title": "Regularizar IRPF",
        "theory": "Si cambian las circunstancias o la retribución prevista, puede ser necesario recalcular el tipo de retención para el resto del año.",
        "task": "Actualiza la circunstancia indicada y regulariza el tipo de IRPF.",
    },
    "A39": {
        "title": "Profesional y retención",
        "theory": "Los profesionales no se gestionan como trabajadores en nómina, pero determinadas facturas soportan retención y forman parte de las obligaciones fiscales del pagador.",
        "task": "Registra el profesional y la factura con su retención.",
    },
    "A40": {
        "title": "Modelo 111",
        "theory": "El Modelo 111 declara periódicamente las retenciones practicadas sobre rendimientos del trabajo y determinadas actividades profesionales.",
        "task": "Genera el Modelo 111, revisa sus importes y realiza la presentación simulada.",
    },
    "A41": {
        "title": "Modelo 190",
        "theory": "El Modelo 190 resume anualmente las retenciones declaradas y detalla sus perceptores. Debe ser coherente con la información acumulada durante el ejercicio.",
        "task": "Genera el Modelo 190 y revisa que cuadre con los perceptores del año.",
    },
    "A42": {
        "title": "Corregir un concepto salarial",
        "theory": "Si una nómina ya calculada contiene un importe incorrecto, la corrección debe dejar trazabilidad del valor original y del ajuste realizado.",
        "task": "Corrige el concepto indicado y genera la regularización correspondiente.",
    },
    "A43": {
        "title": "Antigüedad retroactiva",
        "theory": "Un cambio de antigüedad puede generar diferencias salariales en meses ya calculados. Esas diferencias se abonan mediante una regularización retroactiva.",
        "task": "Corrige la antigüedad y regulariza los periodos afectados.",
    },
    "A44": {
        "title": "Atrasos por revisión salarial",
        "theory": "Cuando una revisión salarial tiene efectos anteriores a su publicación, deben calcularse las diferencias entre lo pagado y lo que correspondía pagar.",
        "task": "Aplica la revisión y genera los atrasos del periodo indicado.",
    },
    "A45": {
        "title": "Nómina original y regularizada",
        "theory": "Una regularización debe poder explicarse comparando el cálculo original con el nuevo cálculo y mostrando de dónde sale la diferencia.",
        "task": "Compara ambos cálculos y comprueba la diferencia generada.",
    },
    "A46": {
        "title": "Baja voluntaria",
        "theory": "La baja voluntaria extingue la relación por decisión del trabajador. Debe registrarse la fecha de efectos y coordinar contrato, afiliación y liquidación final.",
        "task": "Tramita la baja voluntaria recibida.",
    },
    "A47": {
        "title": "Fin de contrato temporal",
        "theory": "Un contrato temporal puede extinguirse al llegar la fecha o causa prevista. La finalización debe reflejarse en contrato, afiliación y liquidación.",
        "task": "Tramita la finalización del contrato temporal del caso.",
    },
    "A48": {
        "title": "Despido disciplinario",
        "theory": "El despido disciplinario es una extinción por decisión empresarial basada en un incumplimiento imputado al trabajador y requiere documentación de la decisión.",
        "task": "Registra la extinción y prepara su documentación básica.",
    },
    "A49": {
        "title": "Extinción con indemnización",
        "theory": "Algunas causas de extinción generan derecho a indemnización. Su importe depende de la causa, salario y antigüedad aplicables al supuesto.",
        "task": "Registra la extinción y revisa la indemnización calculada.",
    },
    "A50": {
        "title": "Finiquito",
        "theory": "El finiquito liquida cantidades pendientes al terminar la relación: salario, vacaciones no disfrutadas, pagas extraordinarias u otros conceptos pendientes.",
        "task": "Calcula la liquidación final con los conceptos del caso.",
    },
    "A51": {
        "title": "Documentación de una incorporación",
        "theory": "Una incorporación genera documentación personal, contractual, fiscal y de Seguridad Social. El expediente debe permitir saber qué se ha recibido y qué falta.",
        "task": "Revisa la incorporación y prepara su checklist documental.",
    },
    "A52": {
        "title": "Documentos pendientes y caducados",
        "theory": "Un documento puede estar pendiente, recibido, caducado o no ser aplicable. Mantener bien esos estados evita expedientes incompletos y avisos incorrectos.",
        "task": "Actualiza los documentos pendientes, caducados o no aplicables del expediente.",
    },
    "A53": {
        "title": "Responder un correo laboral",
        "theory": "Una respuesta profesional debe ser clara, breve y dejar constancia de la gestión realizada o de la información que todavía falta.",
        "task": "Lee la solicitud y responde desde el mismo hilo cuando hayas completado la gestión.",
    },
    "A54": {
        "title": "Localizar la documentación de un proceso",
        "theory": "La trazabilidad permite demostrar qué se hizo, con qué documento y en qué momento. Un proceso terminado debe poder reconstruirse desde su expediente.",
        "task": "Localiza la evidencia documental del proceso indicado y comprueba que está vinculada correctamente.",
    },
    "C01": {
        "title": "Caso completo: nueva incorporación",
        "theory": "Una incorporación real conecta expediente, contrato, alta, documentación y primera nómina. El objetivo es ejecutar el proceso de principio a fin sin tratar cada módulo como algo aislado.",
        "task": "Resuelve la incorporación completa utilizando el correo y los módulos necesarios.",
    },
    "C02": {
        "title": "Caso completo: baja médica y sustitución",
        "theory": "Una baja médica puede originar comunicaciones FIE, una incidencia de IT, una sustitución y cambios en nómina y afiliación. Todas las piezas deben ser coherentes entre sí.",
        "task": "Resuelve el caso desde la comunicación de la baja hasta la sustitución y sus efectos.",
    },
    "C03": {
        "title": "Caso completo: reclamación de nómina",
        "theory": "Una reclamación de nómina exige investigar el origen de la diferencia antes de corregir. La solución debe mantener trazabilidad y generar el retroactivo adecuado.",
        "task": "Investiga la reclamación, corrige el origen y regulariza la nómina.",
    },
    "C04": {
        "title": "Caso completo: cierre fiscal trimestral",
        "theory": "El cierre fiscal relaciona perfiles de IRPF, nóminas, profesionales y las retenciones que terminan declaradas en el Modelo 111.",
        "task": "Revisa la información fiscal del trimestre y presenta el Modelo 111 simulado.",
    },
    "C05": {
        "title": "Caso completo: liquidación con error",
        "theory": "Una liquidación de Seguridad Social conecta nómina, CRA, RNT/RLC y SILTRA. Un error debe localizarse, corregirse y reenviarse sin perder el rastro del proceso.",
        "task": "Localiza el error de cotización, corrígelo y completa el reenvío simulado.",
    },
    "C06": {
        "title": "Caso completo: extinción",
        "theory": "Una extinción completa coordina baja contractual, afiliación, finiquito, documentación y comunicación final al trabajador.",
        "task": "Resuelve la extinción completa y deja cerradas todas sus gestiones.",
    },
}


def student_activity_copy_2026(code: str) -> dict[str, str]:
    return deepcopy(STUDENT_ACTIVITY_COPY_2026.get(str(code or "").strip().upper(), {}))
