# Automatic Finance Commentary

The commentary layer is deterministic and evidence-based.

## Principles

1. No commentary is emitted unless a metric passes both an absolute and a percentage materiality threshold.
2. Drivers are only mentioned when they are provided by a validated driver decomposition.
3. If a movement is material but no validated driver exists, the system states that explicitly.
4. Every commentary item carries evidence fields so the statement can be traced back to the underlying variance and driver contributions.
5. The engine does not use a generative model to infer causes.

## Input

Each metric receives:

- current value
- prior value
- absolute variance
- percentage variance
- unit
- configured materiality rule
- optional validated driver contributions

## Example

Input:

- Revenue current: 1,100
- Revenue prior: 1,000
- Absolute variance: +100
- Percentage variance: +10%
- Volume contribution: +70
- Price contribution: +20
- Mix contribution: +10

Output:

Revenue increased by $100.0m (10.0%). Main drivers: higher passenger volume contributed $70m; higher revenue per passenger contributed $20m.

Only the two largest configured driver contributions are included by default.

## No-driver case

If Fuel Cost increased materially but a validated fuel price / fuel volume bridge is not yet available, the engine outputs the movement and then states:

No validated driver decomposition is available for this movement.

This is intentional. The system must not infer causality from correlation.

## Dashboard output

The commentary layer can publish compact JSON with:

- airline_id
- period
- source_status
- commentary_count
- items

Each item includes:

- metric
- headline
- detail
- material
- evidence

This structure can be loaded directly by the static CFO dashboard once the real BTS pipeline is connected.
