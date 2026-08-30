from airline_finance_command_center.field_mapping import (
    CORE_FIELD_MAPPINGS,
    mapping_by_source_field,
    mappings_for_source,
    validate_columns,
)


def test_all_core_sources_have_mappings() -> None:
    sources = {item.source for item in CORE_FIELD_MAPPINGS}
    assert {"P-1.2", "P-5.2", "P-12(a)", "T-100", "B-43"}.issubset(sources)


def test_key_finance_fields_are_mapped() -> None:
    assert mapping_by_source_field("P-1.2", "OpRevenues").normalized_field == "operating_revenue"
    assert mapping_by_source_field("P-1.2", "OpExpenses").normalized_field == "operating_expense"
    assert mapping_by_source_field("P-1.2", "OpProfitLoss").normalized_field == "operating_profit_loss"
    assert mapping_by_source_field("P-1.2", "NetIncome").normalized_field == "net_income"


def test_operating_driver_fields_are_mapped() -> None:
    assert mapping_by_source_field("P-5.2", "TotAirOpExpenses").normalized_field == "aircraft_operating_expense"
    assert mapping_by_source_field("P-12(a)", "TotalGallons").normalized_field == "fuel_consumption_gallons"
    assert mapping_by_source_field("T-100", "Passengers").normalized_field == "passengers"
    assert mapping_by_source_field("B-43", "TailNumber").normalized_field == "tail_number"


def test_each_source_has_stable_carrier_identifier() -> None:
    for source in ("P-1.2", "P-5.2", "P-12(a)", "T-100", "B-43"):
        fields = {item.source_field for item in mappings_for_source(source)}
        assert "AirlineID" in fields
        assert "UniqueCarrier" in fields


def test_validate_columns_returns_missing_required_mappings() -> None:
    columns = {"AirlineID", "UniqueCarrier", "Year", "Quarter", "OpRevenues"}
    missing = validate_columns("P-1.2", columns)
    assert "OpExpenses" in missing
    assert "NetIncome" in missing
    assert "AirlineID" not in missing
