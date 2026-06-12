from sqlalchemy.orm import Session


def seed_agreement_parameterization(db: Session, agreement_id: int) -> dict:
    """Carga inicial mínima para mantener estable el endpoint de parametrización.

    La semilla extensa se incorporará por bloques para evitar ficheros demasiado grandes:
    SMI/IPREM, coeficientes, tipos y bases de cotización, vacaciones, pagas extra,
    antigüedad, complementos de IT, contratación, período de prueba y catálogos.
    """
    return {
        "created_rules": 0,
        "created_catalog_items": 0,
        "message": "Endpoint de parametrización preparado. Semilla extensa pendiente de carga por bloques.",
    }
