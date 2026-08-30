from airline_finance_command_center.financial_model import (
    FinancialModelInput,
    build_driver_snapshot,
    build_financial_model,
    calculate_variances,
)


def sample_input() -> FinancialModelInput:
    return FinancialModelInput(
        airline_id=123,
        period="2026-Q1",
        operating_revenue=1000.0,
        operating_expense=900.0,
        operating_profit_loss=100.0,
        net_income=60.0,
        scheduled_passenger_revenue=800.0,
        aircraft_operating_expense=400.0,
        fuel_cost=150.0,
        fuel_consumption_gallons=50.0,
        total_air_hours=20.0,
        departures_performed=100.0,
        available_seats=10000.0,
        passengers=8000.0,
    )


def test_financial_model_calculates_core_kpis() -> None:
    result = build_financial_model(sample_input())

    assert result.operating_margin == 0.10
    assert result.net_margin == 0.06
    assert result.passenger_revenue_share == 0.80
    assert result.load_factor_proxy == 0.80
    assert result.fuel_cost_per_gallon == 3.0
    assert result.aircraft_cost_per_air_hour == 20.0
    assert result.revenue_per_passenger == 0.125
    assert result.revenue_per_available_seat == 0.10
    assert result.cost_per_available_seat == 0.09
    assert result.operating_profit_check == 0.0


def test_financial_model_returns_none_for_zero_denominator() -> None:
    result = build_financial_model(FinancialModelInput(airline_id=1, period="2026-Q1"))

    assert result.operating_margin is None
    assert result.load_factor_proxy is None
    assert result.fuel_cost_per_gallon is None


def test_driver_snapshot_exposes_finance_and_operating_metrics() -> None:
    snapshot = build_driver_snapshot(sample_input())

    assert snapshot["operating_revenue"] == 1000.0
    assert snapshot["passengers"] == 8000.0
    assert snapshot["operating_margin"] == 0.10


def test_variances_calculate_absolute_and_percent() -> None:
    current = {"operating_revenue": 110.0, "operating_margin": 0.11}
    prior = {"operating_revenue": 100.0, "operating_margin": 0.10}

    result = calculate_variances(current, prior)

    assert result["operating_revenue"]["absolute"] == 10.0
    assert result["operating_revenue"]["percent"] == 0.10
    assert round(result["operating_margin"]["absolute"], 10) == 0.01
    assert round(result["operating_margin"]["percent"], 10) == 0.10


def test_variances_handle_missing_and_zero_prior_values() -> None:
    result = calculate_variances(
        {"a": None, "b": 10.0, "c": 5.0},
        {"a": 2.0, "b": 0.0},
    )

    assert result["a"]["absolute"] is None
    assert result["b"]["absolute"] == 10.0
    assert result["b"]["percent"] is None
    assert result["c"]["absolute"] is None
