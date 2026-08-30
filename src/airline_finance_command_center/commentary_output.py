from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
import json
from typing import Iterable

from airline_finance_command_center.commentary import CommentaryItem


def build_commentary_output(
    items: Iterable[CommentaryItem],
    *,
    airline_id: int | str | None = None,
    period: str | None = None,
    source_status: str = "validated",
) -> dict:
    material_items = list(items)
    return {
        "airline_id": airline_id,
        "period": period,
        "source_status": source_status,
        "commentary_count": len(material_items),
        "items": [asdict(item) for item in material_items],
    }


def write_commentary_output(payload: dict, path: str | Path) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return output_path
