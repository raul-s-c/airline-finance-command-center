# Airline Finance Command Center

Automated airline finance and performance management system using official airline and U.S. DOT BTS data.

## Goal

This project is not just a dashboard. It is a finance control system for an airline, designed to show how a Head of Finance or FP&A team could convert official financial and operational data into a repeatable performance review.

## Live dashboard

https://raul-s-c.github.io/airline-finance-command-center/

## Current status

Delta Air Lines is the selected carrier.

The live management view uses Delta's official Investor Relations results for the freshest quarterly actuals and complements them with an automated U.S. DOT BTS TranStats layer for granular financial, fuel, network and fleet analytics.

The official BTS ingestion route is fully automated through the TranStats `DL_SelectFields.aspx` form. The project discovers the live schema and reporting years, downloads official ZIP extracts, filters Delta, retains compact analytical history and publishes only validated outputs.

Current production coverage:

- P-1.2: 8 quarterly Form 41 financial periods.
- P-5.2: 8 quarterly aircraft-economics periods with aircraft-type detail.
- P-12(a): 24 monthly fuel cost and consumption periods.
- T-100 Domestic Segment: route and aircraft-level monthly operations.
- T-100 International Segment: international route and aircraft-level monthly operations.
- B-43: latest active aircraft inventory at tail-number level.
- Delta IR: current 2Q26 management actuals and statistical summary.

The BTS layer refreshes monthly through GitHub Actions and can also be triggered manually.

## Data architecture

```text
Delta Investor Relations
        |
        | freshest quarterly management actuals
        v
Current CFO view

U.S. DOT BTS TranStats
        |
        | P-1.2 / P-5.2 / P-12(a) / T-100 / B-43
        v
Live WebForms downloader
        |
        v
Streaming Delta filter
        |
        v
Validation and rolling retention
        |
        v
web/data/bts_summary.json
        |
        +--------------------+
                             v
                    CFO web dashboard
                             |
                             v
                       GitHub Pages
```

## Selected airline

Delta Air Lines (`DL`, BTS Airline ID `19790`) was selected after the candidate review of Delta, American, United and Southwest. Recent source coverage was effectively tied across the large carriers, so the pre-defined provisional priority was used as the documented tie-break after data-quality gates were satisfied.

## Rolling retention

The public repository does not store raw TranStats ZIP files.

Published analytical retention is:

- 8 quarterly financial periods.
- 8 quarterly aircraft-economics periods.
- 24 monthly fuel periods.
- 24 monthly network periods.
- latest B-43 fleet inventory.

The pipeline downloads enough source years to rebuild these outputs and capture BTS revisions.

## Main commands

Download one official TranStats table:

```bash
afcc-download --table T-100 --year latest
```

Download all current production tables:

```bash
afcc-download --table all --year latest
```

Use the lower-level TranStats downloader directly:

```bash
afcc-transtats --table P-1.2 --year 2026
```

Build the complete compact Delta BTS layer:

```bash
afcc-build-bts --output web/data/bts_summary.json
```

Generate a discovery and coverage report from local extracts:

```bash
afcc-discover --input-dir data/samples --output reports/discovery_report.json
```

## Finance and operational outputs

The model includes:

- quarterly P&L and margins;
- current/prior variance analysis;
- monthly fuel cost, gallons and unit price;
- domestic and international T-100 passengers, seats, departures, RPM and ASM;
- load factor and capacity/traffic drivers;
- top directional routes;
- airport activity;
- T-100 aircraft-type mix;
- P-5.2 aircraft operating expense and air-hour detail;
- B-43 active fleet and model mix;
- deterministic evidence-backed management commentary;
- reconciliation and data-quality controls.

## Repository layout

```text
config/     Project configuration and retention policy
docs/       Data sources, mapping and decision records
src/        Ingestion, transformation, validation and finance logic
tests/      Automated tests
web/        Static CFO dashboard and compact published data
```

## Automation

`.github/workflows/refresh-bts.yml` performs the production refresh. It runs the test suite, downloads official TranStats data, builds and validates the Delta layer, safely rebases the generated output onto the latest `main`, commits only compact changed data and deploys GitHub Pages.

Raw BTS data remains excluded from Git.
