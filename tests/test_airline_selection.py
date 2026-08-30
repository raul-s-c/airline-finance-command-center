import pytest

from airline_finance_command_center.airline_selection import (
    AirlineCoverageScore,
    calculate_weighted_score,
    estimate_coverage_scores,
    rank_airlines,
)
from airline_finance_command_center.config import AirlineCandidate
from airline_finance_command_center.profiling import DatasetProfile


WEIGHTS = {
    "p12_financial_continuity": 0.20,
    "p52_aircraft_expense_detail": 0.25,
    "p12a_operating_stats_coverage": 0.10,
    "t100_operational_coverage": 0.20,
    "network_and_fleet_analytical_value": 0.10,
    "cross_source_reconciliation": 0.10,
    "carrier_code_stability": 0.05,
}

CANDIDATES = (
    AirlineCandidate("Delta Air Lines", "DL", 1),
    AirlineCandidate("American Airlines", "AA", 2),
    AirlineCandidate("United Airlines", "UA", 3),
    AirlineCandidate("Southwest Airlines", "WN", 4),
)


def test_weighted_score_is_deterministic() -> None:
    score = AirlineCoverageScore(
        iata_code="DL",
        p12_financial_continuity=1.0,
        p52_aircraft_expense_detail=0.8,
        p12a_operating_stats_coverage=1.0,
        t100_operational_coverage=0.9,
        network_and_fleet_analytical_value=1.0,
        cross_source_reconciliation=0.75,
        carrier_code_stability=1.0,
    )

    assert calculate_weighted_score(score, WEIGHTS) == pytest.approx(0.905)


def test_invalid_weights_are_rejected() -> None:
    invalid = dict(WEIGHTS)
    invalid["t100_operational_coverage"] = 0.30

    score = AirlineCoverageScore("DL", 1, 1, 1, 1, 1, 1, 1)

    with pytest.raises(ValueError, match="sum to 1.0"):
        calculate_weighted_score(score, invalid)


def test_scores_must_stay_between_zero_and_one() -> None:
    score = AirlineCoverageScore("DL", 1.1, 1, 1, 1, 1, 1, 1)

    with pytest.raises(ValueError, match="between 0 and 1"):
        calculate_weighted_score(score, WEIGHTS)


def test_period_coverage_uses_expected_window_and_caps_at_one() -> None:
    profiles = {
        "P-1.2": DatasetProfile(
            row_count=100,
            columns=("carrier", "period"),
            periods_by_airline={
                "DL": tuple(f"Q{i}" for i in range(1, 9)),
                "AA": tuple(f"Q{i}" for i in range(1, 5)),
            },
        )
    }

    scores = estimate_coverage_scores(
        CANDIDATES,
        profiles,
        expected_periods_by_source={"P-1.2": 8},
    )

    assert scores["DL"].p12_financial_continuity == 1.0
    assert scores["AA"].p12_financial_continuity == 0.5
    assert scores["UA"].p12_financial_continuity == 0.0


def test_source_presence_feeds_cross_source_criteria() -> None:
    profiles = {
        "P-1.2": DatasetProfile(10, (), {"DL": ("2026Q1",)}),
        "P-5.2": DatasetProfile(10, (), {"DL": ("2026Q1",)}),
        "P-12(a)": DatasetProfile(10, (), {"DL": ("2026-01",)}),
        "T-100": DatasetProfile(10, (), {"DL": ("2026-01",)}),
        "B-43": DatasetProfile(10, (), {"DL": ("2026",)}),
    }

    dl = estimate_coverage_scores(CANDIDATES, profiles)["DL"]

    assert dl.network_and_fleet_analytical_value == 1.0
    assert dl.cross_source_reconciliation == 1.0
    assert dl.carrier_code_stability == 1.0


def test_ranking_orders_by_score() -> None:
    scores = {
        "DL": AirlineCoverageScore("DL", 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9),
        "AA": AirlineCoverageScore("AA", 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8),
        "UA": AirlineCoverageScore("UA", 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
        "WN": AirlineCoverageScore("WN", 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7),
    }

    ranked = rank_airlines(CANDIDATES, scores, WEIGHTS)

    assert [airline.iata_code for airline in ranked] == ["UA", "DL", "AA", "WN"]
    assert [airline.rank for airline in ranked] == [1, 2, 3, 4]


def test_tie_break_uses_provisional_priority() -> None:
    identical = AirlineCoverageScore("DL", 1, 1, 1, 1, 1, 1, 1)
    scores = {
        candidate.iata_code: AirlineCoverageScore(
            candidate.iata_code,
            identical.p12_financial_continuity,
            identical.p52_aircraft_expense_detail,
            identical.p12a_operating_stats_coverage,
            identical.t100_operational_coverage,
            identical.network_and_fleet_analytical_value,
            identical.cross_source_reconciliation,
            identical.carrier_code_stability,
        )
        for candidate in CANDIDATES
    }

    ranked = rank_airlines(CANDIDATES, scores, WEIGHTS)

    assert [airline.iata_code for airline in ranked] == ["DL", "AA", "UA", "WN"]
