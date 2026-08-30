# Airline Selection Decision

The project does not select an airline simply because it ranks first.

A final selection is allowed only when the evidence passes configured decision gates.

## Decision gates

The current thresholds are intentionally conservative and configurable in `config/config.yaml`.

- Minimum weighted score: 75%.
- Minimum coverage in every core source: 75% of the analytical retention window.
- Minimum score margin over the second-ranked airline: 2 percentage points.
- Required core sources: P-1.2, P-5.2, P-12(a), and T-100.

## Decision statuses

`blocked`

Used when the required evidence is structurally incomplete, for example when a core source is missing.

`manual_review`

Used when a ranking exists but the leading airline fails one or more quality gates, including insufficient source coverage, an overall score below the threshold, or a near tie.

`selected`

Used only when the top-ranked airline passes every configured gate.

## Why the gates exist

A large airline can appear analytically attractive while still having a weak or inconsistent source history. Conversely, a small score advantage may be statistical noise rather than a meaningful reason to choose one airline over another.

The decision layer therefore separates three concepts:

1. Coverage ranking: which candidate has the strongest raw analytical footprint.
2. Eligibility: whether the candidate has enough usable history in every core source.
3. Final selection: whether the evidence is strong enough to commit the rest of the project to that airline.

## Evidence rule

No airline name should be written into the project as the final selected carrier until `selection_decision.status` is `selected` based on real BTS profiles.

Delta remains the provisional business preference only as a tie-break context. It cannot override failed data-quality gates.
