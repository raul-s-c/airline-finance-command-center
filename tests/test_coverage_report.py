from airline_finance_command_center.config import load_config
from airline_finance_command_center.coverage_report import build_coverage_report, render_markdown
from airline_finance_command_center.profiling import DatasetProfile


def _profile(periods: dict[str, tuple[str, ...]]) -> DatasetProfile:
    return DatasetProfile(
        row_count=100,
        columns=("CARRIER", "YEAR", "MONTH"),
        periods_by_airline=periods,
    )


def test_coverage_report_builds_ranking_and_winner() -> None:
    config = load_config("config/config.yaml")
    profiles = {
        "P-1.2": _profile({
            "DL": tuple(f"2024-Q{i}" for i in range(1, 9)),
            "AA": tuple(f"2024-Q{i}" for i in range(1, 7)),
            "UA": tuple(f"2024-Q{i}" for i in range(1, 8)),
            "WN": tuple(f"2024-Q{i}" for i in range(1, 5)),
        }),
        "P-5.2": _profile({
            "DL": tuple(f"2024-Q{i}" for i in range(1, 9)),
            "AA": tuple(f"2024-Q{i}" for i in range(1, 8)),
            "UA": tuple(f"2024-Q{i}" for i in range(1, 8)),
            "WN": tuple(f"2024-Q{i}" for i in range(1, 7)),
        }),
        "P-12(a)": _profile({
            "DL": tuple(f"2025-{i:02d}" for i in range(1, 25)),
            "AA": tuple(f"2025-{i:02d}" for i in range(1, 23)),
            "UA": tuple(f"2025-{i:02d}" for i in range(1, 24)),
            "WN": tuple(f"2025-{i:02d}" for i in range(1, 21)),
        }),
        "T-100": _profile({
            "DL": tuple(f"2025-{i:02d}" for i in range(1, 25)),
            "AA": tuple(f"2025-{i:02d}" for i in range(1, 24)),
            "UA": tuple(f"2025-{i:02d}" for i in range(1, 23)),
            "WN": tuple(f"2025-{i:02d}" for i in range(1, 24)),
        }),
        "B-43": _profile({"DL": ("2025",), "AA": ("2025",), "UA": ("2025",), "WN": ("2025",)}),
    }

    report = build_coverage_report(config, profiles)

    assert report["status"] == "scored"
    assert report["winner"]["iata_code"] == "DL"
    assert report["ranking"][0]["rank"] == 1
    assert report["sources"]["P-1.2"]["periods_by_airline"]["AA"] == 6


def test_markdown_contains_matrix_and_provisional_result() -> None:
    config = load_config("config/config.yaml")
    profiles = {
        "P-1.2": _profile({"DL": ("2025-Q1",), "AA": ("2025-Q1",), "UA": ("2025-Q1",), "WN": ("2025-Q1",)}),
    }

    markdown = render_markdown(build_coverage_report(config, profiles))

    assert "# Airline Coverage Report" in markdown
    assert "| P-1.2 |" in markdown
    assert "## Scoring" in markdown
    assert "provisional" in markdown.lower()
