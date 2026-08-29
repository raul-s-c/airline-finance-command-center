from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AirlineCoverageScore:
    iata_code: str
    p12_financial_continuity: float
    p52_aircraft_expense_detail: float
    p12a_operating_stats_coverage: float
    t100_operational_coverage: float
    network_and_fleet_analytical_value: float
    cross_source_reconciliation: float
    carrier_code_stability: float


def calculate_weighted_score(
    coverage_score: AirlineCoverageScore,
    weights: dict[str, float],
) -> float:
    return sum(
        getattr(coverage_score, criterion) * weight
        for criterion, weight in weights.items()
    )
