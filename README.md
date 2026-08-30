# Airline Finance Command Center

Automated airline finance and performance management system using official BTS data.

## Goal

This project is not just a dashboard. It is a finance control system for an airline, designed to show how a Head of Finance or FP&A team could convert official transport data into a repeatable close review.

The system will:

- Download official BTS and DOT data.
- Profile and map source fields before building analytics.
- Select the airline objectively based on data coverage and reconciliation quality.
- Keep a configurable rolling history window so the free GitHub setup stays small.
- Transform source tables into compact analytical outputs.
- Generate deterministic, traceable variance commentary.
- Publish a static dashboard through GitHub Pages.

## Current Status

The project foundation is implemented end to end: scoring, profiling, official BTS download logic, coverage reporting, selection gates, real field mapping, financial KPIs, deterministic commentary, and the CFO web dashboard.

The public dashboard is deployed through GitHub Pages from the `web/` directory. Current web values are explicitly marked as demo data until the official BTS files are processed and the airline selection gate passes.

## Initial Data Scope

Candidate BTS sources:

| Source | Frequency | Intended use |
|---|---:|---|
| P-1.2 | Quarterly | Airline P&L and financial statements |
| P-5.2 | Quarterly | Aircraft operating expenses |
| P-12(a) | Monthly | Fuel, aircraft activity and operating statistics |
| T-100 | Monthly | Segment traffic, routes, capacity and passengers |
| B-43 | Periodic | Fleet and aircraft inventory reference |

Candidate airlines:

| Airline | Code to validate | Reason to test |
|---|---|---|
| Delta Air Lines | DL | Strong finance story, broad fleet and network |
| American Airlines | AA | Large network and complex operations |
| United Airlines | UA | Strong international mix |
| Southwest Airlines | WN | Cleaner single-fleet operating model |

Delta is the preferred candidate only if the data confirms enough continuity and reconciliation quality. The selection remains evidence-based.

## Rolling Retention

The project will not store unlimited history in the public repository. Retention is configured in `config/config.yaml`.

Default starting point:

- 8 quarterly periods for finance and aircraft operating expense tables.
- 24 monthly periods for operational tables.
- Reprocess recent periods to capture BTS revisions.
- Publish only compact aggregated outputs to the static web app.

## Architecture

```text
BTS/DOT official data
-> Python ingestion
-> profiling and mapping
-> validation controls
-> compact analytical outputs
-> deterministic commentary
-> static HTML/CSS/JavaScript CFO dashboard
-> GitHub Pages
```

## Repository Layout

```text
config/     Project configuration and retention policy
docs/       Data source, mapping and decision records
src/        Python package for ingestion, mapping, validation and finance logic
tests/      Automated checks
web/        Static CFO dashboard assets
```

## Discovery CLI

Generate the source discovery report:

```bash
afcc-discover --output reports/discovery_report.json
```

To profile local BTS CSV files, place them in a folder using the BTS source code as the file name, for example `P-1.2.csv` or `T-100.csv`, then run:

```bash
afcc-discover --input-dir data/samples --output reports/discovery_report.json
```

The command profiles period coverage by airline, generates the coverage report, applies the weighted scoring model and evaluates the airline selection gates.
