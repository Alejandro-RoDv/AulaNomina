SITUATION_CODES = [
    {"code": "1", "description": "Alta"},
    {"code": "51", "description": "Baja voluntaria / dimisión"},
    {"code": "53", "description": "Baja despido disciplinario individual"},
    {"code": "54", "description": "Baja no voluntaria por otras causas"},
    {"code": "63", "description": "Baja por excedencia voluntaria / forzosa"},
    {"code": "65", "description": "Baja por agotamiento IT"},
    {"code": "68", "description": "Baja por excedencia maternal / cuidado de hijos"},
    {"code": "77", "description": "Baja por despido colectivo"},
    {"code": "85", "description": "Baja por no superar período de prueba"},
    {"code": "91", "description": "Baja por despido por causas objetivas empresa"},
    {"code": "92", "description": "Baja por despido por causas objetivas trabajador"},
    {"code": "93", "description": "Baja por fin contrato temporal o duración determinada"},
    {"code": "94", "description": "Baja por pase a inactividad fijos discontinuos"},
    {"code": "99", "description": "Otras causas de baja"},
]

UNEMPLOYED_CONDITIONS = [
    {"code": "1", "description": "Desempleado inscrito en oficina de empleo"},
    {"code": "2", "description": "Desempleado inscrito más de 12 meses"},
    {"code": "5", "description": "Desempleado inscrito más de 6 meses"},
    {"code": "7", "description": "Beneficiario subsidio desempleo mayor de 52 años"},
    {"code": "9", "description": "No inscrito en oficina de empleo"},
    {"code": "A", "description": "Beneficiario prestación desempleo"},
    {"code": "B", "description": "Desempleado con problemas de empleabilidad"},
    {"code": "H", "description": "Desempleado sin experiencia laboral o inferior a 3 meses"},
    {"code": "K", "description": "Desempleado sin título oficial enseñanza"},
    {"code": "L", "description": "Desempleado inscrito 12 meses en 18 meses"},
    {"code": "W", "description": "Colectivo excluido de inscripción"},
]

SUBSTITUTION_CAUSES = [
    {"code": "01", "description": "Sustitución por excedencia por cuidado de familiares"},
    {"code": "02", "description": "Descanso nacimiento, riesgo embarazo o lactancia"},
    {"code": "04", "description": "Sustitución persona con discapacidad"},
    {"code": "05", "description": "Sustitución persona con discapacidad en IT"},
    {"code": "10", "description": "Descanso nacimiento / riesgo - sustituto"},
    {"code": "11", "description": "Sustitución por descanso nacimiento cuidado menor"},
    {"code": "12", "description": "Riesgo embarazo / lactancia"},
    {"code": "13", "description": "Sustitución riesgo embarazo / lactancia"},
    {"code": "14", "description": "Sustitución IT"},
]

INACTIVITY_TYPES = [
    {"code": "1", "description": "Periodo de inactividad"},
    {"code": "2", "description": "Huelga total"},
    {"code": "3", "description": "Huelga parcial"},
    {"code": "5", "description": "Ausencia del trabajo"},
    {"code": "6", "description": "Alta sin retribución"},
    {"code": "12", "description": "ERTE ETOP - suspensión"},
    {"code": "13", "description": "ERTE ETOP - reducción"},
    {"code": "16", "description": "ERTE fuerza mayor - suspensión"},
    {"code": "18", "description": "ERTE fuerza mayor - reducción"},
    {"code": "20", "description": "Permiso parental tiempo completo"},
    {"code": "B", "description": "Suspensión total ERE sin prestación desempleo"},
    {"code": "C", "description": "Suspensión parcial ERE sin prestación desempleo"},
    {"code": "E", "description": "Suspensión total ERE"},
    {"code": "F", "description": "Suspensión parcial ERE"},
    {"code": "T", "description": "Salarios de tramitación"},
    {"code": "Z", "description": "Inactividad no cotización / permanencias"},
]

WORKER_COLLECTIVES = [
    {"code": "951", "description": "Consejero administrador con contrato de trabajo"},
    {"code": "952", "description": "Consejero administrador con contrato mercantil"},
    {"code": "953", "description": "Socio cooperativa duración determinada jornada completa"},
    {"code": "954", "description": "Socio cooperativa duración determinada jornada parcial"},
    {"code": "967", "description": "Contrato circunstancias de la producción"},
    {"code": "968", "description": "Contrato circunstancias de la producción previsibles"},
    {"code": "969", "description": "Administraciones públicas / entidades sin ánimo de lucro - programas activación empleo"},
    {"code": "970", "description": "Administraciones públicas - plan recuperación, transformación y resiliencia"},
    {"code": "971", "description": "Contrato artístico duración determinada"},
    {"code": "972", "description": "Contrato no artístico duración determinada"},
]

SOCIAL_EXCLUSION_VICTIM_STATUSES = [
    {"code": "none", "description": "No aplica"},
    {"code": "social_exclusion", "description": "Exclusión social"},
    {"code": "human_trafficking_victim", "description": "Víctima de trata de seres humanos"},
    {"code": "sexual_violence_victim", "description": "Víctima de violencia sexual"},
]

WORKING_DAY_TYPES = [
    {"code": "full_time", "description": "Jornada completa"},
    {"code": "part_time", "description": "Jornada parcial"},
    {"code": "fixed_discontinuous", "description": "Fijo discontinuo"},
]

MONTHLY_DAILY_CONTRIBUTION_TYPES = [
    {"code": "monthly", "description": "Cotización mensual"},
    {"code": "daily", "description": "Cotización diaria"},
]
