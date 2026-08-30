# BTS Production Pipeline

## Purpose

The production BTS layer complements Delta's current Investor Relations results with granular U.S. DOT reporting data. Delta IR remains the freshest source for the management quarter; BTS supplies historical continuity and operating detail that is not available in the earnings release.

## Official source

Production downloads come from the U.S. DOT Bureau of Transportation Statistics TranStats service using the official `DL_SelectFields.aspx` download form.

The downloader does not rely on fixed temporary ZIP names. It discovers the current form state, available years and selectable fields, then submits the normal ASP.NET download request and validates the returned ZIP payload.

## Delta identity

- Airline: Delta Air Lines Inc.
- IATA / carrier code: DL
- BTS Airline ID: 19790

Airline ID is treated as the stable identity. `DL` is retained for filtering and display.

## Sources and maximum retained granularity

### P-1.2

Quarterly Form 41 profit and loss statement.

Delta reports separate regional/entity records. Carrier-level quarterly financial metrics are built by summing Delta's additive regional records for the same quarter.

Published history: 8 quarters.

### P-5.2

Quarterly aircraft operating expenses.

The raw data contains region/entity plus aircraft type. Aircraft type 999 aggregate/blank rows are excluded from type-level economics to avoid double counting. Detailed aircraft types are aggregated across Delta reporting regions.

Published history: 8 quarters plus latest aircraft-type economics.

### P-12(a)

Monthly fuel cost and consumption.

The output retains total, domestic and international fuel gallons and costs and derives fuel cost per gallon.

Published history: 24 months.

### T-100 Domestic Segment

Monthly segment-level U.S. operations by origin, destination and aircraft type.

Derived outputs include passengers, available seats, departures, air time, RPM, ASM, load factor, route rankings, airport activity and aircraft-type mix.

### T-100 International Segment

The international segment table is processed with the same logic and combined with the domestic table for the network view while preserving a domestic/international scope indicator.

Published monthly history: 24 months.

### B-43

Annual aircraft inventory at tail-number level.

The public analytical layer retains operating Delta aircraft with tail number, serial number, manufacturer, model, aircraft type, manufacture year, seats and payload capacity. It derives active aircraft count, average fleet age and model mix.

## Storage policy

Raw ZIP files are downloaded only into the workflow's temporary filesystem and are never committed.

The published artifact is `web/data/bts_summary.json`. It contains only Delta records and compact analytical outputs needed by the dashboard.

## Refresh process

`.github/workflows/refresh-bts.yml` runs monthly on the fifth day of the month and supports manual execution.

The workflow:

1. checks out the project;
2. installs the package and development dependencies;
3. runs the complete automated test suite;
4. downloads recent official TranStats source years;
5. builds the Delta compact layer;
6. validates non-empty financial, fuel, network and fleet outputs;
7. rebases the generated file onto the latest `main` to avoid overwriting concurrent code changes;
8. commits the compact output only when data changed;
9. deploys the current `web/` directory to GitHub Pages.

## Current management-source strategy

The dashboard deliberately uses two official source tiers rather than forcing one source to do every job.

Delta Investor Relations:
- current 2Q26 GAAP management actuals;
- current statistical summary;
- current cash flow and capex.

BTS TranStats:
- historical Form 41 financial detail;
- monthly fuel filings;
- domestic and international route detail;
- aircraft-type activity and expense detail;
- tail-level fleet inventory.

This prevents a lagging regulatory source from replacing a fresher management result while still providing the granular analytical depth needed by the Finance Command Center.
