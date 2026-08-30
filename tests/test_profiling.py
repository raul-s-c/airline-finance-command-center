from __future__ import annotations

from pathlib import Path

import pytest

from airline_finance_command_center.profiling import profile_csv, profile_directory


def test_profile_csv_extracts_monthly_periods_and_filters_candidates(tmp_path: Path) -> None:
    path = tmp_path / "T-100.csv"
    path.write_text(
        "REPORTING_CARRIER,YEAR,MONTH,VALUE\n"
        "DL,2025,1,10\n"
        "DL,2025,2,11\n"
        "AA,2025,1,12\n"
        "ZZ,2025,1,99\n",
        encoding="utf-8",
    )

    profile = profile_csv(path, candidate_codes={"DL", "AA", "UA", "WN"})

    assert profile.row_count == 4
    assert profile.periods_by_airline["DL"] == ("2025-01", "2025-02")
    assert profile.periods_by_airline["AA"] == ("2025-01",)
    assert "ZZ" not in profile.periods_by_airline


def test_profile_csv_extracts_quarterly_periods(tmp_path: Path) -> None:
    path = tmp_path / "P-1.2.csv"
    path.write_text(
        "UNIQUE_CARRIER,YEAR,QUARTER,VALUE\n"
        "DL,2025,1,10\n"
        "DL,2025,Q2,11\n",
        encoding="utf-8",
    )

    profile = profile_csv(path, candidate_codes={"DL"})

    assert profile.periods_by_airline["DL"] == ("2025-Q1", "2025-Q2")


def test_profile_directory_profiles_only_existing_sources(tmp_path: Path) -> None:
    (tmp_path / "T100.csv").write_text(
        "CARRIER,YEAR,MONTH\nDL,2025,1\n",
        encoding="utf-8",
    )

    profiles = profile_directory(
        tmp_path,
        ("P-1.2", "T-100"),
        candidate_codes={"DL"},
    )

    assert set(profiles) == {"T-100"}
    assert profiles["T-100"].period_count("DL") == 1


def test_profile_csv_fails_when_carrier_column_cannot_be_identified(tmp_path: Path) -> None:
    path = tmp_path / "unknown.csv"
    path.write_text("YEAR,MONTH,VALUE\n2025,1,10\n", encoding="utf-8")

    with pytest.raises(ValueError, match="Could not identify carrier column"):
        profile_csv(path)
