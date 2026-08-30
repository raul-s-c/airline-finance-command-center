from airline_finance_command_center.airline_selection import RankedAirline
from airline_finance_command_center.config import load_config
from airline_finance_command_center.profiling import DatasetProfile
from airline_finance_command_center.selection_decision import decide_airline


def _profile(periods: int, codes=("DL", "AA", "UA", "WN")) -> DatasetProfile:
    values = tuple(str(index) for index in range(periods))
    return DatasetProfile(
        row_count=periods * len(codes),
        columns=("CARRIER", "PERIOD"),
        periods_by_airline={code: values for code in codes},
    )


def test_selection_is_blocked_when_core_source_is_missing() -> None:
    config = load_config("config/config.yaml")
    ranking = (
        RankedAirline("DL", "Delta Air Lines", 0.90, 1),
        RankedAirline("AA", "American Airlines", 0.80, 2),
    )
    profiles = {
        "P-1.2": _profile(8),
        "P-5.2": _profile(8),
        "P-12(a)": _profile(24),
    }

    decision = decide_airline(config, profiles, ranking)

    assert decision.status == "blocked"
    assert decision.selected_iata_code is None
    assert "T-100" in decision.reasons[0]


def test_selection_requires_manual_review_when_score_is_too_low() -> None:
    config = load_config("config/config.yaml")
    ranking = (
        RankedAirline("DL", "Delta Air Lines", 0.70, 1),
        RankedAirline("AA", "American Airlines", 0.60, 2),
    )
    profiles = {
        "P-1.2": _profile(8),
        "P-5.2": _profile(8),
        "P-12(a)": _profile(24),
        "T-100": _profile(24),
    }

    decision = decide_airline(config, profiles, ranking)

    assert decision.status == "manual_review"
    assert decision.selected_iata_code is None
    assert any("below minimum" in reason for reason in decision.reasons)


def test_selection_requires_manual_review_when_core_coverage_is_too_low() -> None:
    config = load_config("config/config.yaml")
    ranking = (
        RankedAirline("DL", "Delta Air Lines", 0.90, 1),
        RankedAirline("AA", "American Airlines", 0.80, 2),
    )
    profiles = {
        "P-1.2": _profile(8),
        "P-5.2": DatasetProfile(
            row_count=10,
            columns=("CARRIER", "PERIOD"),
            periods_by_airline={
                "DL": ("1", "2", "3"),
                "AA": tuple(str(index) for index in range(8)),
            },
        ),
        "P-12(a)": _profile(24),
        "T-100": _profile(24),
    }

    decision = decide_airline(config, profiles, ranking)

    assert decision.status == "manual_review"
    assert any("P-5.2 coverage" in reason for reason in decision.reasons)


def test_selection_requires_manual_review_for_near_tie() -> None:
    config = load_config("config/config.yaml")
    ranking = (
        RankedAirline("DL", "Delta Air Lines", 0.90, 1),
        RankedAirline("AA", "American Airlines", 0.89, 2),
    )
    profiles = {
        "P-1.2": _profile(8),
        "P-5.2": _profile(8),
        "P-12(a)": _profile(24),
        "T-100": _profile(24),
    }

    decision = decide_airline(config, profiles, ranking)

    assert decision.status == "manual_review"
    assert any("Score margin" in reason for reason in decision.reasons)


def test_selection_succeeds_when_all_gates_pass() -> None:
    config = load_config("config/config.yaml")
    ranking = (
        RankedAirline("DL", "Delta Air Lines", 0.90, 1),
        RankedAirline("AA", "American Airlines", 0.82, 2),
    )
    profiles = {
        "P-1.2": _profile(8),
        "P-5.2": _profile(8),
        "P-12(a)": _profile(24),
        "T-100": _profile(24),
    }

    decision = decide_airline(config, profiles, ranking)

    assert decision.status == "selected"
    assert decision.selected_iata_code == "DL"
    assert decision.selected_name == "Delta Air Lines"
    assert decision.score_margin == 0.08
