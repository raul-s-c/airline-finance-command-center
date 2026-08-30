from __future__ import annotations

import argparse
import json
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from airline_finance_command_center.bts_delta_pipeline import (
    DELTA_AIRLINE_ID,
    MONTHS_TO_KEEP,
    QUARTERS_TO_KEEP,
    _aggregate_b43,
    _aggregate_p12,
    _aggregate_p12a,
    _aggregate_p52,
    _download_recent_years,
    _period_label,
)
from airline_finance_command_center.transtats_csv import integer, is_delta, iter_zip_rows, number


def _empty_metrics() -> defaultdict[str, float]:
    return defaultdict(float)


def _row_metrics(row: dict[str, str]) -> dict[str, float]:
    passengers = number(row.get("passengers"))
    seats = number(row.get("seats"))
    departures = number(row.get("departures_performed"))
    distance = number(row.get("distance"))
    air_time = number(row.get("air_time"))
    return {
        "departures_performed": departures,
        "passengers": passengers,
        "available_seats": seats,
        "air_time_minutes": air_time,
        "rpm": passengers * distance,
        "asm": seats * distance,
    }


def _add_metrics(target: dict[str, float], metrics: dict[str, float]) -> None:
    for name, value in metrics.items():
        target[name] = target.get(name, 0.0) + value


def _finish_metrics(metrics: dict[str, float]) -> dict[str, Any]:
    output: dict[str, Any] = dict(metrics)
    asm = number(output.get("asm"))
    rpm = number(output.get("rpm"))
    seats = number(output.get("available_seats"))
    passengers = number(output.get("passengers"))
    output["load_factor"] = rpm / asm if asm else None
    output["seat_load_factor"] = passengers / seats if seats else None
    return output


def aggregate_t100_rows(
    rows_by_scope: dict[str, Iterable[dict[str, str]]],
    *,
    months_to_keep: int = MONTHS_TO_KEEP,
    top_route_count: int = 30,
    top_aircraft_count: int = 30,
    top_airport_count: int = 30,
) -> dict[str, Any]:
    """Aggregate T-100 with one consistent retention window across every output."""

    monthly: dict[tuple[int, int], dict[str, float]] = defaultdict(_empty_metrics)
    monthly_scope: dict[tuple[int, int], dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(_empty_metrics)
    )
    route_period: dict[tuple[int, int], dict[tuple[str, str, str], dict[str, Any]]] = defaultdict(dict)
    aircraft_period: dict[tuple[int, int], dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(_empty_metrics)
    )
    airport_period: dict[tuple[int, int], dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(_empty_metrics)
    )

    for scope, rows in rows_by_scope.items():
        for row in rows:
            if not is_delta(row):
                continue
            year = integer(row.get("year"))
            month = integer(row.get("month"))
            if not year or not month:
                continue
            metrics = _row_metrics(row)
            if not any(metrics.values()):
                continue
            period = (year, month)
            _add_metrics(monthly[period], metrics)
            _add_metrics(monthly_scope[period][scope], metrics)

            origin = row.get("origin", "").strip() or row.get("origin_airport_id", "").strip()
            destination = row.get("dest", "").strip() or row.get("dest_airport_id", "").strip()
            route_key = (origin, destination, scope)
            route = route_period[period].setdefault(
                route_key,
                {
                    "origin": origin,
                    "destination": destination,
                    "origin_city": row.get("origin_city_name", ""),
                    "destination_city": row.get("dest_city_name", ""),
                    "scope": scope,
                },
            )
            for name, value in metrics.items():
                route[name] = number(route.get(name)) + value

            aircraft_type = row.get("aircraft_type", "").strip() or "unknown"
            _add_metrics(aircraft_period[period][aircraft_type], metrics)

            for code in (origin, destination):
                if code:
                    airport_period[period][code]["passengers_segment_ends"] += metrics["passengers"]
                    airport_period[period][code]["departures_or_arrivals"] += metrics["departures_performed"]

    retained_periods = sorted(monthly)[-months_to_keep:]

    history: list[dict[str, Any]] = []
    for year, month in retained_periods:
        base = _finish_metrics(monthly[(year, month)])
        base["scope"] = {
            scope: _finish_metrics(values)
            for scope, values in monthly_scope[(year, month)].items()
        }
        history.append({"period": _period_label(year, month, "monthly"), **base})

    route_totals: dict[tuple[str, str, str], dict[str, Any]] = {}
    aircraft_totals: dict[str, dict[str, float]] = defaultdict(_empty_metrics)
    airport_totals: dict[str, dict[str, float]] = defaultdict(_empty_metrics)

    for period in retained_periods:
        for route_key, row in route_period[period].items():
            total = route_totals.setdefault(
                route_key,
                {
                    "origin": row["origin"],
                    "destination": row["destination"],
                    "origin_city": row.get("origin_city", ""),
                    "destination_city": row.get("destination_city", ""),
                    "scope": row["scope"],
                },
            )
            _add_metrics(
                total,
                {
                    "departures_performed": number(row.get("departures_performed")),
                    "passengers": number(row.get("passengers")),
                    "available_seats": number(row.get("available_seats")),
                    "air_time_minutes": number(row.get("air_time_minutes")),
                    "rpm": number(row.get("rpm")),
                    "asm": number(row.get("asm")),
                },
            )
        for aircraft_type, metrics in aircraft_period[period].items():
            _add_metrics(aircraft_totals[aircraft_type], metrics)
        for airport, metrics in airport_period[period].items():
            _add_metrics(airport_totals[airport], metrics)

    top_route_keys = [
        key
        for key, _ in sorted(
            route_totals.items(), key=lambda item: number(item[1].get("passengers")), reverse=True
        )[:top_route_count]
    ]
    top_aircraft_types = [
        key
        for key, _ in sorted(
            aircraft_totals.items(), key=lambda item: number(item[1].get("passengers")), reverse=True
        )[:top_aircraft_count]
    ]

    top_routes = [_finish_metrics(route_totals[key]) for key in top_route_keys]
    aircraft_mix = [
        {"aircraft_type": code, **_finish_metrics(aircraft_totals[code])}
        for code in top_aircraft_types
    ]
    top_airports = [
        {"airport": code, **dict(values)}
        for code, values in sorted(
            airport_totals.items(),
            key=lambda item: number(item[1].get("passengers_segment_ends")),
            reverse=True,
        )[:top_airport_count]
    ]

    route_history: dict[str, list[dict[str, Any]]] = {}
    for route_key in top_route_keys:
        origin, destination, scope = route_key
        label = f"{origin}-{destination}|{scope}"
        rows: list[dict[str, Any]] = []
        for year, month in retained_periods:
            row = route_period[(year, month)].get(route_key)
            if not row:
                continue
            rows.append(
                {
                    "period": _period_label(year, month, "monthly"),
                    **_finish_metrics(
                        {
                            "departures_performed": number(row.get("departures_performed")),
                            "passengers": number(row.get("passengers")),
                            "available_seats": number(row.get("available_seats")),
                            "air_time_minutes": number(row.get("air_time_minutes")),
                            "rpm": number(row.get("rpm")),
                            "asm": number(row.get("asm")),
                        }
                    ),
                }
            )
        route_history[label] = rows

    aircraft_type_history: dict[str, list[dict[str, Any]]] = {}
    for aircraft_type in top_aircraft_types:
        rows = []
        for year, month in retained_periods:
            metrics = aircraft_period[(year, month)].get(aircraft_type)
            if not metrics:
                continue
            rows.append(
                {
                    "period": _period_label(year, month, "monthly"),
                    **_finish_metrics(metrics),
                }
            )
        aircraft_type_history[aircraft_type] = rows

    return {
        "history": history,
        "top_directional_routes": top_routes,
        "route_history": route_history,
        "aircraft_type_mix": aircraft_mix,
        "aircraft_type_history": aircraft_type_history,
        "top_airports": top_airports,
        "retained_periods": [_period_label(y, m, "monthly") for y, m in retained_periods],
    }


def _aggregate_t100(paths_by_scope: dict[str, list[Path]]) -> dict[str, Any]:
    rows_by_scope = {
        scope: (row for path in paths for row in iter_zip_rows(path))
        for scope, paths in paths_by_scope.items()
    }
    return aggregate_t100_rows(rows_by_scope)


def build_delta_bts_summary_v2(
    output_path: str | Path,
    *,
    work_dir: str | Path | None = None,
    timeout: int = 900,
) -> dict[str, Any]:
    owned_temp = tempfile.TemporaryDirectory(prefix="afcc-bts-") if work_dir is None else None
    root = Path(owned_temp.name if owned_temp else work_dir)  # type: ignore[arg-type]
    root.mkdir(parents=True, exist_ok=True)

    try:
        p12 = _download_recent_years("P-1.2", root, year_count=3, timeout=timeout)
        p52 = _download_recent_years("P-5.2", root, year_count=3, timeout=timeout)
        p12a = _download_recent_years("P-12(a)", root, year_count=3, timeout=timeout)
        b43 = _download_recent_years("B-43", root, year_count=1, timeout=timeout)
        t100d = _download_recent_years("T-100", root, year_count=3, timeout=timeout)
        t100i = _download_recent_years("T-100-I", root, year_count=3, timeout=timeout)

        summary = {
            "metadata": {
                "status": "official_bts_transtats",
                "pipeline_version": 2,
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "airline": "Delta Air Lines",
                "iata_code": "DL",
                "airline_id": DELTA_AIRLINE_ID,
                "source": "U.S. DOT Bureau of Transportation Statistics TranStats",
                "download_method": "DL_SelectFields.aspx WebForms replay",
                "retention": {
                    "quarterly_periods": QUARTERS_TO_KEEP,
                    "monthly_periods": MONTHS_TO_KEEP,
                },
            },
            "p12_financials": _aggregate_p12(p12),
            "p52_aircraft_economics": _aggregate_p52(p52),
            "p12a_fuel": _aggregate_p12a(p12a),
            "t100_network": _aggregate_t100({"domestic": t100d, "international": t100i}),
            "b43_fleet": _aggregate_b43(b43),
        }
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
        return summary
    finally:
        if owned_temp is not None:
            owned_temp.cleanup()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="afcc-build-bts-v2",
        description="Build the compact Delta BTS layer with retention-consistent network rankings.",
    )
    parser.add_argument("--output", default="web/data/bts_summary.json")
    parser.add_argument("--work-dir")
    parser.add_argument("--timeout", type=int, default=900)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    summary = build_delta_bts_summary_v2(args.output, work_dir=args.work_dir, timeout=args.timeout)
    print(
        f"Wrote {args.output}: "
        f"{len(summary['p12_financials'])} financial quarters, "
        f"{len(summary['t100_network']['history'])} network months, "
        f"{len(summary['t100_network']['top_directional_routes'])} retained-window routes"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
