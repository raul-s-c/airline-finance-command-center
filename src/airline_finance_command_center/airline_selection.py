from __future__ import annotations

from dataclasses import dataclass

from airline_finance_command_center.config import AirlineCandidate
from airline_finance_command_center.profiling import DatasetProfile


SCORING_CRITERIA = (
    "p12_financial_continuity",
    "p52_aircraft_expense_detail",
    "p12a_operating_stats_coverage",
    "t100_operational_coverage",
    "network_and_fleet_analytical_value",
    "cross_source_reconciliation",
    "carrier_code_stability",
)


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


def validate_scoring_weights(weights: dict[str, float]) -> None:
    missing = set(SCORING_CRITERIA) - set(weights)
    extra = set(weights) - set(SCORING_CRITERIA)

    if missing or extra:
        raise ValueError(
            f"Invalid scoring criteria. Missing={sorted(missing)}, extra={sorted(extra)}"
        )

    if any(weight < 0 for weight in weights.values()):
        raise ValueError("Scoring weights cannot be negative")

    if abs(sum(weights.values()) - 1.0) > 1e-9:
        raise ValueError("Scoring weights must sum to 1.0")


def calculate_weighted_score(
    coverage_score: AirlineCoverageScore,
    weights: dict[str, float],
) -> float:
    validate_scoring_weights(weights)

    values = [getattr(coverage_score, criterion) for criterion in SCORING_CRITERIA]
    if any(value < 0 or value > 1 for value in values):
        raise ValueError("All airline scoring inputs must be between 0 and 1")

    return sum(
        getattr(coverage_score, criterion) * weights[criterion]
        for criterion in SCORING_CRITERIA
    )


def rank_airlines(
    candidates: tuple[AirlineCandidate, ...],
    coverage_scores: dict[str, AirlineCoverageScore],
    weights: dict[str, float],
) -> tuple[RankedAirline, ...]:
    validate_scoring_weights(weights)
    priorities = {candidate.iata_code: candidate.provisional_priority for candidate in candidates}

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
        key=lambda airline: (
            -airline.score,
            priorities.get(airline.iata_code, 999),
            airline.iata_code,
        ),
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
    expected_periods_by_source: dict[str, int] | None = None,
) -> dict[str, AirlineCoverageScore]:
    expected_periods_by_source = expected_periods_by_source or {}

    return {
        candidate.iata_code: AirlineCoverageScore(
            iata_code=candidate.iata_code,
            p12_financial_continuity=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("P-1.2"),
                expected_periods_by_source.get("P-1.2"),
            ),
            p52_aircraft_expense_detail=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("P-5.2"),
                expected_periods_by_source.get("P-5.2"),
            ),
            p12a_operating_stats_coverage=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("P-12(a)"),
                expected_periods_by_source.get("P-12(a)"),
            ),
            t100_operational_coverage=_period_coverage(
                candidate.iata_code,
                profiles_by_source.get("T-100"),
                expected_periods_by_source.get("T-100"),
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


def _period_coverage(
    iata_code: str,
    profile: DatasetProfile | None,
    expected_periods: int | None = None,
) -> float:
    if profile is None:
        return 0.0

    available_periods = profile.period_count(iata_code)
    if available_periods == 0:
        return 0.0

    denominator = expected_periods
    if denominator is None:
        denominator = max(
            (profile.period_count(code) for code in profile.periods_by_airline),
            default=0,
        )

    if denominator <= 0:
        return 0.0

    return min(available_periods / denominator, 1.0)


def _source_presence(
    iata_code: str,
    profiles_by_source: dict[str, DatasetProfile],
    source_codes: tuple[str, ...],
) -> float:
    if not source_codes:
        return 0.0

    present_sources = sum(
        1
        for source_code in source_codes
        if (profile := profiles_by_source.get(source_code)) is not None
        and profile.has_airline(iata_code)
    )
    return present_sources / len(source_codes)
