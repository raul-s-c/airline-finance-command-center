from __future__ import annotations

import json
from pathlib import Path

from airline_finance_command_center.cli import (
    build_discovery_report,
    load_profiles,
    write_report,
)
from airline_finance_command_center.config import load_config


def test_build_discovery_report_without_profiles_marks_profiles_required() -> None:
    config = load_config("config/config.yaml")

    report = build_discovery_report(config)

    assert report["status"] == "profiles_required"
    assert report["ranking"] == []
    assert report["scores"] == []


def test_load_profiles_and_build_ranked_report(tmp_path: Path) -> None:
    profile_path = tmp_path / "profiles.json"
    profile_path.write_text(
        json.dumps(
            {
                "P-1.2": {
                    "row_count": 100,
                    "columns": ["carrier", "period"],
                    "periods_by_airline": {
                        "DL": [f"Q{i}" for i in range(1, 9)],
                        "AA": [f"Q{i}" for i in range(1, 7)],
                    },
                },
                "P-5.2": {
                    "row_count": 100,
                    "columns": ["carrier", "period"],
                    "periods_by_airline": {
                        "DL": [f"Q{i}" for i in range(1, 9)],
                        "AA": [f"Q{i}" for i in range(1, 5)],
                    },
                },
                "P-12(a)": {
                    "row_count": 100,
                    "columns": ["carrier", "period"],
                    "periods_by_airline": {
                        "DL": [f"M{i}" for i in range(1, 25)],
                        "AA": [f"M{i}" for i in range(1, 19)],
                    },
                },
                "T-100": {
                    "row_count": 100,
                    "columns": ["carrier", "period"],
                    "periods_by_airline": {
                        "DL": [f"M{i}" for i in range(1, 25)],
                        "AA": [f"M{i}" for i in range(1, 13)],
                    },
                },
                "B-43": {
                    "row_count": 10,
                    "columns": ["carrier"],
                    "periods_by_airline": {"DL": ["2026"], "AA": ["2026"]},
                },
            }
        ),
        encoding="utf-8",
    )

    config = load_config("config/config.yaml")
    profiles = load_profiles(profile_path)
    report = build_discovery_report(config, profiles)

    assert report["status"] == "scored"
    assert report["ranking"][0]["iata_code"] == "DL"
    assert report["ranking"][0]["rank"] == 1
    assert len(report["scores"]) == 4


def test_write_report_creates_parent_folder(tmp_path: Path) -> None:
    output = tmp_path / "reports" / "report.json"

    result = write_report({"status": "ok"}, output)

    assert result == output
    assert json.loads(output.read_text(encoding="utf-8")) == {"status": "ok"}
