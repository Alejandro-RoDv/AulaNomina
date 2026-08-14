from fastapi import APIRouter, HTTPException, Query

from app.training import (
    OFFICIAL_SOURCES_2026,
    blueprint_summary,
    build_training_catalog_2026,
    get_training_activity_2026,
    list_training_activities_2026,
    training_dependency_graph_2026,
)


router = APIRouter(prefix="/training", tags=["training"])


@router.get("/summary")
def training_summary():
    return {
        "course": "AN-GL-2026",
        "version": "2026.1-phase-a",
        **blueprint_summary(),
    }


@router.get("/catalog")
def training_catalog(
    include_source_metadata: bool = Query(default=False),
):
    return build_training_catalog_2026(include_source_metadata=include_source_metadata)


@router.get("/activities")
def training_activities(
    include_source_metadata: bool = Query(default=False),
):
    return list_training_activities_2026(include_source_metadata=include_source_metadata)


@router.get("/activities/{activity_code}")
def training_activity(
    activity_code: str,
    include_source_metadata: bool = Query(default=True),
):
    activity = get_training_activity_2026(
        activity_code,
        include_source_metadata=include_source_metadata,
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad formativa no encontrada")
    return activity


@router.get("/dependencies")
def training_dependencies():
    return training_dependency_graph_2026()


@router.get("/sources")
def training_sources():
    return [
        {"code": code, **source}
        for code, source in OFFICIAL_SOURCES_2026.items()
    ]
