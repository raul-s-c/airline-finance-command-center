# CFO Dashboard

The static web layer is designed as a management-review interface rather than a generic analytics gallery.

## Views

1. Executive Overview
2. P&L Performance
3. Operational Drivers
4. Fuel & Fleet
5. Variance Analysis
6. Data Controls

## Executive Overview

The overview prioritizes a small number of decision metrics:

- Operating revenue
- Operating margin
- Load factor proxy
- Fuel cost per gallon

It also includes a compact P&L snapshot and a small operating-driver panel.

## P&L Performance

The P&L view compares current and prior periods and exposes absolute and percentage variance. The analytical model is expected to supply normalized values after BTS unit conversion.

## Operational Drivers

The operating view connects capacity and activity to financial outcomes. The intended causal structure is:

Capacity -> Traffic -> Revenue -> Cost

Stable BTS identifiers such as AirlineID, OriginAirportID and DestAirportID remain the analytical keys.

## Fuel & Fleet

Fuel analysis separates unit price, volume and total cost. Fleet analysis uses P-5.2 aircraft economics with B-43 reference dimensions.

## Variance Analysis

The variance view is intentionally compatible with deterministic commentary. Each material movement can later be paired with validated price, volume, mix or activity drivers.

## Data Controls

The CFO interface exposes control status rather than hiding it. Core checks include:

- Financial reconciliation
- Schema validation
- Period coverage
- Unit controls
- Stable entity identifiers
- Publication gates

## Demo data

The current front end uses clearly labelled demo figures. They exist only to prove layout and interaction. They must be replaced by validated compact analytical JSON outputs before publication as a real airline performance view.
