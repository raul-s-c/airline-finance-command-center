# Data Sources

This document defines the phase 0 approach for official BTS data discovery.

## Source Principles

- Use official BTS or DOT data only.
- Prefer downloadable files over scraped HTML.
- Treat HTML pages as discovery metadata, not as the source of financial figures.
- Keep original field names in metadata so every normalized metric remains traceable.
- Validate cadence, period availability and units before building analytics.

## Initial Tables

| Table | Cadence | Purpose | Phase 0 question |
|---|---:|---|---|
| P-1.2 | Quarterly | Income statement and financial statements | Is the airline financial history continuous enough? |
| P-5.2 | Quarterly | Aircraft operating expenses | Can operating cost be linked to aircraft groups? |
| P-12(a) | Monthly | Fuel, hours, departures and operating stats | Can monthly activity explain quarterly movement? |
| T-100 | Monthly | Segment traffic and capacity | Can route and capacity mix explain operational drivers? |
| B-43 | Periodic | Fleet inventory | Can aircraft references improve fleet mapping? |

## Download Strategy

The ingestion layer will test download methods in this order:

1. Official ZIP or bulk extract.
2. Stable parameterized download endpoint.
3. Reproducible TranStats form request.

Manual downloads are acceptable only as a temporary diagnostic step. They should not become the production workflow.

## Profiling Checks

Each source extract must produce a profile containing:

- Period coverage.
- Candidate airline coverage.
- Row counts by period and airline.
- Column list and raw data types.
- Null rate by field.
- Duplicate key candidates.
- Unit hints and scaling indicators.
- Basic financial totals where applicable.
- Known warnings and mapping limitations.

## Publication Rules

The public web app should not publish raw BTS files or a DuckDB database by default. It should publish compact JSON outputs after validation.
