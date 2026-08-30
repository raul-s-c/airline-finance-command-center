from airline_finance_command_center.config import load_config


def test_config_loads_retention_policy() -> None:
    config = load_config("config/config.yaml")

    assert config.retention.analytical_quarterly_periods == 8
    assert config.retention.analytical_monthly_periods == 24
    assert config.retention.public_quarterly_periods <= config.retention.analytical_quarterly_periods
    assert config.retention.public_monthly_periods <= config.retention.analytical_monthly_periods


def test_airline_selection_weights_sum_to_one() -> None:
    config = load_config("config/config.yaml")

    assert round(sum(config.scoring_weights.values()), 6) == 1


def test_delta_is_candidate_but_not_only_candidate() -> None:
    config = load_config("config/config.yaml")
    codes = {candidate.iata_code for candidate in config.airline_candidates}

    assert "DL" in codes
    assert {"AA", "UA", "WN"}.issubset(codes)
