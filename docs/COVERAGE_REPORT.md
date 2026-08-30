# Coverage Report

The coverage report is the evidence layer between BTS source profiling and airline selection.

## Outputs

Running `afcc-discover` produces:

- `reports/discovery_report.json`: machine-readable profiles, scores and ranking.
- `reports/coverage_report.md`: human-readable source coverage matrix and provisional ranking.

Example:

```bash
afcc-discover \
  --input-dir data/samples \
  --output reports/discovery_report.json \
  --coverage-output reports/coverage_report.md
```

## Coverage Matrix

For each available source, the report shows the number of distinct periods found for:

- Delta Air Lines (DL)
- American Airlines (AA)
- United Airlines (UA)
- Southwest Airlines (WN)

The expected analytical windows come from `config/config.yaml`:

- 8 quarterly periods for P-1.2 and P-5.2.
- 24 monthly periods for P-12(a) and T-100.
- B-43 is treated as a source-presence/fleet-reference check rather than a fixed-period continuity test.

## Ranking

The coverage matrix feeds the scoring rules in `airline_selection.py`. The report publishes:

- criterion scores by airline,
- weighted final score,
- deterministic rank,
- provisional highest-scoring airline.

The highest coverage score is not the final airline selection by itself. Final selection also requires mapping and reconciliation checks so that operational and financial entities are comparable.

## Data Integrity Rule

The repository must never publish invented coverage values. If official BTS extracts are unavailable in the execution environment, the report remains `profiles_required` rather than filling the matrix with assumptions.

## Current BTS Availability Reference

As checked on 30 August 2026:

- BTS DB10 publishes Form 41 financial data through March 2026.
- BTS T-100 products publish 2026 traffic data, with current BTS product pages listing spring 2026 periods.

Exact airline-level coverage is generated only from the downloaded source files, not from publication-page availability alone.
