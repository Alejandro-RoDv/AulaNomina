from __future__ import annotations

from contextvars import ContextVar, Token


_CURRENT_WORKSPACE_ID: ContextVar[int | None] = ContextVar(
    "aulanomina_current_workspace_id",
    default=None,
)


def current_workspace_id() -> int | None:
    return _CURRENT_WORKSPACE_ID.get()


def bind_workspace(workspace_id: int | None) -> Token:
    return _CURRENT_WORKSPACE_ID.set(workspace_id)


def reset_workspace(token: Token) -> None:
    _CURRENT_WORKSPACE_ID.reset(token)
