# Airline Finance Command Center

Interactive airline finance and performance management system built from official Delta Air Lines and U.S. DOT BTS data.

## Live dashboard

https://raul-s-c.github.io/airline-finance-command-center/

## What this project demonstrates

This is designed as a public Head of Finance / FP&A portfolio project rather than a static dashboard. It combines finance modelling, data engineering, management reporting and an interactive analytical front end.

The application is built so a visitor can move from a CFO-level question into the underlying drivers without needing Power BI or access to a private data platform.

Current interactive pages:

- Executive Overview: latest management actuals plus operating trends and filter-aware insight text.
- Financials: eight quarters of Form 41 P&L, selectable comparison periods and dynamic variance comments.
- Network Explorer: traffic, capacity, load factor, domestic/international filters, route drill-down and aircraft activity.
- Fuel: monthly consumption and cost, unit price and a deterministic price-volume bridge.
- Fleet Explorer: tail-level B-43 inventory, search, fleet age, manufacturer/model mix and P-5.2 aircraft-type economics.
- Variance Lab: choose a dataset, metric and period and generate an evidence-backed management explanation from the active filter context.
- Data Journey: a non-technical explanation of collection, transformation, validation, retention, publication and project data residency.

Global filter state is stored in the URL hash so analytical views can be shared with another visitor.

## Current data model

Delta Air Lines is the selected carrier (`DL`, BTS Airline ID `19790`).

The live management view deliberately uses two official source families:

- Delta Investor Relations for the freshest quarterly management actuals and statistical summary.
- U.S. DOT BTS TranStats for granular regulatory finance, fuel, network, route, aircraft and fleet history.

A slower regulatory release is not used to overwrite a fresher official management result simply for consistency. The application labels the sources and uses each one for the analytical job it does best.

Current production coverage:

- P-1.2: 8 quarterly Form 41 financial periods.
- P-5.2: 8 quarterly aircraft-economics periods with aircraft-type detail.
- P-12(a): 24 monthly fuel cost and consumption periods.
- T-100 Domestic Segment: monthly route and aircraft-level operations.
- T-100 International Segment: monthly international operations.
- B-43: latest active aircraft inventory at tail-number level.
- Delta IR: current 2Q26 management actuals and statistical summary.

## Interactive analytical behaviour

The front end behaves more like a lightweight analytical application than a static GitHub Pages site.

Global controls include:

- 6 / 12 / 24 month history window;
- all network / domestic / international scope;
- year-over-year / prior-period comparison;
- selectable headline metric.

Interactions include:

- click-through KPI focus;
- clickable route bars and route table rows;
- selectable finance and fuel periods;
- searchable and selectable tail-number fleet inventory;
- current-vs-comparator variance analysis;
- context-aware comment cells that recalculate with filters;
- copyable management insight text;
- shareable filtered URLs.

The commentary engine is deterministic. It only explains movements supported by the selected numerical context and does not call a generative model.

## Data architecture

```text
Delta Investor Relations
        |
        | freshest management actuals
        v
Current CFO layer

U.S. DOT BTS TranStats
        |
        | P-1.2 / P-5.2 / P-12(a) / T-100 / B-43
        v
Live WebForms downloader
        |
        v
Delta carrier filter
        |
        v
Validation and rolling retention
        |
        v
Compact analytical JSON
        |
        v
Interactive CFO web application
        |
        v
GitHub Pages
```

The production T-100 pipeline applies the same retained 24-month window to its history, route rankings and aircraft-type rankings. It also publishes compact period history for top routes and aircraft types so the browser can re-aggregate 6, 12 or 24 months without retaining raw T-100 extracts.

## Data retention and residency

Raw BTS ZIP/CSV extracts exist only in the temporary GitHub Actions runner during a refresh. They are not committed to the public repository.

The public project retains:

- 8 finance quarters;
- 8 aircraft-economics quarters;
- 24 fuel months;
- 24 network months;
- latest active B-43 fleet inventory;
- compact history for the top retained-window routes and aircraft types.

No customer, employee or other personal data is ingested.

The Data Journey page uses "data residency" to explain where data lives within this project architecture. It does not make a legal claim that GitHub runners or Pages are pinned to one physical cloud region.

## Automation

`.github/workflows/refresh-bts.yml` is the production refresh pipeline.

It:

1. runs the automated test suite;
2. discovers current TranStats reporting years;
3. downloads official source extracts;
4. filters and aggregates Delta records;
5. validates coverage and publication controls;
6. keeps only compact analytical outputs;
7. rebases the generated output onto the latest `main` safely;
8. commits changed analytical data;
9. deploys GitHub Pages.

The scheduled BTS refresh runs monthly and can also be triggered manually.

## Main commands

Download one official TranStats table:

```bash
afcc-download --table T-100 --year latest
```

Download all production tables:

```bash
afcc-download --table all --year latest
```

Use the lower-level TranStats downloader directly:

```bash
afcc-transtats --table P-1.2 --year 2026
```

Build the original compact Delta layer:

```bash
afcc-build-bts --output web/data/bts_summary.json
```

Build the retention-consistent interactive layer used by production refreshes:

```bash
python -m airline_finance_command_center.bts_delta_pipeline_v2 \
  --output web/data/bts_summary.json
```

Generate a discovery and coverage report from local extracts:

```bash
afcc-discover --input-dir data/samples --output reports/discovery_report.json
```

## Repository layout

```text
config/     Project configuration and retention policy
docs/       Data sources, mapping and decision records
src/        Ingestion, transformation, validation and finance logic
tests/      Automated tests
web/        Interactive CFO application and compact published data
```

Raw BTS source data remains excluded from Git.
