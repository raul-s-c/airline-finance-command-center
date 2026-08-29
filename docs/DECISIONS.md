# Decision Log

## 0001 - Use Official BTS Data

Status: accepted

The project will use official BTS and DOT data as the source of truth. Derived datasets may be built locally, but every published metric must remain traceable to the original source table and field.

## 0002 - Use Rolling Retention

Status: accepted

The repository will not keep unlimited public history. The starting retention policy keeps 8 quarterly analytical periods and 24 monthly analytical periods, with a longer raw diagnostic window only if storage remains reasonable.

## 0003 - Select Airline After Coverage Test

Status: accepted

Delta is a preferred candidate, but the project will compare Delta, American, United and Southwest before final selection.

## 0004 - Publish Compact Outputs Only

Status: accepted

The static GitHub Pages app should receive compact JSON outputs and reconciliation summaries. Raw extracts and local analytical databases should not be committed by default.
