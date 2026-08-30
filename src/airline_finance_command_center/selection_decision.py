from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from airline_finance_command_center.airline_selection import RankedAirline
from airline_finance_command_center.config import ProjectConfig
from airline_finance_command_center.profiling import DatasetProfile


@dataclass(frozen=True)
class AirlineSelectionDecision:
    status: str
    selected_iata_code: str | None
    selected_name: str | None
    score: float | None
    score_margin: float | None
    reasons: tuple[str, ...]


def decide_airline(
    config: ProjectConfig,
    profiles_by_source: dict[str, DatasetProfile],
    ranking: tuple[RankedAirline, ...],
) -> AirlineSelectionDecision:
    gates = config.decision_gates

    if not ranking:
        return AirlineSelectionDecision(
            status="blocked",
            selected_iata_code=None,
            selected_name=None,
            score=None,
            score_margin=None,
            reasons=("No airline ranking is available.",),
        )

    missing_sources = [
        source_code
        for source_code in gates.required_core_sources
        if source_code not in profiles_by_source
    ]
    if missing_sources:
        return AirlineSelectionDecision(
            status="blocked",
            selected_iata_code=None,
            selected_name=None,
            score=None,
            score_margin=None,
            reasons=(
                "Missing required core sources: " + ", ".join(missing_sources),
            ),
        )

    winner = ranking[0]
    reasons: list[str] = []

    if winner.score < gates.minimum_weighted_score:
        reasons.append(
            f"Top score {winner.score:.3f} is below minimum "
            f"{gates.minimum_weighted_score:.3f}."
        )

    expected_periods = {
        "P-1.2": config.retention.analytical_quarterly_periods,
        "P-5.2": config.retention.analytical_quarterly_periods,
        "P-12(a)": config.retention.analytical_monthly_periods,
        "T-100": config.retention.analytical_monthly_periods,
    }

    for source_code in gates.required_core_sources:
        expected = expected_periods.get(source_code)
        profile = profiles_by_source[source_code]
        if expected is None or expected <= 0:
            continue
        coverage = min(profile.period_count(winner.iata_code) / expected, 1.0)
        if coverage < gates.minimum_core_source_coverage:
            reasons.append(
                f"{source_code} coverage {coverage:.3f} is below minimum "
                f"{gates.minimum_core_source_coverage:.3f}."
            )

    score_margin: float | None = None
    if len(ranking) > 1:
        score_margin = round(winner.score - ranking[1].score, 12)
        if score_margin < gates.minimum_score_margin:
            reasons.append(
                f"Score margin {score_margin:.3f} is below minimum "
                f"{gates.minimum_score_margin:.3f}; manual review required."
            )

    if reasons:
        return AirlineSelectionDecision(
            status="manual_review",
            selected_iata_code=None,
            selected_name=None,
            score=winner.score,
            score_margin=score_margin,
            reasons=tuple(reasons),
        )

    return AirlineSelectionDecision(
        status="selected",
        selected_iata_code=winner.iata_code,
        selected_name=winner.name,
        score=winner.score,
        score_margin=score_margin,
        reasons=("All configured selection gates passed.",),
    )


def decision_to_dict(decision: AirlineSelectionDecision) -> dict[str, Any]:
    return asdict(decision)
