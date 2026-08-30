from airline_finance_command_center.bts_delta_pipeline_v2 import aggregate_t100_rows


def _row(
    year: int,
    month: int,
    origin: str,
    destination: str,
    passengers: float,
    seats: float,
    *,
    aircraft_type: str = "622",
    scope_carrier: str = "DL",
) -> dict[str, str]:
    return {
        "year": str(year),
        "month": str(month),
        "unique_carrier": scope_carrier,
        "airline_id": "19790",
        "carrier": scope_carrier,
        "origin": origin,
        "dest": destination,
        "origin_city_name": origin,
        "dest_city_name": destination,
        "departures_performed": "10",
        "passengers": str(passengers),
        "seats": str(seats),
        "distance": "100",
        "air_time": "500",
        "aircraft_type": aircraft_type,
    }


def test_route_rankings_only_use_retained_months() -> None:
    rows = [
        _row(2025, 1, "OLD", "HUB", 10000, 11000),
        _row(2025, 2, "ATL", "JFK", 100, 130),
        _row(2025, 3, "ATL", "JFK", 120, 140),
        _row(2025, 2, "ATL", "LAX", 80, 100),
        _row(2025, 3, "ATL", "LAX", 90, 110),
    ]

    result = aggregate_t100_rows({"domestic": rows}, months_to_keep=2)

    assert result["retained_periods"] == ["2025-02", "2025-03"]
    assert result["top_directional_routes"][0]["origin"] == "ATL"
    assert all(route["origin"] != "OLD" for route in result["top_directional_routes"])


def test_route_and_aircraft_history_are_emitted_for_interactive_reaggregation() -> None:
    rows = [
        _row(2025, 2, "ATL", "JFK", 100, 130, aircraft_type="622"),
        _row(2025, 3, "ATL", "JFK", 120, 140, aircraft_type="622"),
    ]

    result = aggregate_t100_rows({"domestic": rows}, months_to_keep=2)

    route_history = result["route_history"]["ATL-JFK|domestic"]
    assert [row["period"] for row in route_history] == ["2025-02", "2025-03"]
    assert route_history[-1]["passengers"] == 120
    assert route_history[-1]["seat_load_factor"] == 120 / 140

    aircraft_history = result["aircraft_type_history"]["622"]
    assert len(aircraft_history) == 2
    assert aircraft_history[-1]["available_seats"] == 140
