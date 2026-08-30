from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


CARRIER_COLUMN_CANDIDATES = (
    "UNIQUE_CARRIER",
    "UNIQUE_CARRIER_NAME",
    "CARRIER",
    "CARRIER_CODE",
    "OP_UNIQUE_CARRIER",
    "REPORTING_CARRIER",
    "AIRLINE_ID",
)

YEAR_COLUMN_CANDIDATES = ("YEAR", "Year", "year")
MONTH_COLUMN_CANDIDATES = ("MONTH", "Month", "month")
QUARTER_COLUMN_CANDIDATES = ("QUARTER", "Quarter", "quarter")
PERIOD_COLUMN_CANDIDATES = (
    "PERIOD",
    "Period",
    "period",
    "REPORT_PERIOD",
    "REPORTING_PERIOD",
)


@dataclass(frozen=True)
class DatasetProfile:
    row_count: int
    columns: tuple[str, ...]
    periods_by_airline: dict[str, tuple[str, ...]]

    def period_count(self, iata_code: str) -> int:
        return len(self.periods_by_airline.get(iata_code, ()))

    def has_airline(self, iata_code: str) -> bool:
        return self.period_count(iata_code) > 0


def profile_csv(
    path: str | Path,
    candidate_codes: set[str] | None = None,
    carrier_column: str | None = None,
) -> DatasetProfile:
    csv_path = Path(path)
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        columns = tuple(reader.fieldnames or ())
        if not columns:
            return DatasetProfile(0, (), {})

        resolved_carrier_column = carrier_column or _resolve_column(
            columns,
            CARRIER_COLUMN_CANDIDATES,
        )
        if resolved_carrier_column is None:
            raise ValueError(
                f"Could not identify carrier column in {csv_path.name}. "
                f"Columns={list(columns)}"
            )

        periods_by_airline: dict[str, set[str]] = {}
        row_count = 0
        for row in reader:
            row_count += 1
            carrier = _normalize_carrier(row.get(resolved_carrier_column, ""))
            if not carrier:
                continue
            if candidate_codes is not None and carrier not in candidate_codes:
                continue

            period = _extract_period(row, columns)
            if period is None:
                continue
            periods_by_airline.setdefault(carrier, set()).add(period)

    return DatasetProfile(
        row_count=row_count,
        columns=columns,
        periods_by_airline={
            carrier: tuple(sorted(periods))
            for carrier, periods in sorted(periods_by_airline.items())
        },
    )


def profile_directory(
    input_dir: str | Path,
    source_codes: tuple[str, ...],
    candidate_codes: set[str] | None = None,
) -> dict[str, DatasetProfile]:
    directory = Path(input_dir)
    profiles: dict[str, DatasetProfile] = {}

    for source_code in source_codes:
        source_path = _find_source_file(directory, source_code)
        if source_path is None:
            continue
        profiles[source_code] = profile_csv(source_path, candidate_codes=candidate_codes)

    return profiles


def _find_source_file(directory: Path, source_code: str) -> Path | None:
    exact = directory / f"{source_code}.csv"
    if exact.exists():
        return exact

    normalized_source = _normalize_filename(source_code)
    for path in sorted(directory.glob("*.csv")):
        if _normalize_filename(path.stem) == normalized_source:
            return path
    return None


def _normalize_filename(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def _resolve_column(columns: tuple[str, ...], candidates: tuple[str, ...]) -> str | None:
    direct = {column: column for column in columns}
    for candidate in candidates:
        if candidate in direct:
            return direct[candidate]

    normalized = {_normalize_filename(column): column for column in columns}
    for candidate in candidates:
        match = normalized.get(_normalize_filename(candidate))
        if match is not None:
            return match
    return None


def _normalize_carrier(value: str | None) -> str:
    return (value or "").strip().upper()


def _extract_period(row: dict[str, str], columns: tuple[str, ...]) -> str | None:
    period_column = _resolve_column(columns, PERIOD_COLUMN_CANDIDATES)
    if period_column:
        value = (row.get(period_column) or "").strip()
        if value:
            return value

    year_column = _resolve_column(columns, YEAR_COLUMN_CANDIDATES)
    if year_column is None:
        return None

    year = (row.get(year_column) or "").strip()
    if not year:
        return None

    month_column = _resolve_column(columns, MONTH_COLUMN_CANDIDATES)
    if month_column:
        month = (row.get(month_column) or "").strip()
        if month:
            try:
                return f"{int(year):04d}-{int(month):02d}"
            except ValueError:
                return f"{year}-{month}"

    quarter_column = _resolve_column(columns, QUARTER_COLUMN_CANDIDATES)
    if quarter_column:
        quarter = (row.get(quarter_column) or "").strip().upper().removeprefix("Q")
        if quarter:
            return f"{year}-Q{quarter}"

    return year
