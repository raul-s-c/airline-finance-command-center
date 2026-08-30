from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class FinancialModelInput:
    airline_id: int
    period: str
    operating_revenue: float = 0.0
    operating_expense: float = 0.0
    operating_profit_loss: float = 0.0
    net_income: float = 0.0
    scheduled_passenger_revenue: float = 0.0
    freight_revenue: float = 0.0
    baggage_fee_revenue: float = 0.0
    flying_operations_expense: float = 0.0
    maintenance_expense: float = 0.0
    passenger_service_expense: float = 0.0
    depreciation_amortization: float = 0.0
    aircraft_operating_expense: float = 0.0
    fuel_cost: float = 0.0
    fuel_consumption_gallons: float = 0.0
    total_air_hours: float = 0.0
    departures_performed: float = 0.0
    available_seats: float = 0.0
    passengers: float = 0.0
    segment_distance_miles: float = 0.0


@dataclass(frozen=True)
class FinancialModelOutput:
    airline_id: int
    period: str
    operating_margin: float | None
    net_margin: float | None
    passenger_revenue_share: float | None
    load_factor_proxy: float | None
    fuel_cost_per_gallon: float | None
    aircraft_cost_per_air_hour: float | None
    revenue_per_passenger: float | None
    revenue_per_available_seat: float | None
    cost_per_available_seat: float | None
    operating_profit_check: float


def _safe_divide(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def build_financial_model(data: FinancialModelInput) -> FinancialModelOutput:
    revenue = data.operating_revenue
    expense = data.operating_expense
    calculated_operating_profit = revenue - expense

    return FinancialModelOutput(
        airline_id=data.airline_id,
        period=data.period,
        operating_margin=_safe_divide(data.operating_profit_loss, revenue),
        net_margin=_safe_divide(data.net_income, revenue),
        passenger_revenue_share=_safe_divide(data.scheduled_passenger_revenue, revenue),
        load_factor_proxy=_safe_divide(data.passengers, data.available_seats),
        fuel_cost_per_gallon=_safe_divide(data.fuel_cost, data.fuel_consumption_gallons),
        aircraft_cost_per_air_hour=_safe_divide(
            data.aircraft_operating_expense,
            data.total_air_hours,
        ),
        revenue_per_passenger=_safe_divide(revenue, data.passengers),
        revenue_per_available_seat=_safe_divide(revenue, data.available_seats),
        cost_per_available_seat=_safe_divide(expense, data.available_seats),
        operating_profit_check=data.operating_profit_loss - calculated_operating_profit,
    )


def build_driver_snapshot(data: FinancialModelInput) -> dict[str, float | None]:
    model = build_financial_model(data)
    return {
        "operating_revenue": data.operating_revenue,
        "operating_expense": data.operating_expense,
        "operating_profit_loss": data.operating_profit_loss,
        "net_income": data.net_income,
        "passengers": data.passengers,
        "available_seats": data.available_seats,
        "departures_performed": data.departures_performed,
        "fuel_cost": data.fuel_cost,
        "fuel_consumption_gallons": data.fuel_consumption_gallons,
        "operating_margin": model.operating_margin,
        "net_margin": model.net_margin,
        "load_factor_proxy": model.load_factor_proxy,
        "fuel_cost_per_gallon": model.fuel_cost_per_gallon,
        "aircraft_cost_per_air_hour": model.aircraft_cost_per_air_hour,
        "revenue_per_passenger": model.revenue_per_passenger,
        "revenue_per_available_seat": model.revenue_per_available_seat,
        "cost_per_available_seat": model.cost_per_available_seat,
    }


def calculate_variances(
    current: Mapping[str, float | None],
    prior: Mapping[str, float | None],
) -> dict[str, dict[str, float | None]]:
    result: dict[str, dict[str, float | None]] = {}
    for metric, current_value in current.items():
        prior_value = prior.get(metric)
        if current_value is None or prior_value is None:
            result[metric] = {"current": current_value, "prior": prior_value, "absolute": None, "percent": None}
            continue

        absolute = current_value - prior_value
        percent = None if prior_value == 0 else absolute / prior_value
        result[metric] = {
            "current": current_value,
            "prior": prior_value,
            "absolute": absolute,
            "percent": percent,
        }
    return result
