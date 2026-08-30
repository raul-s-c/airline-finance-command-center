from airline_finance_command_center.bts_delta_pipeline_v3 import aggregate_t100_rows


def _row(origin: str, dest: str, passengers: int, *, month: int = 1) -> dict[str, str]:
    return {
        "unique_carrier": "DL",
        "year": "2026",
        "month": str(month),
        "origin": origin,
        "dest": dest,
        "passengers": str(passengers),
        "seats": str(passengers + 20),
        "departures_performed": "10",
        "distance": "500",
        "air_time": "1000",
    }


def test_route_ranking_retains_each_network_scope() -> None:
    result = aggregate_t100_rows(
        {
            "domestic": [_row("ATL", "MCO", 1000), _row("ATL", "LGA", 900)],
            "international": [_row("JFK", "LHR", 300), _row("ATL", "CDG", 200)],
        },
        months_to_keep=1,
        top_route_count=1,
    )

    routes = result["top_directional_routes"]
    scopes = {route["scope"] for route in routes}

    assert scopes == {"domestic", "international"}
    assert result["route_scope_counts"]["domestic"] >= 1
    assert result["route_scope_counts"]["international"] >= 1
    assert "JFK-LHR|international" in result["route_history"]
