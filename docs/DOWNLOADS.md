# Official BTS Downloads

## Decision

The project uses direct ZIP products published by the U.S. Bureau of Transportation Statistics whenever a stable official file is available. TranStats table pages remain the authoritative table-level reference for schema and release validation.

This avoids making the production ingestion workflow depend on browser automation or scraping the TranStats download form.

## Current Download Products

### DB10 - Form 41 Financial

Official BTS page:

https://www.bts.gov/browse-statistical-products-and-data/db10

Current package registered in the project:

DB10.202404.202603.REL01.15JUN2026.zip

The DB10 collection is the raw financial source used to derive the project schedules. Relevant schedule identifiers include:

- P012: Schedule P-1.2 profit and loss statement
- P052: Schedule P-5.2 detailed aircraft operating expense
- P12A: Schedule P-12(a) fuel cost and consumption

B-43 is maintained as a separate TranStats table reference because its record structure differs from the standard DB10 financial record layout.

### DB20 - T-100 Monthly Traffic and Capacity

Official BTS page:

https://www.bts.gov/browse-statistical-products-and-data/db20

Current package registered in the project:

DB20.202505.202604.REL01.07JUL2026.zip

DB20 provides monthly U.S. air carrier traffic and capacity information derived from T-100 reporting. It is suitable for initial carrier coverage and operational continuity checks.

For detailed origin-destination and aircraft-level route analysis, the project will continue to reference the TranStats T-100 segment table and may later ingest a more granular BTS product if required by the financial model.

## TranStats Table References

The downloader module keeps the authoritative TranStats pages for:

- P-1.2
- P-5.2
- P-12(a)
- B-43
- T-100 Domestic Segment

These URLs are metadata and validation references. They are not scraped in the production download workflow.

## Command

Download all registered current products:

```bash
afcc-download
```

Download only one product:

```bash
afcc-download --product DB10
afcc-download --product DB20
```

Select a destination:

```bash
afcc-download --output-dir data/raw
```

Existing files are reused unless `--overwrite` is supplied.

## Validation

Every downloaded payload must start with the ZIP signature before it is persisted. HTML error pages or other unexpected responses fail explicitly rather than being silently saved as source data.

Raw downloads remain excluded from Git because `data/raw/` is ignored.
