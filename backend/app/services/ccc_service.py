from __future__ import annotations

import re
from typing import Any


DEFAULT_CCC_REGIME = "0111"


def ccc_parts(value: Any, *, default_regime: str | None = DEFAULT_CCC_REGIME) -> tuple[str | None, str | None]:
    """Return the four-digit regime and eleven-digit account code.

    Historical AulaNomina data stored only the eleven-digit account code. It is
    interpreted as Régimen General (0111) so existing workspaces remain usable.
    """
    text = str(value or "").strip()
    if not text:
        return None, None
    separated = re.split(r"[\s/\-]+", text)
    if len(separated) >= 2:
        regime = "".join(character for character in separated[0] if character.isdigit())
        code = "".join(character for character in "".join(separated[1:]) if character.isdigit())
        return regime or None, code or None
    digits = "".join(character for character in text if character.isdigit())
    if len(digits) == 15:
        return digits[:4], digits[4:]
    if len(digits) == 11:
        return default_regime, digits
    return None, digits or None


def compose_ccc(regime: Any, code: Any, *, required: bool = False) -> str | None:
    regime_digits = "".join(character for character in str(regime or "") if character.isdigit())
    code_digits = "".join(character for character in str(code or "") if character.isdigit())
    if not regime_digits and not code_digits and not required:
        return None
    if len(regime_digits) != 4:
        raise ValueError("El régimen del CCC debe tener exactamente 4 dígitos (por ejemplo, 0111).")
    if len(code_digits) != 11:
        raise ValueError("El código del CCC debe tener exactamente 11 dígitos.")
    return f"{regime_digits}/{code_digits}"


def canonical_ccc(value: Any, *, required: bool = False) -> str | None:
    if value in {None, ""} and not required:
        return None
    regime, code = ccc_parts(value)
    return compose_ccc(regime, code, required=required)


def same_ccc(left: Any, right: Any) -> bool:
    try:
        return canonical_ccc(left) == canonical_ccc(right)
    except ValueError:
        return False

