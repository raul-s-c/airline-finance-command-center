from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from airline_finance_command_center.airline_selection import (
    estimate_coverage_scores,
    rank_airlines,
)
from airline_finance_command_center.config import ProjectConfig, load_config
from airline_finance_command_center.profiling import DatasetProfile

SOURCE_CODES = ("P-1.2", "P-5.2", "P-12(a)", "T-100", "B-43")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="afcc-discover",
        description="Build the Airline Finance Command Center phase-0 discovery report.",
    )
    parser.add_argument(
        "--config",
        default="config/config.yaml",
        help="Path to project YAML configuration.",
    )
    parser.add_argument(
        "--profiles",
        help="Optional JSON file containing precomputed DatasetProfile data by BTS source.",
    )
    parser.add_argument(
        "--output",
        default="reports/discovery_report.json",
        help="Path where the discovery JSON report will be written.",
    )
    return parser


def load_profiles(path: str | Path) -> dict[str, DatasetProfile]:
    profile_path = Path(path)
    with profile_path.open("r", encoding="utf-8") as file:
        raw: dict[str, Any] = json.load(file)

    profiles: dict[str, DatasetProfile] = {}
    for source_code, payload in raw.items():
        profiles[source_code] = DatasetProfile(
            row_count=int(payload.get("row_count", 0)),
            columns=tuple(payload.get("columns", ())),
            periods_by_airline={
                code: tuple(periods)
                for code, periods in payload.get("periods_by_airline", {}).items()
            },
        )
    return profiles


def expected_periods(config: ProjectConfig) -> dict[str, int]:
    return {
        "P-1.2": config.retention.analytical_quarterly_periods,
        "P-5.2": config.retention.analytical_quarterly_periods,
        "P-12(a)": config.retention.analytical_monthly_periods,
        "T-100": config.retention.analytical_monthly_periods,
    }


def build_discovery_report(
    config: ProjectConfig,
    profiles_by_source: dict[str, DatasetProfile] | None = None,
) -> dict[str, Any]:
    profiles_by_source = profiles_by_source or {}
    report: dict[str, Any] = {
        "status": "profiles_required" if not profiles_by_source else "scored",
        "candidate_airlines": [asdict(candidate) for candidate in config.airline_candidates],
        "sources": list(SOURCE_CODES),
        "expected_periods_by_source": expected_periods(config),
        "profiles_loaded": sorted(profiles_by_source),
        "scores": [],
        "ranking": [],
    }

    if not profiles_by_source:
        return report

    coverage_scores = estimate_coverage_scores(
        config.airline_candidates,
        profiles_by_source,
        expected_periods(config),
    )
    ranking = rank_airlines(
        config.airline_candidates,
        coverage_scores,
        config.scoring_weights,
    )

    report["scores"] = [
        asdict(coverage_scores[candidate.iata_code])
        for candidate in config.airline_candidates
        if candidate.iata_code in coverage_scores
    ]
    report["ranking"] = [asdict(airline) for airline in ranking]
    return report


def write_report(report: dict[str, Any], output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = load_config(args.config)
    profiles = load_profiles(args.profiles) if args.profiles else None
    report = build_discovery_report(config, profiles)
    output = write_report(report, args.output)
    print(f"Discovery report written to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
