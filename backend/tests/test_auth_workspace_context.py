from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import app.auth_dependencies as auth_dependencies
from app.services.workspace_context import current_workspace_id


def test_optional_principal_resets_workspace_in_same_async_context(monkeypatch):
    monkeypatch.setenv("AULANOMINA_REQUIRE_AUTH", "false")

    app = FastAPI()
    app.dependency_overrides[auth_dependencies.get_db] = lambda: object()

    @app.get("/probe")
    async def probe(principal=Depends(auth_dependencies.get_optional_principal)):
        return {
            "principal": principal,
            "workspace_id": current_workspace_id(),
        }

    with TestClient(app, raise_server_exceptions=True) as client:
        response = client.get("/probe")

    assert response.status_code == 200
    assert response.json() == {"principal": None, "workspace_id": None}
    assert current_workspace_id() is None
