from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DatasetProfile:
    """Minimal source profile consumed by the airline scoring layer.

    The scoring layer only needs source-level row/column metadata and the
    distinct reporting periods available for each candidate airline. Detailed
    profiling logic will be implemented separately when BTS ingestion begins.
    """

    row_count: int
    columns: tuple[str, ...]
    periods_by_airline: dict[str, tuple[str, ...]]

    def period_count(self, iata_code: str) -> int:
        return len(self.periods_by_airline.get(iata_code, ()))

    def has_airline(self, iata_code: str) -> bool:
        return self.period_count(iata_code) > 0
