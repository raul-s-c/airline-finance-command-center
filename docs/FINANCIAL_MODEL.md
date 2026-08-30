# Financial Model

The financial model is airline-agnostic and keyed by `AirlineID`, so it can be built before the final airline selection is resolved.

## Model objective

Turn the mapped BTS fields into a compact Head of Finance analytical layer covering:

- P&L performance.
- Revenue mix.
- Operating cost structure.
- Capacity and traffic.
- Fuel economics.
- Fleet economics.
- Period-over-period variance analysis.

## Core fact groups

### Finance

Source: P-1.2

Core measures:

- Operating revenue.
- Operating expense.
- Operating profit/loss.
- Net income.
- Scheduled passenger revenue.
- Freight revenue.
- Baggage fee revenue.
- Flying operations expense.
- Maintenance expense.
- Passenger service expense.
- Depreciation and amortization.

### Aircraft economics

Source: P-5.2

Core measures:

- Aircraft operating expense.
- Total air hours.
- Fuel issued.
- Flying operations expense by aircraft type.
- Maintenance expense by aircraft type.

### Fuel

Source: P-12(a)

Core measures:

- Fuel cost.
- Fuel consumption gallons.
- Domestic fuel cost and gallons.
- International fuel cost and gallons.

### Traffic and capacity

Source: T-100

Core measures:

- Departures performed.
- Available seats.
- Passengers.
- Segment distance.
- Air time.
- Origin and destination airport IDs.
- Aircraft type.

### Fleet

Source: B-43

Core dimensions:

- Tail number.
- Manufacturer.
- Aircraft type.
- Model.
- Manufacture year.
- Seats.
- Operating status.

## KPI layer

The initial KPI layer contains:

- Operating margin = operating profit / operating revenue.
- Net margin = net income / operating revenue.
- Passenger revenue share = passenger revenue / operating revenue.
- Load factor proxy = passengers / available seats.
- Fuel cost per gallon = fuel cost / fuel gallons.
- Aircraft operating cost per air hour = aircraft operating expense / total air hours.
- Revenue per passenger = operating revenue / passengers.
- Revenue per available seat = operating revenue / available seats.
- Cost per available seat = operating expense / available seats.

These are intentionally simple, traceable metrics. More advanced airline unit economics such as RASM, CASM and RPM/ASM-based load factor should only be added once the final T-100 field set is validated against real extracts.

## Control checks

The model includes an operating profit reconciliation:

`reported operating profit - (operating revenue - operating expense)`

A material non-zero result should block publication until the source definitions and scaling are understood.

## Variance model

Each metric can produce:

- Current value.
- Prior value.
- Absolute variance.
- Percentage variance.

This structure will be the deterministic input for the future commentary engine.

## Unit discipline

The model assumes mapped fields have already been normalized to a common reporting unit before they enter the analytical layer.

In particular:

- P-1.2 and P-5.2 monetary values are typically reported in USD thousands.
- P-12(a) monetary values are reported in USD.

The ingestion layer must scale these consistently before combining them.

## Deferred metrics

The following are deliberately deferred until real BTS extracts are validated:

- ASM and RPM based RASM/CASM.
- True passenger load factor based on passenger miles and seat miles.
- Route contribution margin.
- Aircraft type contribution margin.
- Price-volume-mix decomposition.
- Fuel price vs consumption bridge.

The model is designed so these can be added without changing the current API.
