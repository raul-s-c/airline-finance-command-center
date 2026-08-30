# Real BTS Field Mapping

This document records the core field mapping validated against the official BTS TranStats table dictionaries as of 2026-08-30.

The executable registry lives in `src/airline_finance_command_center/field_mapping.py`.

## Carrier identity rule

Use `AirlineID` as the stable DOT carrier identifier and `UniqueCarrier` as the human-readable analytical carrier code. Do not use raw `Carrier` alone as the long-term key because BTS explicitly warns that carrier codes can be reused over time.

## P-1.2 - Quarterly P&L

Core mapped measures:

| BTS field | Normalized field | Analytical concept | Unit |
|---|---|---|---|
| OpRevenues | operating_revenue | Operating revenue | USD thousands |
| OpExpenses | operating_expense | Operating expense | USD thousands |
| OpProfitLoss | operating_profit_loss | Operating result | USD thousands |
| NetIncome | net_income | Net income | USD thousands |
| TransRevPax | scheduled_passenger_revenue | Passenger revenue | USD thousands |
| PropFreight | freight_revenue | Freight revenue | USD thousands |
| PropBag | baggage_fee_revenue | Ancillary revenue | USD thousands |
| FlyingOps | flying_operations_expense | Flying operations expense | USD thousands |
| Maintenance | maintenance_expense | Maintenance expense | USD thousands |
| PaxService | passenger_service_expense | Passenger service expense | USD thousands |
| DeprecAmort | depreciation_amortization | Depreciation and amortization | USD thousands |

BTS uses accounting code descriptions ending in `(000)` for these financial measures. The model therefore stores them explicitly as USD thousands and only scales them in the analytical layer.

## P-5.2 - Aircraft operating expense

Core mapped measures and dimensions:

| BTS field | Normalized field | Analytical concept | Unit |
|---|---|---|---|
| AircraftType | aircraft_type | Fleet | code |
| AircraftGroup | aircraft_group | Fleet | code |
| FuelFlyOps | aircraft_fuel_expense | Fuel expense | USD thousands |
| TotFlyOps | total_flying_operations_expense | Flying operations expense | USD thousands |
| TotDirMaint | direct_maintenance_expense | Direct maintenance expense | USD thousands |
| TotAirOpExpenses | aircraft_operating_expense | Aircraft operating expense | USD thousands |
| TotalAirHours | airborne_hours | Aircraft utilization | thousand hours |
| AirFuelIssued | fuel_issued_gallons | Fuel consumption | thousand gallons |

This table is the main bridge between the P&L and fleet economics.

## P-12(a) - Monthly fuel

Core mapped fields:

| BTS field | Normalized field | Analytical concept | Unit |
|---|---|---|---|
| TotalGallons | fuel_consumption_gallons | Fuel consumption | gallons |
| TotalCost | fuel_cost | Fuel expense | USD |
| TDOMTGallons | domestic_fuel_consumption_gallons | Domestic fuel consumption | gallons |
| TINTGallons | international_fuel_consumption_gallons | International fuel consumption | gallons |
| TDOMTCost | domestic_fuel_cost | Domestic fuel expense | USD |
| TINTCost | international_fuel_cost | International fuel expense | USD |

Unlike P-1.2 and P-5.2, these costs are documented by BTS in dollars rather than thousands of dollars. No scaling should be assumed across sources.

## T-100 Segment - Monthly operational drivers

Core mapped fields:

| BTS field | Normalized field | Analytical concept | Unit |
|---|---|---|---|
| OriginAirportID | origin_airport_id | Route | DOT airport ID |
| DestAirportID | destination_airport_id | Route | DOT airport ID |
| AircraftType | aircraft_type | Fleet | code |
| DepScheduled | departures_scheduled | Capacity | departures |
| DepPerformed | departures_performed | Operations | departures |
| Seats | available_seats | Capacity | seats |
| Passengers | passengers | Traffic | passengers |
| Distance | segment_distance_miles | Route | miles |
| AirTime | air_time_minutes | Aircraft utilization | minutes |

Airport IDs are preferred over airport codes because BTS explicitly recommends the ID for time-series analysis when airport codes can change or be reused.

## B-43 - Fleet inventory

Core mapped fields:

| BTS field | Normalized field | Analytical concept |
|---|---|---|
| TailNumber | tail_number | Fleet asset |
| SerialNumber | serial_number | Fleet asset |
| Manufacturer | manufacturer | Fleet |
| AircraftType | aircraft_type | Fleet |
| Model | aircraft_model | Fleet |
| ManufactureYear | manufacture_year | Fleet age |
| NumberOfSeats | number_of_seats | Fleet capacity |
| CapacityInPounds | payload_capacity_pounds | Fleet capacity |
| OperatingStatus | operating_status | Fleet status |

## Mapping controls

The executable registry stores, for every core field:

- source table;
- original BTS field name;
- normalized field name;
- finance or operational concept;
- unit;
- aggregation rule;
- dimension/measure role.

`validate_columns()` can compare the registry against a real CSV schema and return missing expected fields. This is the final validation still required when the official ZIP files are executed locally.

## Remaining validation

The mapping is based on the current official TranStats dictionaries, not guessed names. However, DB10/DB20 packaged ZIP files can use layouts or file names that differ from the web table export. Once the raw ZIP extraction runs, the schema validator must confirm the exact packaged-column names and aliases before the transformation layer is considered production-valid.
