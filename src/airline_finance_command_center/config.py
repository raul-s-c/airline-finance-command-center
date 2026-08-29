from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class RetentionPolicy:
    raw_quarterly_periods: int
    raw_monthly_periods: int
    analytical_quarterly_periods: int
    analytical_monthly_periods: int
    public_quarterly_periods: int
    public_monthly_periods: int
    trailing_refresh_quarters: int
    trailing_refresh_months: int


@dataclass(frozen=True)
class AirlineCandidate:
    name: str
    iata_code: str
    provisional_priority: int


@dataclass(frozen=True)
class ProjectConfig:
    retention: RetentionPolicy
    airline_candidates: tuple[AirlineCandidate, ...]
    scoring_weights: dict[str, float]


def load_config(path: str | Path = "config/config.yaml") -> ProjectConfig:
    config_path = Path(path)
    with config_path.open("r", encoding="utf-8") as file:
        raw: dict[str, Any] = yaml.safe_load(file)

    retention = RetentionPolicy(**raw["retention"])
    candidates = tuple(
        AirlineCandidate(**candidate)
        for candidate in raw["airline_selection"]["candidates"]
    )
    scoring_weights = dict(raw["airline_selection"]["scoring_weights"])

    return ProjectConfig(
        retention=retention,
        airline_candidates=candidates,
        scoring_weights=scoring_weights,
    )
