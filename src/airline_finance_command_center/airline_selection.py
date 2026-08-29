from __future__ import annotations

from dataclasses import dataclass

from airline_finance_command_center.config import AirlineCandidate
from airline_finance_command_center.profiling import DatasetProfile


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


@dataclass(frozen=True)
class RankedAirline:
    iata_code: str
    name: str
    score: float
    rank: int


def calculate_weighted_score(
    coverage_score: AirlineCoverageScore,
    weights: dict[str, float],
) -> float:
    return sum(
        getattr(coverage_score, criterion) * weight
        for criterion, weight in weights.items()
    )


def rank_airlines(
    candidates: tuple[AirlineCandidate, ...],
    coverage_scores: dict[str, AirlineCoverageScore],
    weights: dict[str, float],
) -> tuple[RankedAirline, ...]:
    ranked = sorted(
        (
            RankedAirline(
                iata_code=candidate.iata_code,
                name=candidate.name,
                score=calculate_weighted_score(coverage_scores[candidate.iata_code], weights),
                rank=0,
            )
            for candidate in candidates
            if candidate.iata_code in coverage_scores
        ),
        key=lambda airline: (-airline.score, airline.iata_code),
    )

    return tuple(
        RankedAirline(
            iata_code=airline.iata_code,
            name=airline.name,
            score=airline.score,
            rank=index + 1,
        )
        for index, airline in enumerate(ranked)
    )


def estimate_coverage_scores(
    candidates: tuple[AirlineCandidate, ...],
    profiles_by_source: dict[str, DatasetProfile],
) -> dict[str, AirlineCoverageScore]:
    return {
        candidate.iata_code: AirlineCoverageScore(
            iata_code=candidate.iata_code,
            p12_financial_continuity=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("P-1.2"),
            ),
            p52_aircraft_expense_detail=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("P-5.2"),
            ),
            p12a_operating_stats_coverage=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("P-12(a)"),
            ),
            t100_operational_coverage=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("T-100"),
            ),
            network_and_fleet_analytical_value=_source_presence(
                candidate.iata_code,
                profiles_by_source,
                ("P-5.2", "T-100", "B-43"),
            ),
            cross_source_reconciliation=_source_presence(
                candidate.iata_code,
                profiles_by_source,
                ("P-1.2", "P-5.2", "P-12(a)", "T-100"),
            ),
            carrier_code_stability=_source_presence(
                candidate.iata_code,
                profiles_by_source,
                tuple(profiles_by_source),
            ),
        )
        for candidate in candidates
    }


def _period_coverage(iata_code: str, profile: DatasetProfile | None) -> float:
    if profile is None:
        return 0
    periods = profile.periods_by_airline.get(iata_code, ())
    max_periods = max((len(period_list) for period_list in profile.periods_by_airline.values()), default=0)
    if max_periods == 0:
        return 0
    return len(periods) / max_periods


def _source_presence(
    iata_code: str,
    profiles_by_source: dict[str, DatasetProfile],
    source_codes: tuple[str, ...],
) -> float:
    if not source_codes:
        return 0

    present_sources = sum(
        1
        for source_code in source_codes
        if iata_code in profiles_by_source.get(source_code, DatasetProfile(0, (), {})).periods_by_airline
    )
    return present_sources / len(source_codes)
