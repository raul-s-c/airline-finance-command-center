from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

from airline_finance_command_center.airline_selection import (
    AirlineCoverageScore,
    RankedAirline,
    estimate_coverage_scores,
    rank_airlines,
)
from airline_finance_command_center.config import ProjectConfig
from airline_finance_command_center.profiling import DatasetProfile


SOURCE_LABELS = {
    "P-1.2": "Financial continuity",
    "P-5.2": "Aircraft expense detail",
    "P-12(a)": "Operating statistics",
    "T-100": "Traffic and capacity",
    "B-43": "Fleet reference",
}


def expected_periods(config: ProjectConfig) -> dict[str, int]:
    return {
        "P-1.2": config.retention.analytical_quarterly_periods,
        "P-5.2": config.retention.analytical_quarterly_periods,
        "P-12(a)": config.retention.analytical_monthly_periods,
        "T-100": config.retention.analytical_monthly_periods,
    }


def build_coverage_report(
    config: ProjectConfig,
    profiles_by_source: dict[str, DatasetProfile],
) -> dict[str, Any]:
    expected = expected_periods(config)
    coverage_scores = estimate_coverage_scores(
        config.airline_candidates,
        profiles_by_source,
        expected,
    )
    ranking = rank_airlines(
        config.airline_candidates,
        coverage_scores,
        config.scoring_weights,
    )

    source_coverage: dict[str, dict[str, Any]] = {}
    for source_code, profile in sorted(profiles_by_source.items()):
        source_coverage[source_code] = {
            "label": SOURCE_LABELS.get(source_code, source_code),
            "row_count": profile.row_count,
            "column_count": len(profile.columns),
            "expected_periods": expected.get(source_code),
            "periods_by_airline": {
                candidate.iata_code: profile.period_count(candidate.iata_code)
                for candidate in config.airline_candidates
            },
        }

    return {
        "status": "scored" if profiles_by_source else "profiles_required",
        "expected_periods_by_source": expected,
        "sources": source_coverage,
        "scores": {
            code: asdict(score)
            for code, score in coverage_scores.items()
        },
        "ranking": [asdict(item) for item in ranking],
        "winner": asdict(ranking[0]) if ranking else None,
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Airline Coverage Report",
        "",
        f"Status: {report['status']}",
        "",
    ]

    if report["status"] != "scored":
        lines.extend([
            "No BTS profiles were available, so no airline ranking was produced.",
            "",
        ])
        return "\n".join(lines)

    lines.extend([
        "## Source coverage",
        "",
        "| Source | DL | AA | UA | WN | Expected |",
        "|---|---:|---:|---:|---:|---:|",
    ])

    for source_code, source in report["sources"].items():
        periods = source["periods_by_airline"]
        expected = source["expected_periods"]
        lines.append(
            f"| {source_code} | {periods.get('DL', 0)} | {periods.get('AA', 0)} | "
            f"{periods.get('UA', 0)} | {periods.get('WN', 0)} | "
            f"{expected if expected is not None else '-'} |"
        )

    lines.extend([
        "",
        "## Scoring",
        "",
        "| Rank | Airline | Code | Score |",
        "|---:|---|---|---:|",
    ])

    for item in report["ranking"]:
        lines.append(
            f"| {item['rank']} | {item['name']} | {item['iata_code']} | "
            f"{item['score'] * 100:.1f}% |"
        )

    winner = report.get("winner")
    if winner:
        lines.extend([
            "",
            "## Provisional result",
            "",
            f"Highest coverage score: {winner['name']} ({winner['iata_code']}) "
            f"with {winner['score'] * 100:.1f}%.",
            "",
            "This result is provisional until source mapping and reconciliation checks are complete.",
            "",
        ])

    return "\n".join(lines)


def write_markdown(report: dict[str, Any], path: str | Path) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_markdown(report), encoding="utf-8")
    return output_path
