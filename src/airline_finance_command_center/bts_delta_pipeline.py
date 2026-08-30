from __future__ import annotations

import argparse
import json
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from airline_finance_command_center.transtats_csv import integer, is_delta, iter_zip_rows, number
from airline_finance_command_center.transtats_webforms import available_years, download_to_path


DELTA_AIRLINE_ID = 19790
QUARTERS_TO_KEEP = 8
MONTHS_TO_KEEP = 24


def _period_key(year: str | int, period: str | int) -> tuple[int, int]:
    return int(year), int(period)


def _period_label(year: int, period: int, cadence: str) -> str:
    if cadence == "quarterly":
        return f"{year}-Q{period}"
    return f"{year}-{period:02d}"


def _last_periods(items: dict[tuple[int, int], Any], count: int) -> list[tuple[int, int]]:
    return sorted(items)[-count:]


def _download_recent_years(
    table: str,
    root: Path,
    *,
    year_count: int,
    timeout: int,
) -> list[Path]:
    years = available_years(table, timeout=timeout)
    selected = sorted(years)[-year_count:]
    paths: list[Path] = []
    for year in selected:
        output = root / table.replace("/", "_").replace("(", "_").replace(")", "_") / year
        paths.append(
            download_to_path(
                table,
                output,
                year=year,
                timeout=timeout,
                overwrite=True,
            )
        )
    return paths


def _aggregate_p12(paths: list[Path]) -> list[dict[str, Any]]:
    values: dict[tuple[int, int], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for path in paths:
        for row in iter_zip_rows(path):
            if not is_delta(row):
                continue
            key = _period_key(row.get("year", "0"), row.get("quarter", "0"))
            bucket = values[key]
            for source, target in (
                ("op_revenues", "operating_revenue_usd_m"),
                ("op_expenses", "operating_expense_usd_m"),
                ("op_profit_loss", "operating_profit_loss_usd_m"),
                ("net_income", "net_income_usd_m"),
                ("trans_rev_pax", "passenger_revenue_usd_m"),
                ("prop_freight", "freight_revenue_usd_m"),
                ("prop_bag", "baggage_fee_revenue_usd_m"),
                ("flying_ops", "flying_operations_expense_usd_m"),
                ("maintenance", "maintenance_expense_usd_m"),
                ("pax_service", "passenger_service_expense_usd_m"),
                ("deprec_amort", "depreciation_amortization_usd_m"),
            ):
                bucket[target] += number(row.get(source)) / 1000.0
    periods = _last_periods(values, QUARTERS_TO_KEEP)
    output: list[dict[str, Any]] = []
    for year, quarter in periods:
        metrics = dict(values[(year, quarter)])
        revenue = metrics.get("operating_revenue_usd_m", 0.0)
        profit = metrics.get("operating_profit_loss_usd_m", 0.0)
        metrics["operating_margin"] = profit / revenue if revenue else None
        output.append({"period": _period_label(year, quarter, "quarterly"), **metrics})
    return output


def _aggregate_p52(paths: list[Path]) -> dict[str, Any]:
    total_by_period: dict[tuple[int, int], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    fleet_by_period: dict[tuple[int, int], dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(float))
    )
    for path in paths:
        for row in iter_zip_rows(path):
            if not is_delta(row):
                continue
            key = _period_key(row.get("year", "0"), row.get("quarter", "0"))
            aircraft_type = row.get("aircraft_type", "").strip() or "unknown"
            if aircraft_type == "999":
                continue
            pairs = (
                ("tot_air_op_expenses", "aircraft_operating_expense_source"),
                ("tot_fly_ops", "flying_operations_expense_source"),
                ("fuel_fly_ops", "fuel_expense_source"),
                ("tot_dir_maint", "direct_maintenance_expense_source"),
                ("total_air_hours", "air_hours"),
                ("air_fuels_issued", "fuel_issued_source"),
            )
            for source, target in pairs:
                value = number(row.get(source))
                total_by_period[key][target] += value
                fleet_by_period[key][aircraft_type][target] += value
    periods = _last_periods(total_by_period, QUARTERS_TO_KEEP)
    history = [
        {"period": _period_label(y, q, "quarterly"), **dict(total_by_period[(y, q)])}
        for y, q in periods
    ]
    latest_mix: list[dict[str, Any]] = []
    if periods:
        latest = periods[-1]
        latest_mix = sorted(
            (
                {"aircraft_type": aircraft, **dict(metrics)}
                for aircraft, metrics in fleet_by_period[latest].items()
                if any(abs(value) > 0 for value in metrics.values())
            ),
            key=lambda item: abs(item.get("aircraft_operating_expense_source", 0.0)),
            reverse=True,
        )
    return {"history": history, "latest_aircraft_type_economics": latest_mix[:25]}


def _aggregate_p12a(paths: list[Path]) -> list[dict[str, Any]]:
    values: dict[tuple[int, int], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for path in paths:
        for row in iter_zip_rows(path):
            if not is_delta(row):
                continue
            key = _period_key(row.get("year", "0"), row.get("month", "0"))
            bucket = values[key]
            for source, target in (
                ("total_gallons", "fuel_gallons"),
                ("total_cost", "fuel_cost_usd"),
                ("tdomt_gallons", "domestic_fuel_gallons"),
                ("tint_gallons", "international_fuel_gallons"),
                ("tdomt_cost", "domestic_fuel_cost_usd"),
                ("tint_cost", "international_fuel_cost_usd"),
            ):
                bucket[target] += number(row.get(source))
    periods = _last_periods(values, MONTHS_TO_KEEP)
    result: list[dict[str, Any]] = []
    for year, month in periods:
        metrics = dict(values[(year, month)])
        gallons = metrics.get("fuel_gallons", 0.0)
        metrics["fuel_cost_per_gallon_usd"] = (
            metrics.get("fuel_cost_usd", 0.0) / gallons if gallons else None
        )
        result.append({"period": _period_label(year, month, "monthly"), **metrics})
    return result


def _aggregate_t100(paths_by_scope: dict[str, list[Path]]) -> dict[str, Any]:
    monthly: dict[tuple[int, int], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    monthly_scope: dict[tuple[int, int], dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(float))
    )
    routes: dict[tuple[str, str], dict[str, Any]] = {}
    aircraft: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    airports: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for scope, paths in paths_by_scope.items():
        for path in paths:
            for row in iter_zip_rows(path):
                if not is_delta(row):
                    continue
                year = integer(row.get("year"))
                month = integer(row.get("month"))
                if not year or not month:
                    continue
                departures = number(row.get("departures_performed"))
                passengers = number(row.get("passengers"))
                seats = number(row.get("seats"))
                distance = number(row.get("distance"))
                air_time = number(row.get("air_time"))
                if not any((departures, passengers, seats, air_time)):
                    continue
                rpm = passengers * distance
                asm = seats * distance
                key = (year, month)
                metrics = {
                    "departures_performed": departures,
                    "passengers": passengers,
                    "available_seats": seats,
                    "air_time_minutes": air_time,
                    "rpm": rpm,
                    "asm": asm,
                }
                for name, value in metrics.items():
                    monthly[key][name] += value
                    monthly_scope[key][scope][name] += value

                origin = row.get("origin", "").strip() or row.get("origin_airport_id", "").strip()
                dest = row.get("dest", "").strip() or row.get("dest_airport_id", "").strip()
                route_key = (origin, dest)
                route = routes.setdefault(
                    route_key,
                    {
                        "origin": origin,
                        "destination": dest,
                        "origin_city": row.get("origin_city_name", ""),
                        "destination_city": row.get("dest_city_name", ""),
                        "scope": scope,
                        "passengers": 0.0,
                        "available_seats": 0.0,
                        "departures_performed": 0.0,
                        "rpm": 0.0,
                        "asm": 0.0,
                    },
                )
                route["passengers"] += passengers
                route["available_seats"] += seats
                route["departures_performed"] += departures
                route["rpm"] += rpm
                route["asm"] += asm

                aircraft_type = row.get("aircraft_type", "").strip() or "unknown"
                aircraft[aircraft_type]["passengers"] += passengers
                aircraft[aircraft_type]["available_seats"] += seats
                aircraft[aircraft_type]["departures_performed"] += departures
                aircraft[aircraft_type]["air_time_minutes"] += air_time

                for code in (origin, dest):
                    if code:
                        airports[code]["passengers_segment_ends"] += passengers
                        airports[code]["departures_or_arrivals"] += departures

    periods = _last_periods(monthly, MONTHS_TO_KEEP)
    allowed = set(periods)
    history: list[dict[str, Any]] = []
    for year, month in periods:
        metrics = dict(monthly[(year, month)])
        asm = metrics.get("asm", 0.0)
        rpm = metrics.get("rpm", 0.0)
        seats = metrics.get("available_seats", 0.0)
        passengers = metrics.get("passengers", 0.0)
        metrics["load_factor"] = rpm / asm if asm else None
        metrics["seat_load_factor"] = passengers / seats if seats else None
        metrics["scope"] = {
            scope: dict(values) for scope, values in monthly_scope[(year, month)].items()
        }
        history.append({"period": _period_label(year, month, "monthly"), **metrics})

    top_routes = sorted(routes.values(), key=lambda item: item["passengers"], reverse=True)[:30]
    aircraft_mix = sorted(
        ({"aircraft_type": code, **dict(values)} for code, values in aircraft.items()),
        key=lambda item: item["passengers"],
        reverse=True,
    )[:30]
    top_airports = sorted(
        ({"airport": code, **dict(values)} for code, values in airports.items()),
        key=lambda item: item["passengers_segment_ends"],
        reverse=True,
    )[:30]
    return {
        "history": history,
        "top_directional_routes": top_routes,
        "aircraft_type_mix": aircraft_mix,
        "top_airports": top_airports,
    }


def _aggregate_b43(paths: list[Path]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    latest_year = 0
    for path in paths:
        for row in iter_zip_rows(path):
            if not is_delta(row):
                continue
            year = integer(row.get("year"))
            latest_year = max(latest_year, year)
            if row.get("operating_status", "").upper() not in {"Y", "YES", "1"}:
                continue
            manufacture_year = integer(row.get("manufacture_year"))
            rows.append(
                {
                    "tail_number": row.get("tail_number", ""),
                    "serial_number": row.get("serial_number", ""),
                    "manufacturer": row.get("manufacturer", ""),
                    "aircraft_type": row.get("aircraft_type", ""),
                    "model": row.get("model", ""),
                    "manufacture_year": manufacture_year or None,
                    "number_of_seats": integer(row.get("number_of_seats")),
                    "capacity_in_pounds": number(row.get("capacity_in_pounds")),
                }
            )
    by_model: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    ages: list[int] = []
    for row in rows:
        key = (row["manufacturer"], row["model"])
        by_model[key]["aircraft_count"] += 1
        by_model[key]["seats"] += row["number_of_seats"]
        if row["manufacture_year"] and latest_year:
            ages.append(latest_year - int(row["manufacture_year"]))
    model_mix = sorted(
        (
            {
                "manufacturer": manufacturer,
                "model": model,
                "aircraft_count": int(metrics["aircraft_count"]),
                "seats": int(metrics["seats"]),
            }
            for (manufacturer, model), metrics in by_model.items()
        ),
        key=lambda item: item["aircraft_count"],
        reverse=True,
    )
    return {
        "inventory_year": latest_year,
        "active_aircraft_count": len(rows),
        "average_age_years": sum(ages) / len(ages) if ages else None,
        "model_mix": model_mix,
        "aircraft": rows,
    }


def build_delta_bts_summary(
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
        prog="afcc-build-bts",
        description="Download official TranStats data and build the compact Delta BTS layer.",
    )
    parser.add_argument("--output", default="web/data/bts_summary.json")
    parser.add_argument("--work-dir")
    parser.add_argument("--timeout", type=int, default=900)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    summary = build_delta_bts_summary(args.output, work_dir=args.work_dir, timeout=args.timeout)
    print(
        f"Wrote {args.output}: "
        f"{len(summary['p12_financials'])} financial quarters, "
        f"{len(summary['t100_network']['history'])} network months"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
