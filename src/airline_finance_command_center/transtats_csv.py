from __future__ import annotations

import csv
import io
import re
import zipfile
from collections.abc import Iterator
from pathlib import Path
from typing import TextIO


def normalize_column(name: str) -> str:
    value = name.strip().strip('"').lower()
    return re.sub(r"[^0-9a-z]+", "_", value).strip("_")


def _open_data_member(archive: zipfile.ZipFile) -> zipfile.ZipExtFile:
    candidates = [
        item
        for item in archive.infolist()
        if item.filename.lower().endswith(".csv")
        and not item.filename.lower().startswith("documentation")
    ]
    if not candidates:
        raise ValueError("TranStats ZIP does not contain a data CSV")
    return archive.open(max(candidates, key=lambda item: item.file_size))


def iter_zip_rows(path: str | Path) -> Iterator[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        with _open_data_member(archive) as raw:
            with io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="") as text:
                reader = csv.DictReader(text)
                if reader.fieldnames is None:
                    raise ValueError(f"CSV in {path} has no header")
                normalized = [normalize_column(name) for name in reader.fieldnames]
                for row in reader:
                    yield {
                        normalized[index]: (row.get(original) or "").strip()
                        for index, original in enumerate(reader.fieldnames)
                        if normalized[index]
                    }


def number(value: str | int | float | None, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = value.strip().replace(",", "")
    if not cleaned:
        return default
    try:
        return float(cleaned)
    except ValueError:
        return default


def integer(value: str | int | float | None, default: int = 0) -> int:
    return int(round(number(value, float(default))))


CARRIER_CODE_COLUMNS = (
    "unique_carrier",
    "reporting_carrier",
    "carrier",
    "unique_carrier_code",
)


def carrier_code(row: dict[str, str]) -> str:
    for column in CARRIER_CODE_COLUMNS:
        value = row.get(column, "").strip().upper()
        if value:
            return value
    return ""


def is_delta(row: dict[str, str]) -> bool:
    return carrier_code(row) == "DL"
