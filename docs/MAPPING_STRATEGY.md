# Mapping Strategy

The project will keep three levels of meaning for every field.

| Layer | Example | Purpose |
|---|---|---|
| Original BTS field | `TotAirOpExpenses` | Traceability to official source |
| Normalized field | `total_aircraft_operating_expense` | Consistent internal naming |
| Analytical concept | Aircraft operating expense | Finance and variance analysis |

## Mapping Metadata

Each mapped field should include:

- Source table.
- Original field name.
- Normalized field name.
- Official description where available.
- Unit and scale.
- Periodicity.
- Dimension or measure classification.
- Aggregation rule.
- Finance concept.
- Candidate variance drivers.
- Reconciliation checks.
- Known limitations.

## Unit Discipline

BTS tables may present values in dollars, thousands of dollars, counts, miles, gallons or hours. Phase 0 must explicitly detect and document unit scaling before any dashboard metric is shown.

## Commentary Rule

Generated commentary must be deterministic and traceable. It can explain movement only from fields and calculations that passed validation.
