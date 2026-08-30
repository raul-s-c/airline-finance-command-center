# Airline Selection

The initial candidate set is Delta, American, United and Southwest.

## Decision Rule

The selected airline must maximize analytical usefulness without forcing incompatible entity definitions across financial and operational sources.

Delta is the provisional favorite, but not the automatic answer.

## Scoring Matrix

| Criterion | Weight | What good looks like |
|---|---:|---|
| P-1.2 financial continuity | 20% | Complete quarterly history for the retention window |
| P-5.2 aircraft expense detail | 25% | Usable cost detail by aircraft or aircraft group |
| P-12(a) operating stats coverage | 10% | Monthly fuel, hours, departures and activity fields |
| T-100 operational coverage | 20% | Useful route, passenger, ASM, RPM and capacity detail |
| Network and fleet analytical value | 10% | Enough complexity to show meaningful drivers |
| Cross-source reconciliation | 10% | Periods and carrier identity align across tables |
| Carrier code stability | 5% | Codes and reporting entities are stable and explainable |

## Candidate Notes

| Airline | Why it may win | Main risk |
|---|---|---|
| Delta Air Lines | Strong FP&A story, rich fleet and network | Regional operators may complicate T-100 interpretation |
| American Airlines | Very large scale and route complexity | Entity and merger history may add mapping noise |
| United Airlines | International mix can create strong variance stories | Network complexity may reduce clarity |
| Southwest Airlines | Cleaner single-fleet model | Less fleet mix complexity for driver analysis |

## Entity Boundary

For each airline, phase 0 must separate:

- Reporting carrier in financial tables.
- Operating carrier in T-100.
- Marketing carrier where available.
- Regional affiliates or capacity purchase partners.

No published analysis should imply a direct accounting reconciliation where only an operational proxy exists.
