from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FieldMapping:
    source: str
    source_field: str
    normalized_field: str
    finance_concept: str
    unit: str
    aggregation: str
    role: str


CORE_FIELD_MAPPINGS: tuple[FieldMapping, ...] = (
    FieldMapping("P-1.2", "AirlineID", "airline_id", "Carrier identity", "id", "none", "dimension"),
    FieldMapping("P-1.2", "UniqueCarrier", "unique_carrier", "Carrier identity", "code", "none", "dimension"),
    FieldMapping("P-1.2", "Year", "year", "Reporting period", "year", "none", "dimension"),
    FieldMapping("P-1.2", "Quarter", "quarter", "Reporting period", "quarter", "none", "dimension"),
    FieldMapping("P-1.2", "OpRevenues", "operating_revenue", "Operating revenue", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "OpExpenses", "operating_expense", "Operating expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "OpProfitLoss", "operating_profit_loss", "Operating result", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "NetIncome", "net_income", "Net income", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "TransRevPax", "scheduled_passenger_revenue", "Passenger revenue", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "PropFreight", "freight_revenue", "Freight revenue", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "PropBag", "baggage_fee_revenue", "Ancillary revenue", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "FlyingOps", "flying_operations_expense", "Flying operations expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "Maintenance", "maintenance_expense", "Maintenance expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "PaxService", "passenger_service_expense", "Passenger service expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-1.2", "DeprecAmort", "depreciation_amortization", "Depreciation and amortization", "usd_thousands", "sum", "measure"),

    FieldMapping("P-5.2", "AirlineID", "airline_id", "Carrier identity", "id", "none", "dimension"),
    FieldMapping("P-5.2", "UniqueCarrier", "unique_carrier", "Carrier identity", "code", "none", "dimension"),
    FieldMapping("P-5.2", "Year", "year", "Reporting period", "year", "none", "dimension"),
    FieldMapping("P-5.2", "Quarter", "quarter", "Reporting period", "quarter", "none", "dimension"),
    FieldMapping("P-5.2", "AircraftType", "aircraft_type", "Fleet", "code", "none", "dimension"),
    FieldMapping("P-5.2", "AircraftGroup", "aircraft_group", "Fleet", "code", "none", "dimension"),
    FieldMapping("P-5.2", "FuelFlyOps", "aircraft_fuel_expense", "Fuel expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-5.2", "TotFlyOps", "total_flying_operations_expense", "Flying operations expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-5.2", "TotDirMaint", "direct_maintenance_expense", "Direct maintenance expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-5.2", "TotAirOpExpenses", "aircraft_operating_expense", "Aircraft operating expense", "usd_thousands", "sum", "measure"),
    FieldMapping("P-5.2", "TotalAirHours", "airborne_hours", "Aircraft utilization", "thousand_hours", "sum", "measure"),
    FieldMapping("P-5.2", "AirFuelIssued", "fuel_issued_gallons", "Fuel consumption", "thousand_gallons", "sum", "measure"),

    FieldMapping("P-12(a)", "AirlineID", "airline_id", "Carrier identity", "id", "none", "dimension"),
    FieldMapping("P-12(a)", "UniqueCarrier", "unique_carrier", "Carrier identity", "code", "none", "dimension"),
    FieldMapping("P-12(a)", "Year", "year", "Reporting period", "year", "none", "dimension"),
    FieldMapping("P-12(a)", "Month", "month", "Reporting period", "month", "none", "dimension"),
    FieldMapping("P-12(a)", "TotalGallons", "fuel_consumption_gallons", "Fuel consumption", "gallons", "sum", "measure"),
    FieldMapping("P-12(a)", "TotalCost", "fuel_cost", "Fuel expense", "usd", "sum", "measure"),
    FieldMapping("P-12(a)", "TDOMTGallons", "domestic_fuel_consumption_gallons", "Domestic fuel consumption", "gallons", "sum", "measure"),
    FieldMapping("P-12(a)", "TINTGallons", "international_fuel_consumption_gallons", "International fuel consumption", "gallons", "sum", "measure"),
    FieldMapping("P-12(a)", "TDOMTCost", "domestic_fuel_cost", "Domestic fuel expense", "usd", "sum", "measure"),
    FieldMapping("P-12(a)", "TINTCost", "international_fuel_cost", "International fuel expense", "usd", "sum", "measure"),

    FieldMapping("T-100", "AirlineID", "airline_id", "Carrier identity", "id", "none", "dimension"),
    FieldMapping("T-100", "UniqueCarrier", "unique_carrier", "Carrier identity", "code", "none", "dimension"),
    FieldMapping("T-100", "Year", "year", "Reporting period", "year", "none", "dimension"),
    FieldMapping("T-100", "Month", "month", "Reporting period", "month", "none", "dimension"),
    FieldMapping("T-100", "OriginAirportID", "origin_airport_id", "Route", "id", "none", "dimension"),
    FieldMapping("T-100", "DestAirportID", "destination_airport_id", "Route", "id", "none", "dimension"),
    FieldMapping("T-100", "AircraftType", "aircraft_type", "Fleet", "code", "none", "dimension"),
    FieldMapping("T-100", "DepScheduled", "departures_scheduled", "Capacity", "departures", "sum", "measure"),
    FieldMapping("T-100", "DepPerformed", "departures_performed", "Operations", "departures", "sum", "measure"),
    FieldMapping("T-100", "Seats", "available_seats", "Capacity", "seats", "sum", "measure"),
    FieldMapping("T-100", "Passengers", "passengers", "Traffic", "passengers", "sum", "measure"),
    FieldMapping("T-100", "Distance", "segment_distance_miles", "Route", "miles", "none", "dimension"),
    FieldMapping("T-100", "AirTime", "air_time_minutes", "Aircraft utilization", "minutes", "sum", "measure"),

    FieldMapping("B-43", "AirlineID", "airline_id", "Carrier identity", "id", "none", "dimension"),
    FieldMapping("B-43", "UniqueCarrier", "unique_carrier", "Carrier identity", "code", "none", "dimension"),
    FieldMapping("B-43", "Year", "year", "Reporting period", "year", "none", "dimension"),
    FieldMapping("B-43", "TailNumber", "tail_number", "Fleet asset", "text", "none", "dimension"),
    FieldMapping("B-43", "SerialNumber", "serial_number", "Fleet asset", "text", "none", "dimension"),
    FieldMapping("B-43", "Manufacturer", "manufacturer", "Fleet", "text", "none", "dimension"),
    FieldMapping("B-43", "AircraftType", "aircraft_type", "Fleet", "code", "none", "dimension"),
    FieldMapping("B-43", "Model", "aircraft_model", "Fleet", "text", "none", "dimension"),
    FieldMapping("B-43", "ManufactureYear", "manufacture_year", "Fleet age", "year", "none", "dimension"),
    FieldMapping("B-43", "NumberOfSeats", "number_of_seats", "Fleet capacity", "seats", "sum", "measure"),
    FieldMapping("B-43", "CapacityInPounds", "payload_capacity_pounds", "Fleet capacity", "pounds", "sum", "measure"),
    FieldMapping("B-43", "OperatingStatus", "operating_status", "Fleet status", "text", "none", "dimension"),
)


def mappings_for_source(source: str) -> tuple[FieldMapping, ...]:
    return tuple(item for item in CORE_FIELD_MAPPINGS if item.source == source)


def mapping_by_source_field(source: str, source_field: str) -> FieldMapping:
    for item in CORE_FIELD_MAPPINGS:
        if item.source == source and item.source_field == source_field:
            return item
    raise KeyError(f"No mapping for {source}.{source_field}")


def validate_columns(source: str, columns: set[str]) -> tuple[str, ...]:
    required = {item.source_field for item in mappings_for_source(source)}
    return tuple(sorted(required - columns))
